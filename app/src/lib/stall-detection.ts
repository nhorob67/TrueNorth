import { SupabaseClient } from "@supabase/supabase-js";

export interface StalledBet {
  betId: string;
  betOutcome: string;
  ownerId: string;
  reason: string;
}

/**
 * Detects bets that have stalled — no milestone shipped in 10+ days AND
 * no recurring move instance completed in the current cycle.
 */
export async function detectStalledBets(
  supabase: SupabaseClient,
  orgId: string,
  ventureId?: string
): Promise<StalledBet[]> {
  let betQuery = supabase
    .from("bets")
    .select("id, outcome, owner_id")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active");

  if (ventureId) {
    betQuery = betQuery.eq("venture_id", ventureId);
  }

  const { data: bets } = await betQuery;
  if (!bets || bets.length === 0) return [];

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().split("T")[0];

  const stalledBets: StalledBet[] = [];

  for (const bet of bets) {
    // Check for recently shipped milestones
    const { count: shippedCount } = await supabase
      .from("moves")
      .select("id", { count: "exact", head: true })
      .eq("bet_id", bet.id)
      .eq("lifecycle_status", "shipped")
      .gte("updated_at", tenDaysAgo);

    const hasRecentShipment = (shippedCount ?? 0) > 0;

    // Check for recurring move instances completed in current cycle
    const { data: recurringMoves } = await supabase
      .from("moves")
      .select("id")
      .eq("bet_id", bet.id)
      .eq("type", "recurring")
      .in("lifecycle_status", ["not_started", "in_progress"]);

    let hasCurrentCycleCompletion = false;

    if (recurringMoves && recurringMoves.length > 0) {
      const moveIds = recurringMoves.map((m) => m.id);
      const { count: instanceCount } = await supabase
        .from("move_instances")
        .select("id", { count: "exact", head: true })
        .in("move_id", moveIds)
        .eq("status", "completed")
        .gte("cycle_end", today);

      hasCurrentCycleCompletion = (instanceCount ?? 0) > 0;
    }

    if (!hasRecentShipment && !hasCurrentCycleCompletion) {
      const reasons: string[] = [];
      reasons.push("No milestone shipped in 10+ days");
      if (recurringMoves && recurringMoves.length > 0) {
        reasons.push("No recurring instances completed in current cycle");
      }
      stalledBets.push({
        betId: bet.id,
        betOutcome: bet.outcome,
        ownerId: bet.owner_id,
        reason: reasons.join("; "),
      });
    }
  }

  return stalledBets;
}
