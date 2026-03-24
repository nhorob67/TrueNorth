import { createClient } from "@/lib/supabase/server";
import { AutomationLadderView } from "./automation-ladder-view";

export const dynamic = "force-dynamic";

export default async function AutomationLadderPage() {
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
          Only administrators can manage the automation ladder.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;

  // Fetch processes, agents, org settings, and member names in parallel
  const [
    { data: processes },
    { data: agents },
    { data: org },
    { data: members },
    { data: ventures },
  ] = await Promise.all([
    supabase
      .from("processes")
      .select("id, name, description, owner_id, automation_level, lifecycle_status, linked_kpi_ids, linked_bet_ids, venture_id")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("agents")
      .select("id, name, category, automation_level, status")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("organizations")
      .select("id, settings")
      .eq("id", orgId)
      .single(),
    supabase
      .from("organization_memberships")
      .select("user_id, user_profiles(full_name)")
      .eq("organization_id", orgId),
    supabase
      .from("ventures")
      .select("id, name")
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

  const orgSettings = (org?.settings ?? {}) as Record<string, unknown>;
  const sacredProcessIds = (orgSettings.sacred_process_ids ?? []) as string[];

  return (
    <AutomationLadderView
      processes={(processes ?? []) as Array<{
        id: string;
        name: string;
        description: string | null;
        owner_id: string;
        automation_level: number;
        lifecycle_status: string;
        linked_kpi_ids: string[];
        linked_bet_ids: string[];
        venture_id: string;
      }>}
      agents={(agents ?? []) as Array<{
        id: string;
        name: string;
        category: string;
        automation_level: number;
        status: string;
      }>}
      sacredProcessIds={sacredProcessIds}
      userNameMap={userNameMap}
      orgId={orgId}
      userId={user?.id ?? ""}
      ventures={(ventures ?? []) as Array<{ id: string; name: string }>}
    />
  );
}
