import { createClient } from "@/lib/supabase/server";
import { ALL_POLICIES } from "@/lib/policies/engine";
import { PolicyDashboardView } from "./policy-dashboard-view";

export const dynamic = "force-dynamic";

export default async function PolicyDashboardPage() {
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
          Only administrators can view the policy dashboard.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;
  // eslint-disable-next-line react-hooks/purity
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch overrides, ventures, and user profiles in parallel
  const [{ data: overrides }, { data: ventures }, { data: members }] =
    await Promise.all([
      supabase
        .from("policy_overrides")
        .select("id, policy_name, overridden_by, justification, entity_id, entity_type, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", ninetyDaysAgo)
        .order("created_at", { ascending: false }),
      supabase
        .from("ventures")
        .select("id, name, settings")
        .eq("organization_id", orgId),
      supabase
        .from("organization_memberships")
        .select("user_id, user_profiles(full_name)")
        .eq("organization_id", orgId),
    ]);

  // Build user name map
  const userNameMap: Record<string, string> = {};
  for (const m of members ?? []) {
    const profile = Array.isArray(m.user_profiles)
      ? (m.user_profiles as Array<{ full_name: string }>)[0]
      : (m.user_profiles as { full_name: string } | null);
    userNameMap[m.user_id] = profile?.full_name ?? "Unknown";
  }

  // Serialize policy definitions for the client
  const policyDefs = ALL_POLICIES.map((p) => ({
    name: p.name,
    description: p.description,
    scope: p.scope,
    enforcement: p.enforcement,
    overrideAllowed: p.overrideAllowed,
    userExplanation: p.userExplanation,
  }));

  return (
    <PolicyDashboardView
      policies={policyDefs}
      overrides={overrides ?? []}
      userNameMap={userNameMap}
      ventures={(ventures ?? []).map((v) => ({
        id: v.id as string,
        name: v.name as string,
        settings: (v.settings ?? {}) as Record<string, unknown>,
      }))}
    />
  );
}
