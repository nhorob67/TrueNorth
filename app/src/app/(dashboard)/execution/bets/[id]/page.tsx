import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BetDetailView } from "./bet-detail-view";

export default async function BetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: bet, error: e1 },
    { data: blockers, error: e2 },
  ] = await Promise.all([
    supabase
      .from("bets")
      .select(
        "*, moves(id, title, description, lifecycle_status, health_status, due_date, owner_id, type, position, cut_reason, kpi_link_ids, effort_estimate, cadence, target_per_cycle, move_instances(id, move_id, cycle_start, cycle_end, status, completed_at, notes))"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("blockers")
      .select("*")
      .eq("linked_entity_type", "bet")
      .eq("linked_entity_id", id)
      .eq("resolution_state", "open"),
  ]);

  if (e1 || e2) throw (e1 || e2);
  if (!bet) notFound();

  return <BetDetailView bet={bet} blockers={blockers ?? []} />;
}
