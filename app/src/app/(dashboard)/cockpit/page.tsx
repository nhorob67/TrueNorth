import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { checkStaleness } from "@/lib/staleness";
import { detectStalledBets } from "@/lib/stall-detection";
import { computeCadenceReport } from "@/lib/cadence-intelligence";
import { computeOperatingHealth } from "@/lib/operating-health";
import { CockpitView } from "./cockpit-view";

export default async function CockpitPage() {
  const supabase = await getCachedClient();
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().split("T")[0];

  // Stage 1: all independent queries in parallel
  const [
    ctx,
    { data: driftingKpis, error: e1 },
    { data: openDecisions, error: e2 },
    { data: atRiskBets, error: e3 },
    { data: openBlockers, error: e4 },
    { data: upcomingMoves, error: e5 },
    { data: pendingCommitments, error: e6 },
    { data: todayPulses, error: e7 },
    { data: blockerLinks, error: e8 },
  ] = await Promise.all([
    getCachedUserContext(),
    supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, unit")
      .eq("lifecycle_status", "active")
      .in("health_status", ["red", "yellow"])
      .order("health_status"),
    supabase
      .from("decisions")
      .select("id, title, created_at")
      .is("decided_at", null)
      .order("created_at"),
    supabase
      .from("bets")
      .select("id, outcome, health_status")
      .eq("lifecycle_status", "active")
      .in("health_status", ["red", "yellow"]),
    supabase
      .from("blockers")
      .select("id, description, severity, created_at")
      .eq("resolution_state", "open")
      .order("severity")
      .order("created_at"),
    supabase
      .from("moves")
      .select("id, title, due_date, bet_id, bets(outcome)")
      .eq("type", "milestone")
      .in("lifecycle_status", ["not_started", "in_progress"])
      .lte("due_date", sevenDaysFromNow)
      .order("due_date"),
    supabase
      .from("commitments")
      .select("id, description, due_date, status")
      .eq("status", "pending")
      .order("due_date"),
    supabase
      .from("pulses")
      .select("user_id, user_profiles(full_name)")
      .eq("date", today),
    supabase
      .from("blockers")
      .select("id, description, severity, linked_entity_id")
      .eq("resolution_state", "open")
      .eq("linked_entity_type", "move")
      .not("linked_entity_id", "is", null),
  ]);

  const firstError = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8;
  if (firstError) throw firstError;

  // Stage 2: dependent queries in parallel
  const blockedMoveIds = (blockerLinks ?? []).map((b) => b.linked_entity_id).filter(Boolean) as string[];

  const [blockedMovesResult, ventureResult, stalenessResults, stalledBetsResult, cadenceReport, healthReport] = await Promise.all([
    blockedMoveIds.length > 0
      ? supabase
          .from("moves")
          .select("id, title, bets(outcome)")
          .in("id", blockedMoveIds)
      : Promise.resolve({ data: null, error: null }),
    ctx
      ? supabase
          .from("ventures")
          .select("settings")
          .eq("id", ctx.ventureId)
          .single()
      : Promise.resolve({ data: null, error: null }),
    ctx
      ? checkStaleness(supabase, ctx.ventureId, ctx.orgId)
      : Promise.resolve([]),
    ctx
      ? detectStalledBets(supabase, ctx.orgId, ctx.ventureId)
      : Promise.resolve([]),
    ctx
      ? computeCadenceReport(supabase, ctx.orgId, ctx.ventureId)
      : Promise.resolve(null),
    ctx
      ? computeOperatingHealth(supabase, ctx.orgId, ctx.ventureId, ctx.isSingleVenture)
      : Promise.resolve(null),
  ]);

  const staleArtifacts = stalenessResults
    .filter((a) => a.is_stale)
    .map((a) => ({
      artifact_type: a.artifact_type,
      name: a.name,
      days_since_update: a.days_since_update,
      staleness_threshold_days: a.staleness_threshold_days,
    }));

  // Build blocked moves data
  const blockedMovesData = (blockedMovesResult.data ?? []).map((m: Record<string, unknown>) => {
    const blocker = (blockerLinks ?? []).find((b) => b.linked_entity_id === m.id);
    const bets = Array.isArray(m.bets) ? (m.bets as Array<{ outcome: string }>)[0] : m.bets;
    return {
      id: m.id as string,
      title: m.title as string,
      bet_outcome: (bets as { outcome: string } | null)?.outcome ?? "",
      blocker_description: blocker?.description ?? "",
      blocker_severity: blocker?.severity ?? "",
    };
  });

  // Compute next cadence event
  let nextCadenceEvent: string | null = null;
  if (ctx) {
    const settings = (ventureResult.data?.settings ?? {}) as Record<string, unknown>;
    if (settings.weekly_sync_day) {
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const targetDay = dayMap[settings.weekly_sync_day as string] ?? 1;
      const now = new Date();
      const currentDay = now.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + daysUntil);
      const time = (settings.weekly_sync_time as string) ?? "9:00 AM";
      nextCadenceEvent = `Weekly Sync: ${nextDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${time}`;
    }
  }

  // Fetch latest cockpit_advice notification for the current user
  let aiRecommendation: {
    action: string;
    reasoning: string;
    entityType?: string;
    entityId?: string;
    urgency: "critical" | "important" | "suggested";
    confidence: "high" | "medium" | "low";
  } | null = null;

  if (ctx) {
    const { data: adviceNotif } = await supabase
      .from("notifications")
      .select("title, body, entity_type, entity_id")
      .eq("user_id", ctx.userId)
      .eq("type", "cockpit_advice")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (adviceNotif) {
      aiRecommendation = {
        action: adviceNotif.title,
        reasoning: adviceNotif.body ?? "",
        entityType: adviceNotif.entity_type ?? undefined,
        entityId: adviceNotif.entity_id ?? undefined,
        urgency: "important",
        confidence: "medium",
      };
    }
  }

  return (
    <CockpitView
      blockedMoves={blockedMovesData}
      nextCadenceEvent={nextCadenceEvent}
      driftingKpis={driftingKpis ?? []}
      staleArtifacts={staleArtifacts}
      openDecisions={openDecisions ?? []}
      atRiskBets={atRiskBets ?? []}
      openBlockers={openBlockers ?? []}
      upcomingMoves={(upcomingMoves ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        bets: Array.isArray(m.bets) ? (m.bets as Array<{ outcome: string }>)[0] ?? null : m.bets,
      })) as Array<{ id: string; title: string; due_date: string; bet_id: string; bets: { outcome: string } | null }>}
      pendingCommitments={pendingCommitments ?? []}
      todayPulses={(todayPulses ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        user_profiles: Array.isArray(p.user_profiles) ? (p.user_profiles as Array<{ full_name: string }>)[0] ?? null : p.user_profiles,
      })) as Array<{ user_id: string; user_profiles: { full_name: string } | null }>}
      stalledBets={stalledBetsResult}
      cadenceReport={cadenceReport}
      aiRecommendation={aiRecommendation}
      healthScore={healthReport?.composite_score ?? null}
      healthStatus={healthReport?.composite_status ?? null}
      healthTrend={
        healthReport
          ? (() => {
              const scores = Object.values(healthReport.metrics).map((m) => m.trend);
              const improving = scores.filter((t) => t === "improving").length;
              const declining = scores.filter((t) => t === "declining").length;
              if (improving > declining) return "improving" as const;
              if (declining > improving) return "declining" as const;
              return "stable" as const;
            })()
          : null
      }
    />
  );
}
