import { createClient } from "@/lib/supabase/server";
import { BetsWarRoom } from "./bets-view";

export default async function BetsPage() {
  const supabase = await createClient();

  const { data: bets } = await supabase
    .from("bets")
    .select(
      "*, moves(id, title, lifecycle_status, health_status, due_date, owner_id)"
    )
    .eq("lifecycle_status", "active")
    .order("created_at");

  return <BetsWarRoom bets={bets ?? []} />;
}
