import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { redirect, notFound } from "next/navigation";
import { AgentDetailView } from "./agent-detail-view";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx) redirect("/login");

  // Fetch agent
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("organization_id", ctx.orgId)
    .single();

  if (!agent) notFound();

  const profile = (agent.hermes_profile_name ?? "") as string;

  // Parallel fetches
  const [
    { data: approvedSkills },
    { data: workflows },
    { data: knowledgeAccess },
    { data: perfSnapshots },
    { data: recentTasks },
  ] = await Promise.all([
    supabase
      .from("agent_skills")
      .select("id, skill_name, skill_description, source, version, shared, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("agent_profile", profile)
      .eq("approved", true)
      .order("skill_name"),

    supabase
      .from("workflow_templates")
      .select("id, name, description, trigger_type, steps, enabled")
      .eq("organization_id", ctx.orgId)
      .eq("enabled", true),

    supabase
      .from("agent_knowledge_access")
      .select("id, source_id, access_mode, knowledge_sources(name, source_type, status)")
      .eq("organization_id", ctx.orgId)
      .eq("agent_id", agentId),

    supabase
      .from("agent_performance_snapshots")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .eq("agent_profile", profile)
      .order("snapshot_date", { ascending: false })
      .limit(4),

    supabase
      .from("agent_tasks")
      .select("id, task_type, status, output_data, created_at, completed_at")
      .eq("organization_id", ctx.orgId)
      .eq("agent_category", agent.category as string)
      .in("status", ["approved", "completed"])
      .order("completed_at", { ascending: false })
      .limit(5),
  ]);

  // Filter workflows to this agent's profile
  const agentWorkflows = (workflows ?? []).filter((wf) => {
    const steps = wf.steps as Array<{ agent_profile?: string }>;
    return steps.some((s) => s.agent_profile === profile);
  });

  // Normalize knowledge access joins
  const knowledgeSources = (knowledgeAccess ?? []).map((ka) => {
    const source = Array.isArray(ka.knowledge_sources)
      ? ka.knowledge_sources[0]
      : ka.knowledge_sources;
    return {
      id: ka.source_id,
      access_mode: ka.access_mode as string,
      name: (source as { name?: string })?.name ?? "Unknown",
      source_type: (source as { source_type?: string })?.source_type ?? "unknown",
      status: (source as { status?: string })?.status ?? "unknown",
    };
  });

  // Trust summary from latest snapshot
  const latestPerf = perfSnapshots?.[0];
  const trustSummary = latestPerf
    ? {
        period: latestPerf.period as string,
        snapshot_date: latestPerf.snapshot_date as string,
        ...(latestPerf.metrics as Record<string, unknown>),
      }
    : null;

  const agentDetail = {
    id: agent.id as string,
    name: agent.name as string,
    description: agent.description as string | null,
    category: agent.category as string,
    status: agent.status as string,
    automation_level: agent.automation_level as number,
    hermes_enabled: agent.hermes_enabled as boolean,
    capabilities: (agent.capabilities ?? []) as string[],
    approved_skills: (approvedSkills ?? []).map((s) => ({
      id: s.id as string,
      skill_name: s.skill_name as string,
      skill_description: s.skill_description as string | null,
      source: s.source as string,
      version: s.version as number,
      shared: s.shared as boolean,
      updated_at: s.updated_at as string,
    })),
    workflows: agentWorkflows.map((wf) => ({
      id: wf.id as string,
      name: wf.name as string,
      description: wf.description as string | null,
      trigger_type: wf.trigger_type as string,
    })),
    knowledge_sources: knowledgeSources,
    trust_summary: trustSummary,
    recent_examples: (recentTasks ?? []).map((t) => ({
      id: t.id as string,
      task_type: t.task_type as string,
      status: t.status as string,
      summary:
        ((t.output_data as Record<string, unknown>)?.summary as string) ?? null,
      completed_at: t.completed_at as string | null,
    })),
  };

  return <AgentDetailView agent={agentDetail} />;
}
