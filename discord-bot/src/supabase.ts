import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get the default organization ID.
 * Uses TRUENORTH_ORG_ID env var if set, otherwise fetches the first org from the database.
 */
export async function getOrgId(): Promise<string> {
  if (process.env.TRUENORTH_ORG_ID) return process.env.TRUENORTH_ORG_ID;
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();
  if (error || !data) throw new Error("No organization found in database");
  return data.id;
}

/**
 * Get the default user ID for bot-created entities.
 * Uses TRUENORTH_DEFAULT_USER_ID env var if set, otherwise fetches the first user in the org.
 */
export async function getDefaultUserId(orgId: string): Promise<string> {
  if (process.env.TRUENORTH_DEFAULT_USER_ID)
    return process.env.TRUENORTH_DEFAULT_USER_ID;
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", orgId)
    .limit(1)
    .single();
  if (error || !data) throw new Error("No users found in organization");
  return data.user_id;
}
