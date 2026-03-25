import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

// Helper: compute days between two ISO date strings
function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24);
}

// ============================================================
// Decision Velocity Drill-Down
// ============================================================
async function drillDecisionVelocity(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  ventureId: string | null,
  windowDays: number
) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Decided decisions in window
  let decidedQuery = supabase
    .from("decisions")
    .select("id, title, created_at, decided_at, assigned_to, profiles:user_profiles!decisions_assigned_to_fkey(full_name)")
    .eq("organization_id", orgId)
    .not("decided_at", "is", null)
    .gte("decided_at", windowStart)
    .order("decided_at", { ascending: false });

  // Open (undecided) decisions
  let openQuery = supabase
    .from("decisions")
    .select("id, title, created_at, assigned_to, profiles:user_profiles!decisions_assigned_to_fkey(full_name)")
    .eq("organization_id", orgId)
    .is("decided_at", null)
    .order("created_at", { ascending: true });

  if (ventureId) {
    decidedQuery = decidedQuery.eq("venture_id", ventureId);
    openQuery = openQuery.eq("venture_id", ventureId);
  }

  const [{ data: decided }, { data: open }] = await Promise.all([decidedQuery, openQuery]);

  // Build histogram buckets
  const buckets = { "<1d": 0, "1-3d": 0, "3-7d": 0, "7+d": 0 };
  const perPerson: Record<string, { name: string; totalDays: number; count: number }> = {};

  for (const d of decided ?? []) {
    const days = daysBetween(d.created_at, d.decided_at!);
    if (days < 1) buckets["<1d"]++;
    else if (days < 3) buckets["1-3d"]++;
    else if (days < 7) buckets["3-7d"]++;
    else buckets["7+d"]++;

    const assignee = d.assigned_to ?? "unassigned";
    const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    const name = profile?.full_name ?? "Unassigned";
    if (!perPerson[assignee]) perPerson[assignee] = { name, totalDays: 0, count: 0 };
    perPerson[assignee].totalDays += days;
    perPerson[assignee].count++;
  }

  const perPersonAverages = Object.entries(perPerson).map(([userId, data]) => ({
    user_id: userId,
    name: data.name,
    avg_days: Math.round((data.totalDays / data.count) * 10) / 10,
    count: data.count,
  })).sort((a, b) => b.avg_days - a.avg_days);

  // Slowest open decisions
  const slowestOpen = (open ?? []).slice(0, 10).map((d) => {
    const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    return {
      id: d.id,
      title: d.title,
      days_open: Math.round(daysBetween(d.created_at, new Date().toISOString()) * 10) / 10,
      assigned_to: profile?.full_name ?? "Unassigned",
    };
  });

  return { histogram: buckets, slowest_open: slowestOpen, per_person_averages: perPersonAverages };
}

// ============================================================
// Blocker Half-Life Drill-Down
// ============================================================
async function drillBlockerHalfLife(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  windowDays: number
) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Resolved blockers
  const { data: resolved } = await supabase
    .from("blockers")
    .select("id, title, severity, created_at, resolved_at, owner_id, profiles:user_profiles!blockers_owner_id_fkey(full_name)")
    .eq("organization_id", orgId)
    .not("resolved_at", "is", null)
    .gte("resolved_at", windowStart)
    .order("resolved_at", { ascending: false });

  // Open blockers
  const { data: open } = await supabase
    .from("blockers")
    .select("id, title, severity, created_at, owner_id, profiles:user_profiles!blockers_owner_id_fkey(full_name)")
    .eq("organization_id", orgId)
    .is("resolved_at", null)
    .order("created_at", { ascending: true });

  // Resolution time by severity
  const bySeverity: Record<string, { total: number; count: number }> = {
    critical: { total: 0, count: 0 },
    high: { total: 0, count: 0 },
    medium: { total: 0, count: 0 },
    low: { total: 0, count: 0 },
  };

  const perPerson: Record<string, { name: string; totalDays: number; count: number }> = {};

  for (const b of resolved ?? []) {
    const days = daysBetween(b.created_at, b.resolved_at!);
    const sev = b.severity ?? "medium";
    if (bySeverity[sev]) {
      bySeverity[sev].total += days;
      bySeverity[sev].count++;
    }

    const ownerId = b.owner_id ?? "unassigned";
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    const name = profile?.full_name ?? "Unassigned";
    if (!perPerson[ownerId]) perPerson[ownerId] = { name, totalDays: 0, count: 0 };
    perPerson[ownerId].totalDays += days;
    perPerson[ownerId].count++;
  }

  const severityBreakdown = Object.entries(bySeverity).map(([severity, data]) => ({
    severity,
    avg_days: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
    count: data.count,
  }));

  const perPersonSpeed = Object.entries(perPerson).map(([userId, data]) => ({
    user_id: userId,
    name: data.name,
    avg_days: Math.round((data.totalDays / data.count) * 10) / 10,
    count: data.count,
  })).sort((a, b) => a.avg_days - b.avg_days);

  const longestOpen = (open ?? []).slice(0, 10).map((b) => {
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    return {
      id: b.id,
      title: b.title,
      severity: b.severity ?? "medium",
      days_open: Math.round(daysBetween(b.created_at, new Date().toISOString()) * 10) / 10,
      owner: profile?.full_name ?? "Unassigned",
    };
  });

  return { severity_breakdown: severityBreakdown, longest_open: longestOpen, per_person_speed: perPersonSpeed };
}

