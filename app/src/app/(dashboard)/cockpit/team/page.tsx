import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { TeamCockpitView } from "./team-cockpit-view";

export default async function TeamCockpitPage() {
  const ctx = await getCachedUserContext();
  if (!ctx) return null;

  const supabase = await getCachedClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: teamMembers, error: e1 },
    { data: moves, error: e2 },
    { data: kpis, error: e3 },
    { data: pulses, error: e4 },
    { data: blockers, error: e5 },
    { data: agents, error: e6 },
  ] = await Promise.all([
    supabase
      .from("venture_memberships")
      .select("user_id, role, user_profiles(full_name)")
      .eq("venture_id", ctx.ventureId),
    supabase
      .from("moves")
      .select("id, title, lifecycle_status, health_status, due_date, owner_id, bets(outcome)")
      .eq("venture_id", ctx.ventureId)
      .in("lifecycle_status", ["not_started", "in_progress"])
      .order("due_date"),
    supabase
      .from("kpis")
      .select("id, name, health_status, owner_id")
      .eq("venture_id", ctx.ventureId)
      .eq("lifecycle_status", "active"),
    supabase
      .from("pulses")
      .select("user_id")
      .eq("organization_id", ctx.orgId)
      .eq("date", today),
    supabase
      .from("blockers")
      .select("id, description, severity, owner_id")
      .eq("organization_id", ctx.orgId)
      .eq("resolution_state", "open"),
    supabase
      .from("agents")
      .select("id, name, description, category, status")
      .eq("organization_id", ctx.orgId)
      .eq("status", "active"),
  ]);

  const firstError = e1 || e2 || e3 || e4 || e5 || e6;
  if (firstError) throw firstError;

  return (
    <TeamCockpitView
      teamMembers={(teamMembers ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        user_profiles: Array.isArray(m.user_profiles)
          ? (m.user_profiles as Array<{ full_name: string }>)[0] ?? null
          : m.user_profiles,
      })) as Array<{
        user_id: string;
        role: string;
        user_profiles: { full_name: string } | null;
      }>}
      moves={(moves ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        bets: Array.isArray(m.bets)
          ? (m.bets as Array<{ outcome: string }>)[0] ?? null
          : m.bets,
      })) as Array<{
        id: string;
        title: string;
        lifecycle_status: string;
        health_status: string;
        due_date: string | null;
        owner_id: string;
        bets: { outcome: string } | null;
      }>}
      kpis={kpis ?? []}
      pulseUserIds={(pulses ?? []).map((p: { user_id: string }) => p.user_id)}
      blockers={blockers ?? []}
      agents={agents ?? []}
    />
  );
}
