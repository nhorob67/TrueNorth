import { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, name")
    .eq("organization_id", orgMembership.organization_id)
    .order("created_at");

  const ventureList = ventures ?? [];
  if (ventureList.length === 0) return null;

  // Check for user's selected venture in cookie
  const cookieStore = await cookies();
  const selectedVentureId = cookieStore.get("truenorth_venture_id")?.value;

  // Use selected venture if valid, otherwise first
  const activeVenture =
    ventureList.find((v) => v.id === selectedVentureId) ?? ventureList[0];

  const { data: ventureMembership } = await supabase
    .from("venture_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("venture_id", activeVenture.id)
    .single();

  return {
    userId: user.id,
    fullName: profile?.full_name ?? "",
    orgId: orgMembership.organization_id,
    orgRole: orgMembership.role,
    ventureId: activeVenture.id,
    ventureRole: ventureMembership?.role ?? "member",
    ventures: ventureList,
    isSingleVenture: ventureList.length === 1,
  };
}

export const getCachedUserContext = cache(async () => {
  const supabase = await createClient();
  return getUserContext(supabase);
});