// ============================================================
// Strategy Connection Rate Drill-Down
// ============================================================
async function drillStrategyConnection(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  ventureId: string | null,
  windowDays: number
) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  let pulsesQuery = supabase
    .from("pulses")
    .select("id, date, user_id, items, profiles:user_profiles!pulses_user_id_fkey(full_name)")
    .eq("organization_id", orgId)
    .gte("date", windowStart)
    .order("date", { ascending: true });

  if (ventureId) {
    pulsesQuery = pulsesQuery.eq("venture_id", ventureId);
  }

  const { data: pulses } = await pulsesQuery;

  // Per-user connection rates
  const perUser: Record<string, { name: string; totalItems: number; linkedItems: number }> = {};
  // Daily rates
  const dailyRates: Record<string, { total: number; linked: number }> = {};

  for (const pulse of pulses ?? []) {
    const profile = Array.isArray(pulse.profiles) ? pulse.profiles[0] : pulse.profiles;
    const userId = pulse.user_id ?? "unknown";
    const name = profile?.full_name ?? "Unknown";

    if (!perUser[userId]) perUser[userId] = { name, totalItems: 0, linkedItems: 0 };
    if (!dailyRates[pulse.date]) dailyRates[pulse.date] = { total: 0, linked: 0 };

    const items = pulse.items as Array<{ linked_entity_ids?: string[] }> | null;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        perUser[userId].totalItems++;
        dailyRates[pulse.date].total++;
        if (item.linked_entity_ids && item.linked_entity_ids.length > 0) {
          perUser[userId].linkedItems++;
          dailyRates[pulse.date].linked++;
        }
      }
    }
  }

  const teamHeatmap = Object.entries(perUser).map(([userId, data]) => ({
    user_id: userId,
    name: data.name,
    connection_rate: data.totalItems > 0 ? Math.round((data.linkedItems / data.totalItems) * 100) : 0,
    total_items: data.totalItems,
    linked_items: data.linkedItems,
  })).sort((a, b) => b.connection_rate - a.connection_rate);

  const dailyTrend = Object.entries(dailyRates)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      rate: data.total > 0 ? Math.round((data.linked / data.total) * 100) : 0,
    }));

  return { team_heatmap: teamHeatmap, daily_trend: dailyTrend };
}

// ============================================================
// Execution Cadence Drill-Down
// ============================================================
async function drillExecutionCadence(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  ventureId: string,
  windowDays: number
) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const windowStartDate = windowStart.split("T")[0];

  // Pulse rate
  const { data: pulses } = await supabase
    .from("pulses")
    .select("date, user_id")
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .gte("date", windowStartDate);

  const uniquePulseDays = new Set((pulses ?? []).map((p) => p.date)).size;
  const pulseRate = Math.min(100, Math.round((uniquePulseDays / windowDays) * 100));

  // KPI update rate (% of KPIs updated in window)
  const { data: kpis } = await supabase
    .from("kpis")
    .select("id, updated_at")
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .eq("lifecycle_status", "active");

  const kpisUpdated = (kpis ?? []).filter((k) => new Date(k.updated_at) >= new Date(windowStart)).length;
  const kpiRate = (kpis ?? []).length > 0 ? Math.round((kpisUpdated / (kpis ?? []).length) * 100) : 100;

  // Sync attendance
  const { count: syncCount } = await supabase
    .from("meeting_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("meeting_type", "weekly_sync")
    .gte("started_at", windowStart);

  const expectedSyncs = Math.floor(windowDays / 7);
  const syncRate = expectedSyncs > 0 ? Math.min(100, Math.round(((syncCount ?? 0) / expectedSyncs) * 100)) : 100;

  // Commitment completion
  const { data: commitments } = await supabase
    .from("commitments")
    .select("id, title, status, due_date, user_id, profiles:user_profiles!commitments_user_id_fkey(full_name)")
    .eq("organization_id", orgId)
    .in("status", ["completed", "missed"])
    .gte("updated_at", windowStart)
    .order("due_date", { ascending: false })
    .limit(50);

  const completed = (commitments ?? []).filter((c) => c.status === "completed").length;
  const commitmentRate = (commitments ?? []).length > 0 ? Math.round((completed / (commitments ?? []).length) * 100) : 100;

  // Missed cadence log: recent missed commitments
  const missedLog = (commitments ?? [])
    .filter((c) => c.status === "missed")
    .slice(0, 10)
    .map((c) => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return {
        id: c.id,
        title: c.title,
        due_date: c.due_date,
        owner: profile?.full_name ?? "Unknown",
      };
    });

  return {
    breakdown: {
      pulse_rate: pulseRate,
      kpi_update_rate: kpiRate,
      sync_attendance_rate: syncRate,
      commitment_completion_rate: commitmentRate,
    },
    missed_cadence_log: missedLog,
  };
}

