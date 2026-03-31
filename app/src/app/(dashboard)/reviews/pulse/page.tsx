import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { PulseView } from "./pulse-view";

export default async function PulsePage() {
  const [supabase, ctx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) {
    return <p className="text-subtle p-8">Please sign in to view pulse.</p>;
  }
  const today = new Date().toISOString().split("T")[0];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? "";

  const [
    { data: myPulse },
    { data: teamPulses, error: e2 },
    { data: bets, error: e3 },
    { data: profile },
    { data: todos },
    { data: recurringMoves },
  ] = await Promise.all([
    supabase
      .from("pulses")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single(),
    supabase
      .from("pulses")
      .select("*, user_profiles(full_name, avatar_url)")
      .eq("venture_id", ctx.ventureId)
      .eq("date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("bets")
      .select("id, outcome")
      .eq("venture_id", ctx.ventureId)
      .eq("lifecycle_status", "active"),
    supabase
      .from("user_profiles")
      .select("pulse_streak")
      .eq("id", userId)
      .single(),
    // Fetch user's pending to-dos for sidebar
    supabase
      .from("todos")
      .select("id, title, completed, due_date, priority, linked_entity_type")
      .eq("user_id", userId)
      .eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    // Fetch user's active recurring moves for rhythm sidebar
    supabase
      .from("moves")
      .select("id, title, cadence, target_per_cycle, health_status, bet_id, bets(outcome)")
      .eq("owner_id", userId)
      .eq("type", "recurring")
      .eq("lifecycle_status", "in_progress")
      .limit(10),
  ]);

  const firstError = e2 || e3;
  if (firstError) console.error("Pulse query error:", firstError);

  // Build rhythm data with instance counts for current cycle
  const rhythms = [];
  if (recurringMoves && recurringMoves.length > 0) {
    for (const move of recurringMoves) {
      const { data: instances } = await supabase
        .from("move_instances")
        .select("status")
        .eq("move_id", move.id)
        // eslint-disable-next-line react-hooks/purity
        .gte("cycle_start", new Date(Date.now() - 30 * 86400000).toISOString());

      const completed = instances?.filter((i) => i.status === "completed").length ?? 0;
      const total = instances?.length ?? 0;

      const betData = Array.isArray(move.bets) ? move.bets[0] : move.bets;
      rhythms.push({
        id: move.id,
        title: move.title,
        cadence: move.cadence ?? "weekly",
        target_per_cycle: move.target_per_cycle,
        bet_outcome: betData?.outcome ?? "Unknown bet",
        health_status: (move.health_status ?? "green") as "green" | "yellow" | "red",
        instances_completed: completed,
        instances_total: total || (move.target_per_cycle ?? 1),
      });
    }
  }

  return (
    <PulseView
      myPulse={myPulse}
      teamPulses={teamPulses ?? []}
      bets={bets ?? []}
      userId={userId}
      pulseStreak={profile?.pulse_streak ?? 0}
      todos={todos ?? []}
      rhythms={rhythms}
    />
  );
}
