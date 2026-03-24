import { SupabaseClient } from "@supabase/supabase-js";

export interface CadenceMetric {
  cadence_type: string;
  label: string;
  expected_frequency: string;
  last_completed_at: string | null;
  days_since_last: number | null;
  is_overdue: boolean;
  compliance_rate: number;
  status: "green" | "yellow" | "red";
}

export interface CadenceReport {
  venture_id: string;
  metrics: CadenceMetric[];
  overall_score: number;
  overall_status: "green" | "yellow" | "red";
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function statusFromRate(rate: number): "green" | "yellow" | "red" {
  if (rate >= 80) return "green";
  if (rate >= 50) return "yellow";
  return "red";
}

function overallStatusFromScore(score: number): "green" | "yellow" | "red" {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export async function computeCadenceReport(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string
): Promise<CadenceReport> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: pulses },
    { data: kpiEntries },
    { data: activeKpis },
    { data: weeklySyncs },
    { data: monthlyReviews },
    { data: quarterlySummits },
  ] = await Promise.all([
    // Daily pulse: check pulses for last 30 days
    supabase
      .from("pulses")
      .select("date")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .gte("date", thirtyDaysAgo.split("T")[0])
      .order("date", { ascending: false }),
    // KPI entries for last 30 days
    supabase
      .from("kpi_entries")
      .select("kpi_id, recorded_at")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .gte("recorded_at", thirtyDaysAgo),
    // Active KPIs to compute expected updates
    supabase
      .from("kpis")
      .select("id, update_frequency")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("lifecycle_status", "active"),
    // Weekly syncs in last 30 days
    supabase
      .from("meeting_logs")
      .select("started_at")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("meeting_type", "weekly_sync")
      .gte("started_at", thirtyDaysAgo)
      .order("started_at", { ascending: false }),
    // Monthly reviews in last 90 days
    supabase
      .from("meeting_logs")
      .select("started_at")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("meeting_type", "monthly_review")
      .gte("started_at", ninetyDaysAgo)
      .order("started_at", { ascending: false }),
    // Quarterly summits in last year
    supabase
      .from("meeting_logs")
      .select("started_at")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("meeting_type", "quarterly_summit")
      .gte("started_at", oneYearAgo)
      .order("started_at", { ascending: false }),
  ]);

  const metrics: CadenceMetric[] = [];

  // 1. Daily Pulse
  const uniquePulseDays = new Set((pulses ?? []).map((p) => p.date));
  const pulseComplianceRate = Math.round((uniquePulseDays.size / 30) * 100);
  const sortedPulseDates = Array.from(uniquePulseDays).sort().reverse();
  const lastPulseDate = sortedPulseDates[0] ?? null;
  const daysSinceLastPulse = lastPulseDate ? daysBetween(now, new Date(lastPulseDate)) : null;

  metrics.push({
    cadence_type: "daily_pulse",
    label: "Daily Pulse",
    expected_frequency: "daily",
    last_completed_at: lastPulseDate,
    days_since_last: daysSinceLastPulse,
    is_overdue: daysSinceLastPulse !== null ? daysSinceLastPulse > 1 : true,
    compliance_rate: pulseComplianceRate,
    status: statusFromRate(pulseComplianceRate),
  });

  // 2. KPI Updates
  const kpiList = activeKpis ?? [];
  const entries = kpiEntries ?? [];
  let kpiComplianceRate = 100;
  let lastKpiUpdate: string | null = null;

  if (kpiList.length > 0) {
    // For each KPI, check if it has at least one entry in the window
    let onTimeCount = 0;
    for (const kpi of kpiList) {
      const kpiHasEntry = entries.some((e) => e.kpi_id === kpi.id);
      if (kpiHasEntry) onTimeCount++;
    }
    kpiComplianceRate = Math.round((onTimeCount / kpiList.length) * 100);

    // Last KPI update
    const sortedEntries = entries
      .map((e) => e.recorded_at)
      .sort()
      .reverse();
    lastKpiUpdate = sortedEntries[0] ?? null;
  }

  const daysSinceLastKpi = lastKpiUpdate ? daysBetween(now, new Date(lastKpiUpdate)) : null;

  metrics.push({
    cadence_type: "kpi_update",
    label: "KPI Updates",
    expected_frequency: "weekly",
    last_completed_at: lastKpiUpdate,
    days_since_last: daysSinceLastKpi,
    is_overdue: daysSinceLastKpi !== null ? daysSinceLastKpi > 7 : kpiList.length > 0,
    compliance_rate: kpiComplianceRate,
    status: statusFromRate(kpiComplianceRate),
  });

  // 3. Weekly Sync
  const weeklyCount = (weeklySyncs ?? []).length;
  const weeklyRate = Math.round(Math.min((weeklyCount / 4) * 100, 100));
  const lastWeeklySync = (weeklySyncs ?? [])[0]?.started_at ?? null;
  const daysSinceLastWeekly = lastWeeklySync ? daysBetween(now, new Date(lastWeeklySync)) : null;
  let weeklyStatus: "green" | "yellow" | "red" = "green";
  if (weeklyCount <= 1) weeklyStatus = "red";
  else if (weeklyCount <= 3) weeklyStatus = "yellow";

  metrics.push({
    cadence_type: "weekly_sync",
    label: "Weekly Sync",
    expected_frequency: "weekly",
    last_completed_at: lastWeeklySync,
    days_since_last: daysSinceLastWeekly,
    is_overdue: daysSinceLastWeekly !== null ? daysSinceLastWeekly > 9 : true,
    compliance_rate: weeklyRate,
    status: weeklyStatus,
  });

  // 4. Monthly Review
  const monthlyCount = (monthlyReviews ?? []).length;
  const monthlyRate = Math.round(Math.min((monthlyCount / 3) * 100, 100));
  const lastMonthlyReview = (monthlyReviews ?? [])[0]?.started_at ?? null;
  const daysSinceLastMonthly = lastMonthlyReview ? daysBetween(now, new Date(lastMonthlyReview)) : null;
  let monthlyStatus: "green" | "yellow" | "red" = "green";
  if (monthlyCount <= 1) monthlyStatus = "red";
  else if (monthlyCount <= 2) monthlyStatus = "yellow";

  metrics.push({
    cadence_type: "monthly_review",
    label: "Monthly Review",
    expected_frequency: "monthly",
    last_completed_at: lastMonthlyReview,
    days_since_last: daysSinceLastMonthly,
    is_overdue: daysSinceLastMonthly !== null ? daysSinceLastMonthly > 35 : true,
    compliance_rate: monthlyRate,
    status: monthlyStatus,
  });

  // 5. Quarterly Summit
  const quarterlyCount = (quarterlySummits ?? []).length;
  const quarterlyRate = Math.round(Math.min((quarterlyCount / 4) * 100, 100));
  const lastQuarterlySummit = (quarterlySummits ?? [])[0]?.started_at ?? null;
  const daysSinceLastQuarterly = lastQuarterlySummit ? daysBetween(now, new Date(lastQuarterlySummit)) : null;
  let quarterlyStatus: "green" | "yellow" | "red" = "green";
  if (quarterlyCount <= 1) quarterlyStatus = "red";
  else if (quarterlyCount <= 2) quarterlyStatus = "yellow";

  metrics.push({
    cadence_type: "quarterly_summit",
    label: "Quarterly Summit",
    expected_frequency: "quarterly",
    last_completed_at: lastQuarterlySummit,
    days_since_last: daysSinceLastQuarterly,
    is_overdue: daysSinceLastQuarterly !== null ? daysSinceLastQuarterly > 100 : true,
    compliance_rate: quarterlyRate,
    status: quarterlyStatus,
  });

  // Overall score: average compliance
  const overall_score = Math.round(
    metrics.reduce((sum, m) => sum + m.compliance_rate, 0) / metrics.length
  );

  return {
    venture_id: ventureId,
    metrics,
    overall_score,
    overall_status: overallStatusFromScore(overall_score),
  };
}
