import { createClient } from "@/lib/supabase/server";
import { ActivityFeedView } from "./activity-view";

export default async function ActivityPage() {
  const supabase = await createClient();

  const { data: comments } = await supabase
    .from("comments")
    .select("*, user_profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  // Normalize user_profiles join
  const normalized = (comments ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    body: c.body as string,
    author_id: c.author_id as string,
    entity_id: c.entity_id as string,
    entity_type: c.entity_type as string,
    parent_comment_id: (c.parent_comment_id as string) ?? null,
    mentions: (c.mentions ?? []) as Array<{ userId: string; name: string }>,
    resolved: c.resolved as boolean,
    created_at: c.created_at as string,
    user_profiles: Array.isArray(c.user_profiles)
      ? (c.user_profiles as Array<{ full_name: string }>)[0] ?? null
      : (c.user_profiles as { full_name: string } | null),
  }));

  return <ActivityFeedView comments={normalized} />;
}
