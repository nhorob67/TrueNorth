import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { BetsWarRoom } from "./bets-view";

export default async function BetsPage() {
  const [supabase, ctx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) {
    return <p className="text-subtle p-8">Please sign in to view bets.</p>;
  }

  const { data: bets } = await supabase
    .from("bets")
    .select(
      "*, moves(id, title, lifecycle_status, health_status, due_date, owner_id)"
    )
    .eq("venture_id", ctx.ventureId)
    .eq("lifecycle_status", "active")
    .order("created_at");

  return <BetsWarRoom bets={bets ?? []} />;
}
