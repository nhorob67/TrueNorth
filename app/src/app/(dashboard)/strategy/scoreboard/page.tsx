import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { ScoreboardView } from "./scoreboard-view";

export const dynamic = "force-dynamic";

export default async function ScoreboardPage() {
  const [supabase, ctx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) {
    return <p className="text-subtle p-8">Please sign in to view the scoreboard.</p>;
  }

  const { data: kpis } = await supabase
    .from("kpis")
    .select("*, kpi_entries(value, recorded_at)")
    .eq("venture_id", ctx.ventureId)
    .eq("lifecycle_status", "active")
    .order("display_order")
    .order("tier", { ascending: true })
    .order("name");

  return <ScoreboardView kpis={kpis ?? []} />;
}
