import { createClient } from "@/lib/supabase/server";
import { NewProcessView } from "./new-process-view";

export default async function NewProcessPage() {
  const supabase = await createClient();

  // Fetch available KPIs and Bets for linking
  const [{ data: kpis }, { data: bets }] = await Promise.all([
    supabase.from("kpis").select("id, name").order("name"),
    supabase
      .from("bets")
      .select("id, outcome")
      .eq("lifecycle_status", "active")
      .order("created_at"),
  ]);

  return (
    <NewProcessView
      availableKpis={kpis ?? []}
      availableBets={bets ?? []}
    />
  );
}
