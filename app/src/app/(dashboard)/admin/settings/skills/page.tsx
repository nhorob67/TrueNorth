import { createClient } from "@/lib/supabase/server";
import { SkillsView } from "./skills-view";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
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
          Only administrators and managers can manage agent skills.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;

  const [{ data: skills }, { data: agents }] = await Promise.all([
    supabase
      .from("agent_skills")
      .select("*")
      .eq("organization_id", orgId)
      .order("agent_profile")
      .order("skill_name"),
    supabase
      .from("agents")
      .select("id, name, category, hermes_profile_name, hermes_enabled")
      .eq("organization_id", orgId)
      .order("name"),
  ]);

  return (
    <SkillsView
      skills={skills ?? []}
      agents={agents ?? []}
      orgId={orgId}
      isAdmin={membership.role === "admin"}
      userId={user?.id ?? ""}
    />
  );
}
