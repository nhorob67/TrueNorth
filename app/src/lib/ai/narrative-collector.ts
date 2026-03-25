import { SupabaseClient } from "@supabase/supabase-js";
import { NarrativeDataSnapshot, HealthStatus } from "@/types/database";
import { computeOperatingHealth } from "@/lib/operating-health";

// ============================================================
// Narrative Data Collector (Phase 4)
//
// Assembles a structured data snapshot for a given time window,
// pulling from every pillar to feed the AI Narrative Generator.
// ============================================================

export async function collectNarrativeData(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string | null,
  startDate: string,
  endDate: string,
  isSingleVenture: boolean = true
): Promise<NarrativeDataSnapshot> {
  const threeDay = 3 * 24 * 60 * 60 * 1000;
  const earlyWindowEnd = new Date(new Date(startDate).getTime() + threeDay).toISOString();
  const lateWindowStart = new Date(new Date(endDate).getTime() - threeDay).toISOString();
  const startDateOnly = startDate.split("T")[0];
  const endDateOnly = endDate.split("T")[0];

  // Build venture-scoped queries
  const kpiQuery = supabase
    .from("kpis")
    .select("id, name, health_status, current_value, target, unit, updated_at")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active");
  if (ventureId) kpiQuery.eq("venture_id", ventureId);

  const kpiStartQuery = supabase
    .from("kpi_entries")
    .select("kpi_id, value, recorded_at")
    .eq("organization_id", orgId)
    .gte("recorded_at", startDate)
    .lt("recorded_at", earlyWindowEnd);

  const kpiEndQuery = supabase
    .from("kpi_entries")
    .select("kpi_id, value, recorded_at")
    .eq("organization_id", orgId)
    .gte("recorded_at", lateWindowStart)
    .lte("recorded_at", endDate);

  const betsQuery = supabase
    .from("bets")
    .select("id, outcome, health_status, lifecycle_status, updated_at")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active");
  if (ventureId) betsQuery.eq("venture_id", ventureId);

  const pulsesQuery = supabase
    .from("pulses")
    .select("id, user_id, items, date")
    .eq("organization_id", orgId)
    .gte("date", startDateOnly)
    .lte("date", endDateOnly);
  if (ventureId) pulsesQuery.eq("venture_id", ventureId);

  const decisionsQuery = supabase
    .from("decisions")
    .select("title, context, final_decision, decided_at")
    .eq("organization_id", orgId)
    .not("decided_at", "is", null)
    .gte("decided_at", startDate)
    .lte("decided_at", endDate);
  if (ventureId) decisionsQuery.eq("venture_id", ventureId);

  const contentQuery = supabase
    .from("content_pieces")
    .select("id, title, machine_type, lifecycle_status")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "published")
    .gte("updated_at", startDate)
    .lte("updated_at", endDate);
  if (ventureId) contentQuery.eq("venture_id", ventureId);

  const movesShippedQuery = supabase
    .from("moves")
    .select("id")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "shipped")
    .gte("updated_at", startDate)
    .lte("updated_at", endDate);
  if (ventureId) movesShippedQuery.eq("venture_id", ventureId);

  const movesCutQuery = supabase
    .from("moves")
    .select("id")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "cut")
    .gte("updated_at", startDate)
    .lte("updated_at", endDate);
  if (ventureId) movesCutQuery.eq("venture_id", ventureId);

  // Parallel data collection
  const [
    { data: kpis },
    { data: kpiEntriesStart },
    { data: kpiEntriesEnd },
    { data: activeBets },
    { data: pulses },
    { data: decisions },
    { data: contentPieces },
    { data: completedCommitments },
    { data: missedCommitments },
    { data: newCommitments },
    { data: resolvedBlockers },
    { data: newBlockers },
    { data: movesShipped },
    { data: movesCut },
  ] = await Promise.all([
    kpiQuery,
    kpiStartQuery,
    kpiEndQuery,
    betsQuery,
    pulsesQuery,
    decisionsQuery,
    contentQuery,
    supabase
      .from("commitments")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .gte("updated_at", startDate)
      .lte("updated_at", endDate),
    supabase
      .from("commitments")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "missed")
      .gte("updated_at", startDate)
      .lte("updated_at", endDate),
    supabase
      .from("commitments")
      .select("id")
      .eq("organization_id", orgId)
      .gte("created_at", startDate)
      .lte("created_at", endDate),
    supabase
      .from("blockers")
      .select("description, resolution_notes, severity")
      .eq("organization_id", orgId)
      .in("resolution_state", ["resolved", "wont_fix"])
      .gte("resolved_at", startDate)
      .lte("resolved_at", endDate),
    supabase
      .from("blockers")
      .select("id")
      .eq("organization_id", orgId)
      .gte("created_at", startDate)
      .lte("created_at", endDate),
    movesShippedQuery,
    movesCutQuery,
  ]);

  // Compute KPI metrics
  const kpiList = (kpis ?? []) as Array<{ id: string; name: string; health_status: string; current_value: number; target: number; unit: string; updated_at: string }>;
  const greenKpis = kpiList.filter((k) => k.health_status === "green").length;
  const yellowKpis = kpiList.filter((k) => k.health_status === "yellow").length;
  const redKpis = kpiList.filter((k) => k.health_status === "red").length;

  // Biggest movers: compare start vs end entries
  const biggestMovers: Array<{ name: string; change_pct: number; direction: "up" | "down" }> = [];
  const statusChanges: Array<{ name: string; from: HealthStatus; to: HealthStatus }> = [];
  const startEntries = (kpiEntriesStart ?? []) as Array<{ kpi_id: string; value: number; recorded_at: string }>;
  const endEntries = (kpiEntriesEnd ?? []) as Array<{ kpi_id: string; value: number; recorded_at: string }>;

  for (const kpi of kpiList) {
    const starts = startEntries.filter((e) => e.kpi_id === kpi.id);
    const ends = endEntries.filter((e) => e.kpi_id === kpi.id);

    if (starts.length > 0 && ends.length > 0) {
      const startVal = starts[starts.length - 1].value;
      const endVal = ends[ends.length - 1].value;
      if (startVal !== 0 && startVal !== endVal) {
        const changePct = Math.round(((endVal - startVal) / Math.abs(startVal)) * 100);
        if (Math.abs(changePct) >= 5) {
          biggestMovers.push({
            name: kpi.name,
            change_pct: changePct,
            direction: changePct > 0 ? "up" : "down",
          });
        }
      }
    }
  }

  biggestMovers.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

  // Extract pulse insights
  const pulseList = (pulses ?? []) as Array<{ id: string; user_id: string; items: unknown; date: string }>;
  const uniqueContributors = new Set(pulseList.map((p) => p.user_id)).size;

  const shippedItems: string[] = [];
  const blockerThemes: string[] = [];
  const signalHighlights: string[] = [];

  for (const pulse of pulseList) {
    const items = pulse.items as Array<{ type?: string; text?: string }> | null;
    if (!items || !Array.isArray(items)) continue;
    for (const item of items) {
      if (item.type === "shipped" && item.text) shippedItems.push(item.text);
      if (item.type === "blocker" && item.text) blockerThemes.push(item.text);
      if (item.type === "signal" && item.text) signalHighlights.push(item.text);
    }
  }

  // Content output by machine type
  const contentList = (contentPieces ?? []) as Array<{ id: string; title: string; machine_type: string; lifecycle_status: string }>;
  const byMachineType: Record<string, number> = {};
  for (const piece of contentList) {
    byMachineType[piece.machine_type] = (byMachineType[piece.machine_type] ?? 0) + 1;
  }

  // Operating health
  let operatingHealth: NarrativeDataSnapshot["operatingHealth"] = null;
  if (ventureId) {
    try {
      const healthReport = await computeOperatingHealth(supabase, orgId, ventureId, isSingleVenture);
      const metricEntries = Object.values(healthReport.metrics);
      operatingHealth = {
        compositeScore: healthReport.composite_score,
        compositeStatus: healthReport.composite_status,
        metricSummaries: metricEntries.map((m) => ({
          label: m.label,
          value: m.value,
          status: m.status,
          trend: m.trend,
        })),
      };
    } catch {
      // Operating health computation may fail if tables are empty
    }
  }

  const decisionsList = (decisions ?? []) as Array<{ title: string; context: string; final_decision: string; decided_at: string }>;
  const blockersList = (resolvedBlockers ?? []) as Array<{ description: string; resolution_notes: string | null; severity: string }>;

  return {
    timeWindow: { start: startDate, end: endDate },
    kpis: {
      total: kpiList.length,
      green: greenKpis,
      yellow: yellowKpis,
      red: redKpis,
      biggestMovers: biggestMovers.slice(0, 5),
      statusChanges,
    },
    bets: {
      active: (activeBets ?? []).length,
      statusChanges: [],
      movesShipped: (movesShipped ?? []).length,
      movesCut: (movesCut ?? []).length,
      newBlockers: (newBlockers ?? []).length,
    },
    pulses: {
      totalSubmitted: pulseList.length,
      uniqueContributors,
      topShippedItems: shippedItems.slice(0, 10),
      recurringBlockerThemes: blockerThemes.slice(0, 5),
      signalHighlights: signalHighlights.slice(0, 5),
    },
    decisions: decisionsList.map((d) => ({
      title: d.title,
      context: d.context ?? "",
      final_decision: d.final_decision ?? "",
      decided_at: d.decided_at,
    })),
    contentOutput: {
      published: contentList.length,
      byMachineType,
    },
    commitments: {
      completed: (completedCommitments ?? []).length,
      missed: (missedCommitments ?? []).length,
      newCreated: (newCommitments ?? []).length,
    },
    operatingHealth,
    blockersResolved: blockersList.map((b) => ({
      description: b.description,
      resolution_notes: b.resolution_notes,
      severity: b.severity,
    })),
  };
}
