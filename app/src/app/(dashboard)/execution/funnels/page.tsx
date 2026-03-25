import { createClient } from "@/lib/supabase/server";
import { FunnelRegistryView } from "./funnels-view";

export default async function FunnelsPage() {
  const supabase = await createClient();

  const { data: funnels } = await supabase
    .from("funnels")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch approved ideas for linking
  const { data: approvedIdeas } = await supabase
    .from("ideas")
    .select("id, name")
    .in("lifecycle_status", ["candidate", "selected"])
    .order("name");

  return (
    <FunnelRegistryView
      funnels={funnels ?? []}
      approvedIdeas={approvedIdeas ?? []}
    />
  );
}
