import { createClient } from "@/lib/supabase/server";
import { MemoryView } from "./memory-view";

export const dynamic = "force-dynamic";

export default async function AgentMemoryPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
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
          Only administrators and managers can view agent memory.
        </p>
      </div>
    );
  }

  const [{ data: agent }, { data: memories }] = await Promise.all([
    supabase
      .from("agents")
      .select("id, name, category, hermes_profile_name, hermes_enabled")
      .eq("id", agentId)
      .eq("organization_id", membership.organization_id)
      .single(),
    supabase
      .from("agent_memory")
      .select("*")
      .eq("agent_id", agentId)
      .eq("organization_id", membership.organization_id)
      .order("memory_type")
      .order("key"),
  ]);

  if (!agent) {
    return (
      <div className="p-8">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
          Agent Not Found
        </h2>
      </div>
    );
  }

  return (
    <MemoryView
      agent={agent}
      memories={memories ?? []}
      isAdmin={membership.role === "admin"}
    />
  );
}
