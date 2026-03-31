import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const automationLevel = searchParams.get("automation_level");
    const hermesEnabled = searchParams.get("hermes_enabled");
    const sortBy = searchParams.get("sort") ?? "name";

    // Fetch agents
    let query = supabase
      .from("agents")
      .select("*")
      .eq("organization_id", ctx.orgId);

    if (category) query = query.eq("category", category);
    if (status) query = query.eq("status", status);
    if (automationLevel) query = query.eq("automation_level", parseInt(automationLevel, 10));
    if (hermesEnabled === "true") query = query.eq("hermes_enabled", true);

    if (sortBy === "name") query = query.order("name");
    else if (sortBy === "updated") query = query.order("updated_at", { ascending: false });
    else query = query.order("name");

    const { data: agents, error } = await query;

    if (error) {
      console.error("Error fetching agents:", error);
      return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch approved skill counts per agent profile
    const agentProfiles = agents
      .map((a) => a.hermes_profile_name)
      .filter(Boolean) as string[];

    const { data: skillCounts } = agentProfiles.length > 0
      ? await supabase
          .from("agent_skills")
          .select("agent_profile")
          .eq("organization_id", ctx.orgId)
          .eq("approved", true)
          .in("agent_profile", agentProfiles)
      : { data: [] };

    const skillCountMap = new Map<string, number>();
    for (const row of skillCounts ?? []) {
      skillCountMap.set(
        row.agent_profile,
        (skillCountMap.get(row.agent_profile) ?? 0) + 1
      );
    }

    // Fetch workflow counts per agent
    const agentIds = agents.map((a) => a.id);
    const { data: workflows } = await supabase
      .from("workflow_templates")
      .select("id, steps")
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

    // Fetch knowledge access counts
    const { data: knowledgeAccess } = await supabase
      .from("agent_knowledge_access")
      .select("agent_id")
      .eq("organization_id", ctx.orgId)
      .in("agent_id", agentIds);

    const knowledgeCountMap = new Map<string, number>();
    for (const row of knowledgeAccess ?? []) {
      knowledgeCountMap.set(
        row.agent_id,
        (knowledgeCountMap.get(row.agent_id) ?? 0) + 1
      );
    }

    // Fetch latest performance snapshot per agent
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
    const catalog = agents.map((agent) => {
      const profile = agent.hermes_profile_name ?? "";
      const metrics = perfMap.get(profile);
      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        status: agent.status,
        automation_level: agent.automation_level,
        hermes_enabled: agent.hermes_enabled,
        capabilities: agent.capabilities ?? [],
        approved_skill_count: skillCountMap.get(profile) ?? 0,
        workflow_count: workflowCountMap.get(profile) ?? 0,
        knowledge_source_count: knowledgeCountMap.get(agent.id) ?? 0,
        trust_summary: metrics
          ? {
              acceptance_rate: metrics.acceptance_rate ?? null,
              tasks_completed: metrics.tasks_completed ?? null,
              override_rate: metrics.override_rate ?? null,
            }
          : null,
      };
    });

    return NextResponse.json(catalog);
  } catch (error) {
    console.error("Agent catalog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
