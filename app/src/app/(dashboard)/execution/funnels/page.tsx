import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { FunnelRegistryView } from "./funnels-view";

export default async function FunnelsPage() {
  const [supabase, ctx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) {
    return <p className="text-subtle p-8">Please sign in to view funnels.</p>;
  }

  const { data: funnels } = await supabase
    .from("funnels")
    .select("*")
    .eq("venture_id", ctx.ventureId)
    .order("created_at", { ascending: false });

  // Fetch approved ideas for linking
  const { data: approvedIdeas } = await supabase
    .from("ideas")
    .select("id, name")
    .eq("venture_id", ctx.ventureId)
    .in("lifecycle_status", ["candidate", "selected"])
    .order("name");

  return (
    <FunnelRegistryView
      funnels={funnels ?? []}
      approvedIdeas={approvedIdeas ?? []}
    />
  );
}
