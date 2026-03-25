import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { HomeView } from "./home-view";

export default async function HomePage() {
  const ctx = await getCachedUserContext();
  if (!ctx) return null;

  const supabase = await getCachedClient();
  const today = new Date().toISOString().split("T")[0];
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    { data: kpis, error: e1 },
    { data: atRiskBets, error: e2 },
    { data: missedCommitments, error: e3 },
    { data: myTodos, error: e4 },
    { data: myMoves, error: e5 },
    { data: recentActivity, error: e6 },
    { data: lastMeeting, error: e7 },
    { data: upcomingDeadlines, error: e8 },
  ] = await Promise.all([
    // All active KPIs for scoreboard snapshot
    supabase
      .from("kpis")
      .select("id, name, unit, tier, current_value, target, health_status")
      .eq("lifecycle_status", "active")
      .order("tier")
      .order("name"),
    // At-risk bets
    supabase
      .from("bets")
      .select("id, outcome, health_status, lifecycle_status")
      .eq("lifecycle_status", "active")
      .in("health_status", ["yellow", "red"])
      .order("health_status"),
    // Missed commitments
    supabase
      .from("commitments")
      .select("id, description, owner_id, due_date, status")
      .eq("status", "missed")
      .order("due_date", { ascending: false })
      .limit(10),
    // My active todos
    supabase
      .from("todos")
      .select("id, title, priority, due_date, completed, linked_entity_type, linked_entity_id")
      .eq("user_id", ctx.userId)
      .eq("completed", false)
      .order("due_date")
      .limit(15),
    // My moves due soon
    supabase
      .from("moves")
      .select("id, title, due_date, health_status, lifecycle_status, bets(outcome)")
      .eq("owner_id", ctx.userId)
      .in("lifecycle_status", ["not_started", "in_progress"])
      .lte("due_date", weekFromNow)
      .order("due_date"),
    // Recent activity relevant to user
    supabase
      .from("comments")
      .select("id, body, entity_type, entity_id, created_at, author_id, user_profiles(full_name)")
      .eq("author_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(5),
    // Last meeting log
    supabase
      .from("meeting_logs")
      .select("id, meeting_type, started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Moves due this week (all, not just mine)
    supabase
      .from("moves")
      .select("id, title, due_date, owner_id, user_profiles(full_name)")
      .in("lifecycle_status", ["not_started", "in_progress"])
      .gte("due_date", today)
      .lte("due_date", weekFromNow)
      .order("due_date")
      .limit(10),
  ]);

  const firstError = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8;
  if (firstError) throw firstError;

  // Compute next sync date from last meeting
  let nextSyncLabel: string | null = null;
  if (lastMeeting?.started_at) {
    const lastDate = new Date(lastMeeting.started_at);
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + 7);
    nextSyncLabel = `Next Sync: ${nextDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
  }

  return (
    <HomeView
      kpis={kpis ?? []}
      atRiskBets={atRiskBets ?? []}
      missedCommitments={missedCommitments ?? []}
      myTodos={myTodos ?? []}
      myMoves={(myMoves ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        bets: Array.isArray(m.bets)
          ? (m.bets as Array<{ outcome: string }>)[0] ?? null
          : m.bets,
      })) as Array<{
        id: string;
        title: string;
        due_date: string | null;
        health_status: string;
        lifecycle_status: string;
        bets: { outcome: string } | null;
      }>}
      recentActivity={(recentActivity ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        user_profiles: Array.isArray(c.user_profiles)
          ? (c.user_profiles as Array<{ full_name: string }>)[0] ?? null
          : c.user_profiles,
      })) as Array<{
        id: string;
        body: string;
        entity_type: string;
        entity_id: string;
        created_at: string;
        author_id: string;
        user_profiles: { full_name: string } | null;
      }>}
      nextSyncLabel={nextSyncLabel}
      upcomingDeadlines={(upcomingDeadlines ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        user_profiles: Array.isArray(m.user_profiles)
          ? (m.user_profiles as Array<{ full_name: string }>)[0] ?? null
          : m.user_profiles,
      })) as Array<{
        id: string;
        title: string;
        due_date: string | null;
        owner_id: string;
        user_profiles: { full_name: string } | null;
      }>}
    />
  );
}
