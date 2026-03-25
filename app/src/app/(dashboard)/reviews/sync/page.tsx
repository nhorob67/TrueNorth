import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { WeeklySyncView } from "./sync-view";

export default async function SyncPage() {
  const [supabase, ctx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) return <p className="text-subtle p-8">Please sign in to access Weekly Sync.</p>;

  // Red/Yellow KPIs with action playbooks
  const { data: kpis } = await supabase
    .from("kpis")
    .select("id, name, health_status, current_value, target, unit, owner_id, action_playbook")
    .eq("lifecycle_status", "active")
    .in("health_status", ["red", "yellow"])
    .order("health_status");

  // Active bets with moves for focus check
  const { data: bets } = await supabase
    .from("bets")
    .select(
      "id, outcome, health_status, owner_id, moves(id, title, lifecycle_status, health_status, type, cadence, target_per_cycle, owner_id)"
    )
    .eq("lifecycle_status", "active")
    .order("created_at");

  // Open blockers sorted by age and severity
  const { data: blockers } = await supabase
    .from("blockers")
    .select("id, description, severity, owner_id, resolution_state, created_at, linked_entity_id, linked_entity_type")
    .eq("resolution_state", "open")
    .order("created_at");

  // Open decisions awaiting input
  const { data: decisions } = await supabase
    .from("decisions")
    .select("id, title, context, owner_id, created_at")
    .is("decided_at", null)
    .order("created_at");

  // Open issues
  const { data: issues } = await supabase
    .from("issues")
    .select("id, description, severity, owner_id, status, created_at")
    .in("status", ["open", "investigating"])
    .order("severity")
    .order("created_at");

  // Last week's commitments
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: lastWeekCommitments } = await supabase
    .from("commitments")
    .select("id, description, owner_id, due_date, status, created_at")
    .gte("created_at", sevenDaysAgo)
    .order("created_at");

  // Team members for commitment assignment
  const { data: team } = await supabase
    .from("organization_memberships")
    .select("user_id, role, user_profiles(full_name)")
    .order("role");

  const teamMembers = (team ?? []).map((m: Record<string, unknown>) => ({
    user_id: m.user_id as string,
    role: m.role as string,
    full_name: Array.isArray(m.user_profiles)
      ? ((m.user_profiles as Array<{ full_name: string }>)[0]?.full_name ?? "Unknown")
      : ((m.user_profiles as { full_name: string } | null)?.full_name ?? "Unknown"),
  }));

  return (
    <WeeklySyncView
      kpis={kpis ?? []}
      bets={(bets ?? []).map((b: Record<string, unknown>) => ({
        id: b.id as string,
        outcome: b.outcome as string,
        health_status: b.health_status as "green" | "yellow" | "red",
        owner_id: b.owner_id as string,
        moves: (b.moves ?? []) as Array<{
          id: string;
          title: string;
          lifecycle_status: string;
          health_status: string;
          type: string;
          cadence: string | null;
          target_per_cycle: number | null;
          owner_id: string;
        }>,
      }))}
      blockers={blockers ?? []}
      decisions={decisions ?? []}
      issues={issues ?? []}
      lastWeekCommitments={lastWeekCommitments ?? []}
      teamMembers={teamMembers}
    />
  );
}
