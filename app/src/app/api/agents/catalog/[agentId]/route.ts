import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch agent
    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("organization_id", ctx.orgId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const profile = agent.hermes_profile_name ?? "";

    // Parallel fetches for detail data
    const [
      { data: approvedSkills },
      { data: workflows },
      { data: knowledgeAccess },
      { data: perfSnapshots },
      { data: recentTasks },
    ] = await Promise.all([
      // Approved skills only (member-safe)
      supabase
        .from("agent_skills")
        .select("id, skill_name, skill_description, source, version, shared, updated_at")
        .eq("organization_id", ctx.orgId)
        .eq("agent_profile", profile)
        .eq("approved", true)
        .order("skill_name"),

      // Workflows this agent participates in
      supabase
        .from("workflow_templates")
        .select("id, name, description, trigger_type, steps, enabled")
        .eq("organization_id", ctx.orgId)
        .eq("enabled", true),

      // Knowledge sources this agent can access
      supabase
        .from("agent_knowledge_access")
        .select("id, source_id, access_mode, knowledge_sources(name, source_type, status)")
        .eq("organization_id", ctx.orgId)
        .eq("agent_id", agentId),

      // Performance snapshots
      supabase
        .from("agent_performance_snapshots")
        .select("*")
        .eq("organization_id", ctx.orgId)
        .eq("agent_profile", profile)
        .order("snapshot_date", { ascending: false })
        .limit(4),

      // Recent completed tasks as examples
      supabase
        .from("agent_tasks")
        .select("id, task_type, status, output_data, created_at, completed_at")
        .eq("organization_id", ctx.orgId)
        .eq("agent_category", agent.category)
        .in("status", ["approved", "completed"])
        .order("completed_at", { ascending: false })
        .limit(5),
    ]);

    // Filter workflows to only those that include this agent's profile
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
        access_mode: ka.access_mode,
        name: source?.name ?? "Unknown",
        source_type: source?.source_type ?? "unknown",
        status: source?.status ?? "unknown",
      };
    });

    // Build trust summary from most recent snapshot
    const latestPerf = perfSnapshots?.[0];
    const trustSummary = latestPerf
      ? {
          period: latestPerf.period,
          snapshot_date: latestPerf.snapshot_date,
          ...(latestPerf.metrics as Record<string, unknown>),
        }
      : null;

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      status: agent.status,
      automation_level: agent.automation_level,
      hermes_enabled: agent.hermes_enabled,
      capabilities: agent.capabilities ?? [],
      approved_skills: approvedSkills ?? [],
      workflows: agentWorkflows.map((wf) => ({
        id: wf.id,
        name: wf.name,
        description: wf.description,
        trigger_type: wf.trigger_type,
      })),
      knowledge_sources: knowledgeSources,
      trust_summary: trustSummary,
      recent_examples: (recentTasks ?? []).map((t) => ({
        id: t.id,
        task_type: t.task_type,
        status: t.status,
        summary: (t.output_data as Record<string, unknown>)?.summary ?? null,
        completed_at: t.completed_at,
      })),
    });
  } catch (error) {
    console.error("Agent catalog detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
