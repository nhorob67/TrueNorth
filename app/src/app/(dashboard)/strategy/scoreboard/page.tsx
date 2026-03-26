import { createClient } from "@/lib/supabase/server";
import { ScoreboardView } from "./scoreboard-view";

export default async function ScoreboardPage() {
  const supabase = await createClient();

  const { data: kpis } = await supabase
    .from("kpis")
    .select("*, kpi_entries(value, recorded_at)")
    .eq("lifecycle_status", "active")
    .order("display_order")
    .order("tier", { ascending: true })
    .order("name");

  return <ScoreboardView kpis={kpis ?? []} />;
}
