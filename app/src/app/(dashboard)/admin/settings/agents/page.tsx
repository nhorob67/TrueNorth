import { createClient } from "@/lib/supabase/server";
import { AgentsView } from "./agents-view";
import type { AiAction } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AgentsSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single();

  if (!membership || membership.role !== "admin") {
    return (
      <div className="p-8">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Access Denied</h2>
        <p className="mt-2 text-subtle">
          Only administrators can manage AI agents.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: agents }, { data: aiActions }] = await Promise.all([
    supabase
      .from("agents")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_actions")
      .select("agent_category, outcome")
      .eq("organization_id", orgId)
      .gte("created_at", thirtyDaysAgo),
  ]);

  // Fetch role cards for agents (entity_type = 'agent')
  const agentIds = (agents ?? []).map((a: Record<string, unknown>) => a.id as string);
  const { data: roleCards } = agentIds.length > 0
    ? await supabase
        .from("role_cards")
        .select("*")
        .eq("entity_type", "agent")
        .in("entity_id", agentIds)
    : { data: [] };

  // Compute trust metrics per agent category
  const trustMetrics: Record<string, { totalActions: number; acceptanceRate: number | null; overrideRate: number | null }> = {};
  const actionRows = (aiActions ?? []) as Array<{ agent_category: string; outcome: string }>;

  for (const agent of agents ?? []) {
    const cat = (agent as Record<string, unknown>).category as string;
    const catActions = actionRows.filter((a) => a.agent_category === cat);
    const accepted = catActions.filter((a) => a.outcome === "accepted").length;
    const overridden = catActions.filter((a) => a.outcome === "overridden").length;
    const ignored = catActions.filter((a) => a.outcome === "ignored").length;
    const nonPending = accepted + overridden + ignored;

    trustMetrics[cat] = {
      totalActions: catActions.length,
      acceptanceRate: accepted + overridden > 0
        ? Math.round((accepted / (accepted + overridden)) * 100)
        : null,
      overrideRate: nonPending > 0
        ? Math.round((overridden / nonPending) * 100)
        : null,
    };
  }

  return (
    <AgentsView
      agents={agents ?? []}
      roleCards={roleCards ?? []}
      orgId={orgId}
      trustMetrics={trustMetrics}
    />
  );
}
