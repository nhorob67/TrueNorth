import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeVisibility } from "@/types/database";

/**
 * Check if a user can access a knowledge source based on its visibility scope.
 *
 * Rules:
 * - "org": any org member can access
 * - "venture": only members of the specific venture
 * - "restricted": only admins/managers
 */
export async function canAccessSource(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  ventureId: string | null,
  visibility: KnowledgeVisibility
): Promise<boolean> {
  if (visibility === "org") {
    // Any org member can access
    const { data } = await supabase
      .from("organization_memberships")
      .select("user_id")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .single();
    return !!data;
  }

  if (visibility === "venture" && ventureId) {
    const { data } = await supabase
      .from("venture_memberships")
      .select("user_id")
      .eq("user_id", userId)
      .eq("venture_id", ventureId)
      .single();
    return !!data;
  }

  if (visibility === "restricted") {
    const { data } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .single();
    return data?.role === "admin" || data?.role === "manager";
  }

  return false;
}

/**
 * Filter source types visible to a member for search.
 * Members see org + their venture sources. Admins also see restricted.
 */
export function buildVisibilityFilter(
  orgRole: string,
  ventureId: string | null
): { visibilities: KnowledgeVisibility[]; ventureId: string | null } {
  const visibilities: KnowledgeVisibility[] = ["org"];
  if (ventureId) visibilities.push("venture");
  if (orgRole === "admin" || orgRole === "manager") visibilities.push("restricted");
  return { visibilities, ventureId };
}
