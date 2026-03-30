import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/kpi-daily-snapshot
 *
 * Runs once daily (midnight UTC). For every active KPI that has a current_value,
 * inserts exactly one kpi_entries row per day with source "daily_snapshot".
 * Skips any KPI that already has a daily_snapshot entry for today.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/kpi-daily-snapshot",
      "0 0 * * *",
      async () => {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayISO = todayStart.toISOString();

        // Fetch all active KPIs that have a current_value
        const { data: kpis, error: kpiError } = await supabase
          .from("kpis")
          .select("id, current_value")
          .eq("lifecycle_status", "active")
          .not("current_value", "is", null);

        if (kpiError) {
          throw new Error(`Failed to fetch KPIs: ${kpiError.message}`);
        }

        if (!kpis || kpis.length === 0) {
          return {
            orgsProcessed: 0,
            summary: { snapshotted: 0, skipped: 0 },
          };
        }

        // Find which KPIs already have a daily_snapshot for today
        const { data: existing, error: existError } = await supabase
          .from("kpi_entries")
          .select("kpi_id")
          .eq("source", "daily_snapshot")
          .gte("recorded_at", todayISO);

        if (existError) {
          throw new Error(`Failed to check existing snapshots: ${existError.message}`);
        }

        const alreadySnapshotted = new Set((existing ?? []).map((e) => e.kpi_id));

        const toInsert = kpis
          .filter((k) => !alreadySnapshotted.has(k.id))
          .map((k) => ({
            kpi_id: k.id,
            value: k.current_value,
            recorded_at: new Date().toISOString(),
            source: "daily_snapshot",
          }));

        if (toInsert.length === 0) {
          return {
            orgsProcessed: 0,
            summary: {
              snapshotted: 0,
              skipped: kpis.length,
              message: "All KPIs already snapshotted today",
            },
          };
        }

        const { error: insertError } = await supabase
          .from("kpi_entries")
          .insert(toInsert);

        if (insertError) {
          throw new Error(`Failed to insert snapshots: ${insertError.message}`);
        }

        return {
          orgsProcessed: 0,
          summary: {
            snapshotted: toInsert.length,
            skipped: alreadySnapshotted.size,
          },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
