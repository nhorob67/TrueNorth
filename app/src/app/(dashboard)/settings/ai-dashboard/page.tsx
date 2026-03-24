import { createClient } from "@/lib/supabase/server";
import { AiDashboardView } from "./ai-dashboard-view";
import type { Agent, AiAction } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AiDashboardPage() {
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
        <h2 className="text-xl font-semibold text-charcoal">Access Denied</h2>
        <p className="mt-2 text-warm-gray">
          Only administrators can view the AI Trust Dashboard.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Fetch agents and actions in parallel
  const [{ data: agents }, { data: actions }] = await Promise.all([
    supabase
      .from("agents")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_actions")
      .select("*")
      .eq("organization_id", orgId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AiDashboardView
      agents={(agents ?? []) as Agent[]}
      actions={(actions ?? []) as AiAction[]}
      orgId={orgId}
      userId={user?.id ?? ""}
    />
  );
}
