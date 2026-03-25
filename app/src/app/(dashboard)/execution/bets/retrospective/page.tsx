import { createClient } from "@/lib/supabase/server";
import { RetrospectiveView } from "./retrospective-view";

export default async function RetrospectivePage() {
  const supabase = await createClient();

  // Determine current quarter boundaries
  const now = new Date();
  const currentMonth = now.getMonth();
  const quarterStartMonth = currentMonth - (currentMonth % 3);
  const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);
  const quarterEnd = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
  const quarterLabel = `Q${Math.floor(quarterStartMonth / 3) + 1} ${now.getFullYear()}`;

  const qStart = quarterStart.toISOString();
  const qEnd = quarterEnd.toISOString();

  // Fetch bets active or completed this quarter
  const { data: bets } = await supabase
    .from("bets")
    .select("id, outcome, mechanism, health_status, lifecycle_status, created_at, killed_at, kill_reason")
    .or(`created_at.gte.${qStart},killed_at.gte.${qStart}`)
    .lte("created_at", qEnd)
    .order("created_at");

  // Fetch milestones shipped this quarter
  const { data: shippedMoves } = await supabase
    .from("moves")
    .select("id, title, type, lifecycle_status, updated_at, bet_id")
    .eq("lifecycle_status", "shipped")
    .gte("updated_at", qStart)
    .lte("updated_at", qEnd)
    .order("updated_at");

  // Fetch KPIs with current health
  const { data: kpis } = await supabase
    .from("kpis")
    .select("id, name, health_status, current_value, target, unit")
    .eq("lifecycle_status", "active")
    .order("name");

  // Fetch decisions made this quarter
  const { data: decisions } = await supabase
    .from("decisions")
    .select("id, title, final_decision, decided_at")
    .not("decided_at", "is", null)
    .gte("decided_at", qStart)
    .lte("decided_at", qEnd)
    .order("decided_at");

  // Fetch commitments completed this quarter
  const { data: commitments } = await supabase
    .from("commitments")
    .select("id, description, status, due_date")
    .eq("status", "completed")
    .gte("due_date", qStart.slice(0, 10))
    .lte("due_date", qEnd.slice(0, 10))
    .order("due_date");

  return (
    <RetrospectiveView
      quarterLabel={quarterLabel}
      bets={bets ?? []}
      shippedMoves={shippedMoves ?? []}
      kpis={kpis ?? []}
      decisions={decisions ?? []}
      commitments={commitments ?? []}
    />
  );
}
