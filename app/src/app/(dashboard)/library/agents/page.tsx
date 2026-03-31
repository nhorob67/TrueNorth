import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { redirect } from "next/navigation";
import { AgentsCatalogView } from "./agents-catalog-view";

export default async function AgentsCatalogPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx) redirect("/login");

  // Fetch agents
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .order("name");

  // Fetch approved skill counts
  const { data: skills } = await supabase
    .from("agent_skills")
    .select("agent_profile")
    .eq("organization_id", ctx.orgId)
    .eq("approved", true);

  const skillCountMap = new Map<string, number>();
  for (const row of skills ?? []) {
    skillCountMap.set(
      row.agent_profile,
      (skillCountMap.get(row.agent_profile) ?? 0) + 1
    );
  }

  // Fetch workflow counts per agent profile
  const { data: workflows } = await supabase
    .from("workflow_templates")
    .select("steps")
    .eq("organization_id", ctx.orgId)
    .eq("enabled", true);

  const workflowCountMap = new Map<string, number>();
  for (const wf of workflows ?? []) {
    const steps = wf.steps as Array<{ agent_profile?: string }>;
    const profiles = new Set(steps.map((s) => s.agent_profile).filter(Boolean));
    for (const profile of profiles) {
      workflowCountMap.set(profile!, (workflowCountMap.get(profile!) ?? 0) + 1);
    }
  }

  // Fetch latest performance snapshots
  const { data: perfSnapshots } = await supabase
    .from("agent_performance_snapshots")
    .select("agent_profile, metrics")
    .eq("organization_id", ctx.orgId)
    .eq("period", "weekly")
    .order("snapshot_date", { ascending: false });

  const perfMap = new Map<string, Record<string, unknown>>();
  for (const snap of perfSnapshots ?? []) {
    if (!perfMap.has(snap.agent_profile)) {
      perfMap.set(snap.agent_profile, snap.metrics as Record<string, unknown>);
    }
  }

  // Assemble catalog entries
  const catalogAgents = (agents ?? []).map((agent) => {
    const profile = agent.hermes_profile_name ?? "";
    const metrics = perfMap.get(profile);
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description as string | null,
      category: agent.category as string,
      status: agent.status as string,
      automation_level: agent.automation_level as number,
      hermes_enabled: agent.hermes_enabled as boolean,
      capabilities: (agent.capabilities ?? []) as string[],
      approved_skill_count: skillCountMap.get(profile) ?? 0,
      workflow_count: workflowCountMap.get(profile) ?? 0,
      trust_summary: metrics
        ? {
            acceptance_rate: (metrics.acceptance_rate as number) ?? null,
            tasks_completed: (metrics.tasks_completed as number) ?? null,
          }
        : null,
    };
  });

  return <AgentsCatalogView agents={catalogAgents} />;
}
