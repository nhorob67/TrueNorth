import { createClient } from "@/lib/supabase/server";
import { GraveyardView } from "./graveyard-view";

export default async function GraveyardPage() {
  const supabase = await createClient();

  // Fetch killed bets (lifecycle_status = completed + has kill_reason)
  const { data: killedBets } = await supabase
    .from("bets")
    .select(
      "id, outcome, mechanism, quarter, owner_id, health_status, created_at, killed_at, kill_reason, resource_cap, moves(id, effort_estimate, lifecycle_status)"
    )
    .eq("lifecycle_status", "completed")
    .not("killed_at", "is", null)
    .order("killed_at", { ascending: false });

  return <GraveyardView killedBets={killedBets ?? []} />;
}
