import { SupabaseClient } from "@supabase/supabase-js";
import { OperatingHealthMetric, OperatingHealthReport, HealthStatus } from "@/types/database";

// ============================================================
// Operating Health Engine (Phase 4 — Behavioral Culture Metrics)
//
// Derives culture and health signals from behavioral data:
// 1. Decision Velocity — avg time from open → decided
// 2. Blocker Half-Life — median resolution time by severity
// 3. Strategy Connection Rate — % of pulses linked to bets/KPIs
// 4. Execution Cadence Health — composite of pulse/KPI/sync/commitment cadences
// 5. Cross-Venture Collaboration Index — cross-venture entity references
// 6. Kill Courage Score — ratio of early kills vs. limping bets
// ============================================================

function statusFromScore(score: number): HealthStatus {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function computeTrend(current: number, previous: number): { trend: "improving" | "declining" | "stable"; delta: number } {
  const delta = current - previous;
  const threshold = 3; // ±3 points = stable
  if (delta > threshold) return { trend: "improving", delta };
  if (delta < -threshold) return { trend: "declining", delta };
  return { trend: "stable", delta };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ============================================================
// 1. Decision Velocity
// ============================================================

async function computeDecisionVelocity(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string | null,
  windowDays: number
): Promise<{ current: number; previous: number }> {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const prevStart = new Date(Date.now() - windowDays * 2 * 24 * 60 * 60 * 1000).toISOString();

  let currentQuery = supabase
    .from("decisions")
    .select("created_at, decided_at")
    .eq("organization_id", orgId)
    .not("decided_at", "is", null)
    .gte("decided_at", windowStart);

  let prevQuery = supabase
    .from("decisions")
    .select("created_at, decided_at")
    .eq("organization_id", orgId)
    .not("decided_at", "is", null)
    .gte("decided_at", prevStart)
    .lt("decided_at", windowStart);

  if (ventureId) {
    currentQuery = currentQuery.eq("venture_id", ventureId);
    prevQuery = prevQuery.eq("venture_id", ventureId);
  }

  const [{ data: current }, { data: previous }] = await Promise.all([currentQuery, prevQuery]);

  const calcAvgDays = (decisions: Array<{ created_at: string; decided_at: string }> | null) => {
    if (!decisions || decisions.length === 0) return 0;
    const durations = decisions.map((d) => {
      const created = new Date(d.created_at).getTime();
      const decided = new Date(d.decided_at).getTime();
      return (decided - created) / (1000 * 60 * 60 * 24);
    });
    return Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length) * 10) / 10;
  };

  return { current: calcAvgDays(current), previous: calcAvgDays(previous) };
}

// ============================================================
// 2. Blocker Half-Life
// ============================================================

async function computeBlockerHalfLife(
  supabase: SupabaseClient,
  orgId: string,
  windowDays: number
): Promise<{ current: number; previous: number }> {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const prevStart = new Date(Date.now() - windowDays * 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: currentBlockers } = await supabase
    .from("blockers")
    .select("created_at, resolved_at")
    .eq("organization_id", orgId)
    .not("resolved_at", "is", null)
    .gte("resolved_at", windowStart);

  const { data: prevBlockers } = await supabase
    .from("blockers")
    .select("created_at, resolved_at")
    .eq("organization_id", orgId)
    .not("resolved_at", "is", null)
    .gte("resolved_at", prevStart)
    .lt("resolved_at", windowStart);

  const calcMedianDays = (blockers: Array<{ created_at: string; resolved_at: string }> | null) => {
    if (!blockers || blockers.length === 0) return 0;
    const durations = blockers.map((b) => {
      const created = new Date(b.created_at).getTime();
      const resolved = new Date(b.resolved_at).getTime();
      return (resolved - created) / (1000 * 60 * 60 * 24);
    });
    return Math.round(median(durations) * 10) / 10;
  };

  return { current: calcMedianDays(currentBlockers), previous: calcMedianDays(prevBlockers) };
}

// ============================================================
// 3. Strategy Connection Rate
// ============================================================

