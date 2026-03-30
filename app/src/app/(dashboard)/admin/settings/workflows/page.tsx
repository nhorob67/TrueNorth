import { createClient } from "@/lib/supabase/server";
import { WorkflowBuilderView } from "./workflow-builder-view";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
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
          Only administrators and managers can manage workflows.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;

  const [{ data: templates }, { data: executions }, { data: agents }] = await Promise.all([
    supabase
      .from("workflow_templates")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("workflow_executions")
      .select("*")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("agents")
      .select("id, name, category, hermes_profile_name, hermes_enabled")
      .eq("organization_id", orgId)
      .order("name"),
  ]);

  return (
    <WorkflowBuilderView
      templates={templates ?? []}
      executions={executions ?? []}
      agents={agents ?? []}
      orgId={orgId}
      isAdmin={membership.role === "admin"}
    />
  );
}
