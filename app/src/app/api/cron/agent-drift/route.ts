import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Drift thresholds. If a metric deviates beyond these from the 4-week baseline,
 * an alert is created.
 */
const DRIFT_THRESHOLDS = {
  acceptance_rate: { delta: -15, severity: "warning" as const, criticalDelta: -30 },
  cost: { delta: 25, severity: "warning" as const, criticalDelta: 50 },
  override_rate: { delta: 10, severity: "warning" as const, criticalDelta: 25 },
  latency: { delta: 50, severity: "warning" as const, criticalDelta: 100 },
} as const;

type DriftType = keyof typeof DRIFT_THRESHOLDS;

/**
 * GET /api/cron/agent-drift
 *
 * Weekly cron (Monday 9 AM UTC). Compares each agent's 7-day performance
 * window to a 4-week rolling baseline. Flags drift exceeding thresholds
 * and sends notifications to org admins.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/agent-drift",
      "0 9 * * 1",
      async () => {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fiveWeeksAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

        const currentStart = oneWeekAgo.toISOString().slice(0, 10);
        const currentEnd = now.toISOString().slice(0, 10);
        const baselineStart = fiveWeeksAgo.toISOString().slice(0, 10);
        const baselineEnd = oneWeekAgo.toISOString().slice(0, 10);

        const { data: orgs } = await supabase.from("organizations").select("id");
        let totalAlerts = 0;

        for (const org of orgs ?? []) {
          // Fetch snapshots for the comparison windows
          const { data: snapshots } = await supabase
            .from("agent_performance_snapshots")
            .select("agent_profile, snapshot_date, metrics")
            .eq("organization_id", org.id)
            .eq("period", "weekly")
            .gte("snapshot_date", baselineStart)
            .order("snapshot_date", { ascending: false });

          if (!snapshots || snapshots.length === 0) continue;

          // Group by agent profile
          const byProfile = new Map<string, Array<{ date: string; metrics: Record<string, unknown> }>>();
          for (const snap of snapshots) {
            const existing = byProfile.get(snap.agent_profile) ?? [];
            existing.push({ date: snap.snapshot_date, metrics: snap.metrics as Record<string, unknown> });
            byProfile.set(snap.agent_profile, existing);
          }

          // Fetch org admins for notifications
          const { data: admins } = await supabase
            .from("organization_memberships")
            .select("user_id")
            .eq("organization_id", org.id)
            .eq("role", "admin");

          const adminIds = (admins ?? []).map((a) => a.user_id);

          for (const [profile, profileSnapshots] of byProfile) {
            // Split into current (most recent) and baseline (older)
            const current = profileSnapshots.find((s) => s.date >= currentStart);
            const baseline = profileSnapshots.filter((s) => s.date >= baselineStart && s.date < baselineEnd);

            if (!current || baseline.length === 0) continue;

            const cm = current.metrics;

            // Compute baseline averages
            const baselineAvgs = computeBaselineAverages(baseline.map((b) => b.metrics));

            // Check each drift dimension
            const drifts: Array<{
              type: DriftType;
              current: number;
              baseline: number;
              deltaPct: number;
              severity: "warning" | "critical";
            }> = [];

            // Acceptance rate drift (negative = bad)
            if (cm.acceptance_rate != null && baselineAvgs.acceptance_rate != null) {
              const delta = (cm.acceptance_rate as number) - baselineAvgs.acceptance_rate;
              if (delta < DRIFT_THRESHOLDS.acceptance_rate.delta) {
                drifts.push({
                  type: "acceptance_rate",
                  current: cm.acceptance_rate as number,
                  baseline: baselineAvgs.acceptance_rate,
                  deltaPct: delta,
                  severity: delta < DRIFT_THRESHOLDS.acceptance_rate.criticalDelta ? "critical" : "warning",
                });
              }
            }

            // Cost drift (positive = bad)
            if (cm.total_cost != null && baselineAvgs.total_cost != null && baselineAvgs.total_cost > 0) {
              const pctChange = ((cm.total_cost as number) - baselineAvgs.total_cost) / baselineAvgs.total_cost * 100;
              if (pctChange > DRIFT_THRESHOLDS.cost.delta) {
                drifts.push({
                  type: "cost",
                  current: cm.total_cost as number,
                  baseline: baselineAvgs.total_cost,
                  deltaPct: Math.round(pctChange * 100) / 100,
                  severity: pctChange > DRIFT_THRESHOLDS.cost.criticalDelta ? "critical" : "warning",
                });
              }
            }

            // Override rate drift (positive = bad)
            if (cm.override_rate != null && baselineAvgs.override_rate != null) {
              const delta = (cm.override_rate as number) - baselineAvgs.override_rate;
              if (delta > DRIFT_THRESHOLDS.override_rate.delta) {
                drifts.push({
                  type: "override_rate",
                  current: cm.override_rate as number,
                  baseline: baselineAvgs.override_rate,
                  deltaPct: delta,
                  severity: delta > DRIFT_THRESHOLDS.override_rate.criticalDelta ? "critical" : "warning",
                });
              }
            }

            // Latency drift (positive = bad)
            if (cm.avg_processing_time_ms != null && baselineAvgs.avg_processing_time_ms != null && baselineAvgs.avg_processing_time_ms > 0) {
              const pctChange = ((cm.avg_processing_time_ms as number) - baselineAvgs.avg_processing_time_ms) / baselineAvgs.avg_processing_time_ms * 100;
              if (pctChange > DRIFT_THRESHOLDS.latency.delta) {
                drifts.push({
                  type: "latency",
                  current: cm.avg_processing_time_ms as number,
                  baseline: baselineAvgs.avg_processing_time_ms,
                  deltaPct: Math.round(pctChange * 100) / 100,
                  severity: pctChange > DRIFT_THRESHOLDS.latency.criticalDelta ? "critical" : "warning",
                });
              }
            }

            // Create alerts and notifications
            for (const drift of drifts) {
              await supabase.from("agent_drift_alerts").insert({
                organization_id: org.id,
                agent_profile: profile,
                drift_type: drift.type,
                severity: drift.severity,
                current_value: drift.current,
                baseline_value: drift.baseline,
                delta_pct: drift.deltaPct,
                current_window_start: currentStart,
                current_window_end: currentEnd,
                baseline_window_start: baselineStart,
                baseline_window_end: baselineEnd,
              });

              // Notify admins
              const driftLabel = formatDriftType(drift.type);
              const title = `Agent drift: ${profile} — ${driftLabel}`;
              const body = `${profile}'s ${driftLabel} has drifted ${drift.deltaPct > 0 ? "+" : ""}${drift.deltaPct.toFixed(1)}% from baseline (${drift.baseline.toFixed(1)} → ${drift.current.toFixed(1)}).`;

              for (const userId of adminIds) {
                await sendNotification(supabase, {
                  userId,
                  orgId: org.id,
                  type: "agent_drift_detected",
                  tier: drift.severity === "critical" ? "urgent" : "daily_digest",
                  title,
                  body,
                });
              }

              totalAlerts++;
            }
          }
        }

        return {
          orgsProcessed: (orgs ?? []).length,
          summary: { alerts_created: totalAlerts },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function computeBaselineAverages(
  metricsArr: Array<Record<string, unknown>>
): Record<string, number | null> {
  const keys = ["acceptance_rate", "override_rate", "total_cost", "avg_processing_time_ms"];
  const result: Record<string, number | null> = {};

  for (const key of keys) {
    const values = metricsArr
      .map((m) => m[key])
      .filter((v): v is number => v != null && typeof v === "number");

    result[key] = values.length > 0
      ? values.reduce((s, v) => s + v, 0) / values.length
      : null;
  }

  return result;
}

function formatDriftType(type: DriftType): string {
  const labels: Record<DriftType, string> = {
    acceptance_rate: "acceptance rate",
    cost: "cost",
    override_rate: "override rate",
    latency: "processing time",
  };
  return labels[type] ?? type;
}