async function computeStrategyConnectionRate(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string | null,
  windowDays: number
): Promise<{ current: number; previous: number }> {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const prevStart = new Date(Date.now() - windowDays * 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  let currentQuery = supabase
    .from("pulses")
    .select("id, items")
    .eq("organization_id", orgId)
    .gte("date", windowStart);

  let prevQuery = supabase
    .from("pulses")
    .select("id, items")
    .eq("organization_id", orgId)
    .gte("date", prevStart)
    .lt("date", windowStart);

  if (ventureId) {
    currentQuery = currentQuery.eq("venture_id", ventureId);
    prevQuery = prevQuery.eq("venture_id", ventureId);
  }

  const [{ data: currentPulses }, { data: prevPulses }] = await Promise.all([currentQuery, prevQuery]);

  const calcRate = (pulses: Array<{ id: string; items: unknown }> | null) => {
    if (!pulses || pulses.length === 0) return 0;
    let totalItems = 0;
    let linkedItems = 0;
    for (const pulse of pulses) {
      const items = pulse.items as Array<{ linked_entity_ids?: string[] }> | null;
      if (!items || !Array.isArray(items)) continue;
      for (const item of items) {
        totalItems++;
        if (item.linked_entity_ids && item.linked_entity_ids.length > 0) {
          linkedItems++;
        }
      }
    }
    return totalItems === 0 ? 0 : Math.round((linkedItems / totalItems) * 100);
  };

  return { current: calcRate(currentPulses), previous: calcRate(prevPulses) };
}

// ============================================================
// 4. Execution Cadence Health
// ============================================================

async function computeExecutionCadenceHealth(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string,
  windowDays: number
): Promise<{ current: number; previous: number }> {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const prevStart = new Date(Date.now() - windowDays * 2 * 24 * 60 * 60 * 1000).toISOString();

  // Pulse frequency (% of days with at least one pulse)
  const [{ data: currentPulses }, { data: prevPulses }] = await Promise.all([
    supabase
      .from("pulses")
      .select("date")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .gte("date", windowStart.split("T")[0]),
    supabase
      .from("pulses")
      .select("date")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .gte("date", prevStart.split("T")[0])
      .lt("date", windowStart.split("T")[0]),
  ]);

  const pulseRate = (pulses: Array<{ date: string }> | null) => {
    if (!pulses) return 0;
    const uniqueDays = new Set(pulses.map((p) => p.date)).size;
    return Math.min(100, Math.round((uniqueDays / windowDays) * 100));
  };

  // Commitment completion rate
  const [{ data: currentCommitments }, { data: prevCommitments }] = await Promise.all([
    supabase
      .from("commitments")
      .select("status")
      .eq("organization_id", orgId)
      .in("status", ["completed", "missed"])
      .gte("updated_at", windowStart),
    supabase
      .from("commitments")
      .select("status")
      .eq("organization_id", orgId)
      .in("status", ["completed", "missed"])
      .gte("updated_at", prevStart)
      .lt("updated_at", windowStart),
  ]);

  const commitRate = (commitments: Array<{ status: string }> | null) => {
    if (!commitments || commitments.length === 0) return 100; // no commitments = no miss
    const completed = commitments.filter((c) => c.status === "completed").length;
    return Math.round((completed / commitments.length) * 100);
  };

  // Weekly sync attendance (meeting_logs)
  const [{ count: currentSyncs }, { count: prevSyncs }] = await Promise.all([
    supabase
      .from("meeting_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("meeting_type", "weekly_sync")
      .gte("started_at", windowStart),
    supabase
      .from("meeting_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("meeting_type", "weekly_sync")
      .gte("started_at", prevStart)
      .lt("started_at", windowStart),
  ]);

  const expectedWeeklySyncs = Math.floor(windowDays / 7);
  const syncRate = (count: number | null) => {
    if (expectedWeeklySyncs === 0) return 100;
    return Math.min(100, Math.round(((count ?? 0) / expectedWeeklySyncs) * 100));
  };

  // Weighted composite: pulse 30%, commitments 40%, sync 30%
  const currentScore = Math.round(
    pulseRate(currentPulses) * 0.3 +
    commitRate(currentCommitments) * 0.4 +
    syncRate(currentSyncs) * 0.3
  );

  const previousScore = Math.round(
    pulseRate(prevPulses) * 0.3 +
    commitRate(prevCommitments) * 0.4 +
    syncRate(prevSyncs) * 0.3
  );

  return { current: currentScore, previous: previousScore };
}

// ============================================================
// 5. Cross-Venture Collaboration Index
// ============================================================

async function computeCrossVentureCollaboration(
  supabase: SupabaseClient,
  orgId: string,
  isSingleVenture: boolean
): Promise<{ current: number; previous: number }> {
  if (isSingleVenture) return { current: 0, previous: 0 };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Count comments where the commenter's primary venture differs from the entity's venture
  // Simplified: count comments across all ventures in the window
  const [{ count: currentComments }, { count: totalCurrentComments }] = await Promise.all([
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", thirtyDaysAgo)
      .not("venture_id", "is", null),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", thirtyDaysAgo),
  ]);

  const [{ count: prevComments }, { count: totalPrevComments }] = await Promise.all([
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", sixtyDaysAgo)
      .lt("created_at", thirtyDaysAgo)
      .not("venture_id", "is", null),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", sixtyDaysAgo)
      .lt("created_at", thirtyDaysAgo),
  ]);

  // Ratio of cross-venture comments to total (simplified proxy)
  const rate = (cross: number | null, total: number | null) => {
    if (!total || total === 0) return 0;
    return Math.round(((cross ?? 0) / total) * 100);
  };

  return { current: rate(currentComments, totalCurrentComments), previous: rate(prevComments, totalPrevComments) };
}

// ============================================================
// 6. Kill Courage Score
// ============================================================

async function computeKillCourage(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string | null
): Promise<{ current: number; previous: number }> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const buildQuery = (startDate: string, endDate?: string) => {
    let q = supabase
      .from("bets")
      .select("id, lifecycle_status, health_status, killed_at, created_at, updated_at")
      .eq("organization_id", orgId)
      .in("lifecycle_status", ["completed", "active"]);
    if (ventureId) q = q.eq("venture_id", ventureId);
    q = q.gte("created_at", startDate);
    if (endDate) q = q.lt("created_at", endDate);
    return q;
  };

  const [{ data: currentBets }, { data: prevBets }] = await Promise.all([
    buildQuery(ninetyDaysAgo),
    buildQuery(oneEightyDaysAgo, ninetyDaysAgo),
  ]);

  const calcScore = (bets: Array<{ lifecycle_status: string; health_status: string; killed_at: string | null; created_at: string; updated_at: string }> | null) => {
    if (!bets || bets.length === 0) return 75; // No bets = neutral score
    const completedBets = bets.filter((b) => b.lifecycle_status === "completed");
    if (completedBets.length === 0) return 75;

    // Killed bets count as courageous
    const killed = completedBets.filter((b) => b.killed_at !== null);
    // Bets that were red for 3+ weeks before completion = "limped"
    const limped = completedBets.filter((b) => b.killed_at === null && b.health_status === "red");

    const courageousKills = killed.length;
    const totalResolutions = completedBets.length;

    // Score: higher ratio of kills to limps = better
    if (totalResolutions === 0) return 75;
    const killRatio = courageousKills / totalResolutions;
    const limpRatio = limped.length / totalResolutions;

    // Score formula: base 50 + kill bonus - limp penalty
    return Math.min(100, Math.max(0, Math.round(50 + killRatio * 40 - limpRatio * 30)));
  };

  return { current: calcScore(currentBets), previous: calcScore(prevBets) };
}

// ============================================================
// Historical Sparkline Data
// ============================================================

async function getHistoricalSparkline(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string,
  metricKey: string,
  points: number = 8
): Promise<number[]> {
  const { data } = await supabase
    .from("operating_health_snapshots")
    .select("metrics, created_at")
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .order("created_at", { ascending: false })
    .limit(points);

  if (!data || data.length === 0) return [];

  return data
    .reverse()
    .map((snapshot) => {
      const metrics = snapshot.metrics as Record<string, { value?: number }>;
      return metrics[metricKey]?.value ?? 0;
    });
}

// ============================================================
// Main Computation
// ============================================================

export async function computeOperatingHealth(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string,
  isSingleVenture: boolean = true,
  windowDays: number = 30
): Promise<OperatingHealthReport> {
  const [
    decisionVelocity,
    blockerHalfLife,
    strategyConnection,
    executionCadence,
    crossVenture,
    killCourage,
  ] = await Promise.all([
    computeDecisionVelocity(supabase, orgId, ventureId, windowDays),
    computeBlockerHalfLife(supabase, orgId, windowDays),
    computeStrategyConnectionRate(supabase, orgId, ventureId, windowDays),
    computeExecutionCadenceHealth(supabase, orgId, ventureId, windowDays),
    computeCrossVentureCollaboration(supabase, orgId, isSingleVenture),
    computeKillCourage(supabase, orgId, ventureId),
  ]);

  // Fetch sparklines in parallel
  const [
    dvSparkline,
    bhSparkline,
    scSparkline,
    ecSparkline,
    cvSparkline,
    kcSparkline,
  ] = await Promise.all([
    getHistoricalSparkline(supabase, orgId, ventureId, "decision_velocity"),
    getHistoricalSparkline(supabase, orgId, ventureId, "blocker_half_life"),
    getHistoricalSparkline(supabase, orgId, ventureId, "strategy_connection_rate"),
    getHistoricalSparkline(supabase, orgId, ventureId, "execution_cadence_health"),
    getHistoricalSparkline(supabase, orgId, ventureId, "cross_venture_collaboration"),
    getHistoricalSparkline(supabase, orgId, ventureId, "kill_courage"),
  ]);

  // Decision velocity: lower is better. Convert to a 0-100 score.
  // ≤1 day = 100, 7+ days = 0
  const dvScore = Math.max(0, Math.min(100, Math.round(100 - (decisionVelocity.current / 7) * 100)));
  const dvPrevScore = Math.max(0, Math.min(100, Math.round(100 - (decisionVelocity.previous / 7) * 100)));
  const dvTrend = computeTrend(dvScore, dvPrevScore);

  // Blocker half-life: lower is better. ≤1 day = 100, 7+ days = 0
  const bhScore = Math.max(0, Math.min(100, Math.round(100 - (blockerHalfLife.current / 7) * 100)));
  const bhPrevScore = Math.max(0, Math.min(100, Math.round(100 - (blockerHalfLife.previous / 7) * 100)));
  const bhTrend = computeTrend(bhScore, bhPrevScore);

  // Strategy connection: already 0-100%
  const scTrend = computeTrend(strategyConnection.current, strategyConnection.previous);

  // Execution cadence: already 0-100
  const ecTrend = computeTrend(executionCadence.current, executionCadence.previous);

  // Cross-venture: already 0-100
  const cvTrend = computeTrend(crossVenture.current, crossVenture.previous);

  // Kill courage: already 0-100
  const kcTrend = computeTrend(killCourage.current, killCourage.previous);

  const buildMetric = (
    key: string,
    label: string,
    value: number,
    unit: string,
    trend: { trend: "improving" | "declining" | "stable"; delta: number },
    sparkline: number[]
  ): OperatingHealthMetric => ({
    key,
    label,
    value,
    unit,
    trend: trend.trend,
    trend_delta: trend.delta,
    status: statusFromScore(value),
    sparkline: [...sparkline, value],
  });

  const metrics = {
    decision_velocity: buildMetric(
      "decision_velocity",
      "Decision Velocity",
      dvScore,
      `${decisionVelocity.current}d avg`,
      dvTrend,
      dvSparkline
    ),
    blocker_half_life: buildMetric(
      "blocker_half_life",
      "Blocker Half-Life",
      bhScore,
      `${blockerHalfLife.current}d median`,
      bhTrend,
      bhSparkline
    ),
    strategy_connection_rate: buildMetric(
      "strategy_connection_rate",
      "Strategy Connection",
      strategyConnection.current,
      "%",
      scTrend,
      scSparkline
    ),
    execution_cadence_health: buildMetric(
      "execution_cadence_health",
      "Execution Cadence",
      executionCadence.current,
      "%",
      ecTrend,
      ecSparkline
    ),
    cross_venture_collaboration: buildMetric(
      "cross_venture_collaboration",
      "Cross-Venture Collab",
      crossVenture.current,
      "%",
      cvTrend,
      cvSparkline
    ),
    kill_courage: buildMetric(
      "kill_courage",
      "Kill Courage",
      killCourage.current,
      "score",
      kcTrend,
      kcSparkline
    ),
  };

  // Composite: weighted average (cross-venture gets lower weight for single-venture orgs)
  const weights = isSingleVenture
    ? { decision_velocity: 0.2, blocker_half_life: 0.2, strategy_connection_rate: 0.2, execution_cadence_health: 0.25, cross_venture_collaboration: 0, kill_courage: 0.15 }
    : { decision_velocity: 0.18, blocker_half_life: 0.18, strategy_connection_rate: 0.18, execution_cadence_health: 0.2, cross_venture_collaboration: 0.1, kill_courage: 0.16 };

  const compositeScore = Math.round(
    metrics.decision_velocity.value * weights.decision_velocity +
    metrics.blocker_half_life.value * weights.blocker_half_life +
    metrics.strategy_connection_rate.value * weights.strategy_connection_rate +
    metrics.execution_cadence_health.value * weights.execution_cadence_health +
    metrics.cross_venture_collaboration.value * weights.cross_venture_collaboration +
    metrics.kill_courage.value * weights.kill_courage
  );

  return {
    venture_id: ventureId,
    organization_id: orgId,
    computed_at: new Date().toISOString(),
    composite_score: compositeScore,
    composite_status: statusFromScore(compositeScore),
    metrics,
  };
}

// ============================================================
// Save Snapshot
// ============================================================

export async function saveHealthSnapshot(
  supabase: SupabaseClient,
  report: OperatingHealthReport,
  aiInterpretation?: string
): Promise<void> {
  const { error } = await supabase.from("operating_health_snapshots").insert({
    organization_id: report.organization_id,
    venture_id: report.venture_id,
    composite_score: report.composite_score,
    composite_status: report.composite_status,
    metrics: report.metrics,
    ai_interpretation: aiInterpretation ?? null,
  });

  if (error) console.error("Failed to save health snapshot:", error);
}
