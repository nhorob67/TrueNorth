import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveVenture } from "@/lib/user-context-helpers";

export interface UserContext {
  userId: string;
  fullName: string;
  orgId: string;
  orgRole: "admin" | "manager" | "member" | "viewer";
  ventureId: string;
  ventureRole: "admin" | "manager" | "member" | "viewer";
  ventures: Array<{ id: string; name: string }>;
  isSingleVenture: boolean;
}

interface VentureSummary {
  id: string;
  name: string;
  role: UserContext["ventureRole"];
}

export async function getUserContext(
  supabase: SupabaseClient
): Promise<UserContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: orgMembership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!orgMembership) return null;

  const { data: ventureMemberships } = await supabase
    .from("venture_memberships")
    .select("venture_id, role")
    .eq("user_id", user.id);

  const ventureIds = (ventureMemberships ?? []).map((membership) => membership.venture_id);
  if (ventureIds.length === 0) return null;

  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, name")
    .eq("organization_id", orgMembership.organization_id)
    .in("id", ventureIds)
    .order("created_at");

  const ventureRoleById = new Map(
    (ventureMemberships ?? []).map((membership) => [membership.venture_id, membership.role])
  );

  const ventureList: VentureSummary[] = (ventures ?? []).map((venture) => ({
    id: venture.id,
    name: venture.name,
    role: (ventureRoleById.get(venture.id) ?? "member") as UserContext["ventureRole"],
  }));
  if (ventureList.length === 0) return null;

  // Check for user's selected venture in cookie
  const cookieStore = await cookies();
  const selectedVentureId = cookieStore.get("truenorth_venture_id")?.value;

  // Use selected venture if valid, otherwise first
  const activeVenture = resolveActiveVenture(ventureList, selectedVentureId);
  if (!activeVenture) return null;

  return {
    userId: user.id,
    fullName: profile?.full_name ?? "",
    orgId: orgMembership.organization_id,
    orgRole: orgMembership.role,
    ventureId: activeVenture.id,
    ventureRole: activeVenture.role,
    ventures: ventureList.map(({ id, name }) => ({ id, name })),
    isSingleVenture: ventureList.length === 1,
  };
}

export const getCachedUserContext = cache(async () => {
  const supabase = await createClient();
  return getUserContext(supabase);
});
