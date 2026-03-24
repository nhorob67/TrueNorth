import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { redirect } from "next/navigation";
import { QuarterlySummitView } from "./quarterly-summit-view";

export default async function QuarterlySummitPage() {
  const supabase = await createClient();
  const userCtx = await getCachedUserContext();
  if (!userCtx) redirect("/login");

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Vision data (BHAG, strategic filters, annual outcomes, not doing list)
  const { data: vision } = await supabase
    .from("visions")
    .select("id, bhag, strategic_filters, annual_outcomes, not_doing_list, year, locked")
    .eq("venture_id", userCtx.ventureId)
    .order("year", { ascending: false })
    .limit(1)
    .single();

  // Active bets with moves
  const { data: activeBets } = await supabase
    .from("bets")
    .select(
      "id, outcome, health_status, owner_id, lifecycle_status, moves(id, title, lifecycle_status, health_status, type, owner_id)"
    )
    .eq("venture_id", userCtx.ventureId)
    .eq("lifecycle_status", "active")
    .order("created_at");

  // Completed/killed bets this quarter
  const { data: closedBets } = await supabase
    .from("bets")
    .select("id, outcome, health_status, owner_id, lifecycle_status, updated_at")
    .eq("venture_id", userCtx.ventureId)
    .in("lifecycle_status", ["completed", "killed"])
    .gte("updated_at", ninetyDaysAgo);

  // Full KPI scoreboard
  const { data: allKpis } = await supabase
    .from("kpis")
    .select("id, name, health_status, current_value, target, unit, owner_id, lifecycle_status")
    .eq("lifecycle_status", "active")
    .order("name");

  // KPI snapshots for quarterly trends
  const { data: kpiSnapshots } = await supabase
    .from("kpi_snapshots")
    .select("kpi_id, value, snapshot_date")
    .eq("organization_id", userCtx.orgId)
    .gte("snapshot_date", ninetyDaysAgo)
    .order("snapshot_date");

  // Idea vault candidates
  const { data: ideaCandidates } = await supabase
    .from("ideas")
    .select("id, name, description, classification, score_total, score_alignment, score_revenue, score_effort, lifecycle_status, submitter_id, created_at")
    .eq("organization_id", userCtx.orgId)
    .eq("lifecycle_status", "candidate")
    .order("score_total", { ascending: false });

  // Role cards
  const { data: roleCards } = await supabase
    .from("role_cards")
    .select("id, entity_id, entity_type, outcomes_owned, metrics_moved, decision_authority, commitments_standard")
    .eq("organization_id", userCtx.orgId);

  // Team members
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
    <QuarterlySummitView
      vision={vision ? {
        id: vision.id as string,
        bhag: vision.bhag as string,
        strategic_filters: (vision.strategic_filters ?? []) as Array<{ id: string; name: string; description: string }>,
        annual_outcomes: (vision.annual_outcomes ?? []) as Array<{ id: string; description: string; constraints: Record<string, string> }>,
        not_doing_list: (vision.not_doing_list ?? []) as string[],
        year: vision.year as number,
        locked: vision.locked as boolean,
      } : null}
      activeBets={(activeBets ?? []).map((b: Record<string, unknown>) => ({
        id: b.id as string,
        outcome: b.outcome as string,
        health_status: b.health_status as "green" | "yellow" | "red",
        owner_id: b.owner_id as string,
        lifecycle_status: b.lifecycle_status as string,
        moves: (b.moves ?? []) as Array<{
          id: string;
          title: string;
          lifecycle_status: string;
          health_status: string;
          type: string;
          owner_id: string;
        }>,
      }))}
      closedBets={(closedBets ?? []).map((b) => ({
        id: b.id,
        outcome: b.outcome,
        health_status: b.health_status as "green" | "yellow" | "red",
        owner_id: b.owner_id,
        lifecycle_status: b.lifecycle_status,
        updated_at: b.updated_at,
      }))}
      kpis={allKpis ?? []}
      kpiSnapshots={kpiSnapshots ?? []}
      ideaCandidates={(ideaCandidates ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description ?? "",
        classification: i.classification,
        score_total: i.score_total,
        score_alignment: i.score_alignment,
        score_revenue: i.score_revenue,
        score_effort: i.score_effort,
        lifecycle_status: i.lifecycle_status,
        submitter_id: i.submitter_id,
        created_at: i.created_at,
      }))}
      roleCards={(roleCards ?? []).map((r) => ({
        id: r.id,
        entity_id: r.entity_id,
        entity_type: r.entity_type as "user" | "agent",
        outcomes_owned: (r.outcomes_owned ?? []) as string[],
        metrics_moved: (r.metrics_moved ?? []) as string[],
        decision_authority: (r.decision_authority ?? "") as string,
        commitments_standard: (r.commitments_standard ?? "") as string,
      }))}
      teamMembers={teamMembers}
    />
  );
}
