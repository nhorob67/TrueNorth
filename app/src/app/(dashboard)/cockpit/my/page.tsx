import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { MyCockpitView } from "./my-cockpit-view";

export default async function MyCockpitPage() {
  const ctx = await getCachedUserContext();
  if (!ctx) return null;

  const supabase = await getCachedClient();

  const [
    { data: myMoves, error: e1 },
    { data: myKpis, error: e2 },
    { data: myBlockers, error: e3 },
    { data: profile, error: e4 },
  ] = await Promise.all([
    supabase
      .from("moves")
      .select("id, title, lifecycle_status, health_status, due_date, bets(outcome)")
      .eq("owner_id", ctx.userId)
      .in("lifecycle_status", ["not_started", "in_progress"])
      .order("due_date"),
    supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, unit")
      .eq("owner_id", ctx.userId)
      .eq("lifecycle_status", "active"),
    supabase
      .from("blockers")
      .select("id, description, severity")
      .eq("owner_id", ctx.userId)
      .eq("resolution_state", "open"),
    supabase
      .from("user_profiles")
      .select("pulse_streak")
      .eq("id", ctx.userId)
      .single(),
  ]);

  const firstError = e1 || e2 || e3 || e4;
  if (firstError) throw firstError;

  return (
    <MyCockpitView
      moves={(myMoves ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        bets: Array.isArray(m.bets)
          ? (m.bets as Array<{ outcome: string }>)[0] ?? null
          : m.bets,
      })) as Array<{
        id: string;
        title: string;
        lifecycle_status: string;
        health_status: string;
        due_date: string | null;
        bets: { outcome: string } | null;
      }>}
      kpis={myKpis ?? []}
      blockers={myBlockers ?? []}
      pulseStreak={profile?.pulse_streak ?? 0}
    />
  );
}
