import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? "";

  // Stage 1: membership + user profile in parallel (both need only userId)
  const [
    { data: membership, error: e1 },
    { data: userProfile, error: e2 },
  ] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", userId)
      .limit(1)
      .single(),
    supabase
      .from("user_profiles")
      .select("settings")
      .eq("id", userId)
      .single(),
  ]);

  const firstError = e1 || e2;
  if (firstError) throw firstError;

  // Stage 2: org-related queries in parallel (all need membership.organization_id)
  let org = null;
  let ventures: Array<{ id: string; name: string }> = [];
  let pendingInvites: Array<{ id: string; email: string; role: string; created_at: string; accepted_at: string | null }> = [];
  let members: Array<{ user_id: string; role: string; user_profiles: { full_name: string } | null }> = [];

  if (membership) {
    const [
      { data: orgData, error: e3 },
      { data: venturesData, error: e4 },
      { data: invitesData, error: e5 },
      { data: membersData, error: e6 },
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, settings")
        .eq("id", membership.organization_id)
        .single(),
      supabase
        .from("ventures")
        .select("id, name")
        .eq("organization_id", membership.organization_id),
      supabase
        .from("invites")
        .select("id, email, role, created_at, accepted_at")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_memberships")
        .select("user_id, role, user_profiles(full_name)")
        .eq("organization_id", membership.organization_id),
    ]);

    const secondError = e3 || e4 || e5 || e6;
    if (secondError) throw secondError;

    org = orgData;
    ventures = venturesData ?? [];
    pendingInvites = invitesData ?? [];
    members = (membersData ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      user_profiles: Array.isArray(m.user_profiles)
        ? (m.user_profiles as Array<{ full_name: string }>)[0] ?? null
        : m.user_profiles,
    })) as Array<{
      user_id: string;
      role: string;
      user_profiles: { full_name: string } | null;
    }>;
  }

  const userSettings = (userProfile?.settings ?? {}) as Record<string, unknown>;
  const qh = (userSettings.quiet_hours ?? {}) as Record<string, unknown>;
  const quietHours = {
    enabled: (qh.enabled as boolean) ?? true,
    start_hour: (qh.start_hour as number) ?? 21,
    end_hour: (qh.end_hour as number) ?? 7,
    timezone: (qh.timezone as string) ?? "America/Chicago",
  };

  return (
    <SettingsView
      org={org}
      ventures={ventures}
      pendingInvites={pendingInvites}
      members={members}
      isAdmin={membership?.role === "admin"}
      quietHours={quietHours}
      userId={userId}
    />
  );
}