// ============================================================
// Cross-Venture Collaboration Drill-Down
// ============================================================
async function drillCrossVenture(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  windowDays: number
) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: comments } = await supabase
    .from("comments")
    .select("id, user_id, venture_id, created_at, profiles:user_profiles!comments_user_id_fkey(full_name)")
    .eq("organization_id", orgId)
    .not("venture_id", "is", null)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(200);

  // Group by user -> ventures they commented on
  const userVentures: Record<string, { name: string; ventures: Set<string>; count: number }> = {};

  for (const c of comments ?? []) {
    const userId = c.user_id ?? "unknown";
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const name = profile?.full_name ?? "Unknown";

    if (!userVentures[userId]) userVentures[userId] = { name, ventures: new Set(), count: 0 };
    userVentures[userId].ventures.add(c.venture_id!);
    userVentures[userId].count++;
  }

  const topCollaborators = Object.entries(userVentures)
    .filter(([, data]) => data.ventures.size > 1)
    .map(([userId, data]) => ({
      user_id: userId,
      name: data.name,
      ventures_touched: data.ventures.size,
      comment_count: data.count,
    }))
    .sort((a, b) => b.ventures_touched - a.ventures_touched)
    .slice(0, 15);

  // All collaborators for reference table
  const allCollaborators = Object.entries(userVentures)
    .map(([userId, data]) => ({
      user_id: userId,
      name: data.name,
      ventures_touched: data.ventures.size,
      comment_count: data.count,
    }))
    .sort((a, b) => b.comment_count - a.comment_count)
    .slice(0, 20);

  return { top_collaborators: topCollaborators, all_commenters: allCollaborators };
}

// ============================================================
// Kill Courage Drill-Down
// ============================================================
async function drillKillCourage(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  ventureId: string | null
) {
  let query = supabase
    .from("bets")
    .select("id, title, lifecycle_status, health_status, killed_at, created_at, updated_at")
    .eq("organization_id", orgId)
    .in("lifecycle_status", ["completed", "active"])
    .order("updated_at", { ascending: false })
    .limit(30);

  if (ventureId) query = query.eq("venture_id", ventureId);

  const { data: bets } = await query;

  const timeline = (bets ?? []).map((b) => {
    let action: "killed" | "completed" | "active" = "active";
    if (b.killed_at) action = "killed";
    else if (b.lifecycle_status === "completed") action = "completed";

    return {
      id: b.id,
      title: b.title,
      action,
      health_at_decision: b.health_status,
      date: b.killed_at ?? b.updated_at,
      created_at: b.created_at,
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const killed = timeline.filter((t) => t.action === "killed");
  const completed = timeline.filter((t) => t.action === "completed");
  const limping = timeline.filter((t) => t.action === "active" && t.health_at_decision === "red");

  return {
    timeline,
    summary: {
      killed_count: killed.length,
      completed_count: completed.length,
      limping_count: limping.length,
    },
  };
}

// ============================================================
// Route Handler
// ============================================================
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric");
    const windowDays = parseInt(searchParams.get("windowDays") ?? "30", 10);
    const ventureId = searchParams.get("ventureId") ?? ctx.ventureId;

    if (!metric) {
      return NextResponse.json({ error: "metric param required" }, { status: 400 });
    }

    let data: unknown;

    switch (metric) {
      case "decision_velocity":
        data = await drillDecisionVelocity(supabase, ctx.orgId, ventureId, windowDays);
        break;
      case "blocker_half_life":
        data = await drillBlockerHalfLife(supabase, ctx.orgId, windowDays);
        break;
      case "strategy_connection_rate":
        data = await drillStrategyConnection(supabase, ctx.orgId, ventureId, windowDays);
        break;
      case "execution_cadence_health":
        data = await drillExecutionCadence(supabase, ctx.orgId, ventureId, windowDays);
        break;
      case "cross_venture_collaboration":
        data = await drillCrossVenture(supabase, ctx.orgId, windowDays);
        break;
      case "kill_courage":
        data = await drillKillCourage(supabase, ctx.orgId, ventureId);
        break;
      default:
        return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 });
    }

    return NextResponse.json({ metric, windowDays, data });
  } catch (error) {
    console.error("Health drill-down error:", error);
    return NextResponse.json({ error: "Failed to fetch drill-down data" }, { status: 500 });
  }
}
