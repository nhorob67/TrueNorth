import { createClient } from "@/lib/supabase/server";
import { CostDashboardView } from "./cost-dashboard-view";

export const dynamic = "force-dynamic";

export default async function CostDashboardPage() {
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

  if (!membership || !["admin", "manager"].includes(membership.role)) {
    return (
      <div className="p-8">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
          Access Denied
        </h2>
        <p className="mt-2 text-subtle">
          Only administrators and managers can view token costs.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;

  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: usageRows },
    { data: agents },
    { data: budgetPolicies },
  ] = await Promise.all([
    supabase
      .from("agent_token_usage")
      .select("id, hermes_profile, agent_id, model, input_tokens, output_tokens, cache_read_tokens, estimated_cost, task_id, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("agents")
      .select("id, name, category, hermes_profile_name, hermes_enabled")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("agent_budget_policies")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <CostDashboardView
      usageRows={(usageRows ?? []) as Array<{
        id: string;
        hermes_profile: string;
        agent_id: string | null;
        model: string;
        input_tokens: number;
        output_tokens: number;
        cache_read_tokens: number;
        estimated_cost: number;
        task_id: string | null;
        created_at: string;
      }>}
      agents={(agents ?? []) as Array<{
        id: string;
        name: string;
        category: string;
        hermes_profile_name: string | null;
        hermes_enabled: boolean;
      }>}
      budgetPolicies={(budgetPolicies ?? []) as Array<{
        id: string;
        organization_id: string;
        scope: string;
        agent_id: string | null;
        period: string;
        budget_cap: number;
        alert_threshold_pct: number;
        action_on_exceed: string;
        enabled: boolean;
        created_at: string;
      }>}
      orgId={orgId}
      isAdmin={membership.role === "admin"}
    />
  );
}
