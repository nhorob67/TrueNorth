import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { redirect } from "next/navigation";
import { MonthlyReviewView } from "./monthly-review-view";

export default async function MonthlyReviewPage() {
  const supabase = await createClient();
  const userCtx = await getCachedUserContext();
  if (!userCtx) redirect("/login");

  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line react-hooks/purity
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

  // All active KPIs with current status
  const { data: kpis } = await supabase
    .from("kpis")
    .select("id, name, health_status, current_value, target, unit, owner_id")
    .eq("lifecycle_status", "active")
    .order("name");

  // KPI snapshots for trailing 4 weeks (trends)
  const { data: kpiSnapshots } = await supabase
    .from("kpi_snapshots")
    .select("kpi_id, value, snapshot_date")
    .eq("organization_id", userCtx.orgId)
    .gte("snapshot_date", fourWeeksAgo)
    .order("snapshot_date");

  // Active bets with move progress
  const { data: bets } = await supabase
    .from("bets")
    .select(
      "id, outcome, health_status, owner_id, moves(id, title, lifecycle_status, health_status, type, cadence, target_per_cycle, owner_id, updated_at)"
    )
    .eq("lifecycle_status", "active")
    .order("created_at");

  // Commitments from last 30 days
  const { data: recentCommitments } = await supabase
    .from("commitments")
    .select("id, description, owner_id, due_date, status, created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at");

  // Killed bets from last 30 days (graveyard)
  const { data: killedBets } = await supabase
    .from("bets")
    .select("id, outcome, health_status, owner_id, updated_at")
    .eq("lifecycle_status", "killed")
    .eq("venture_id", userCtx.ventureId)
    .gte("updated_at", thirtyDaysAgo);

  // Stale artifacts
  const { data: staleArtifacts } = await supabase
    .from("core_artifacts")
    .select("id, artifact_type, name, owner_id, last_updated_at, staleness_threshold_days")
    .eq("organization_id", userCtx.orgId)
    .eq("is_stale", true);

  // Idea vault candidates scored this month
  const { data: ideaCandidates } = await supabase
    .from("ideas")
    .select("id, name, classification, score_total, lifecycle_status, submitter_id, created_at")
    .eq("organization_id", userCtx.orgId)
    .eq("lifecycle_status", "candidate")
    .order("score_total", { ascending: false });

  // Open blockers (for recurring blocker analysis)
  const { data: blockers } = await supabase
    .from("blockers")
    .select("id, description, severity, owner_id, resolution_state, created_at, linked_entity_id, linked_entity_type")
    .eq("resolution_state", "open")
    .order("created_at");

  // Moves shipped in last 30 days (wins)
  const { data: shippedMoves } = await supabase
    .from("moves")
    .select("id, title, bet_id, owner_id, updated_at")
    .eq("lifecycle_status", "shipped")
    .gte("updated_at", thirtyDaysAgo);

  // Content pipeline counts per stage
  const { data: contentPieces } = await supabase
    .from("content_pieces")
    .select("id, lifecycle_status")
    .eq("venture_id", userCtx.ventureId);

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

  // Compute commitment completion rate
  const total = (recentCommitments ?? []).length;
  const completed = (recentCommitments ?? []).filter((c) => c.status === "completed").length;
  const commitmentCompletionRate = total > 0 ? Math.round((completed / total) * 100) : null;

  // Content pipeline summary
  const contentPipeline: Record<string, number> = {};
  for (const piece of contentPieces ?? []) {
    contentPipeline[piece.lifecycle_status] = (contentPipeline[piece.lifecycle_status] ?? 0) + 1;
  }

  return (
    <MonthlyReviewView
      kpis={kpis ?? []}
      kpiSnapshots={kpiSnapshots ?? []}
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
          updated_at: string;
        }>,
      }))}
      recentCommitments={recentCommitments ?? []}
      commitmentCompletionRate={commitmentCompletionRate}
      killedBets={killedBets ?? []}
      staleArtifacts={staleArtifacts ?? []}
      ideaCandidates={ideaCandidates ?? []}
      blockers={blockers ?? []}
      shippedMoves={shippedMoves ?? []}
      contentPipeline={contentPipeline}
      teamMembers={teamMembers}
    />
  );
}
