import { createClient } from "@/lib/supabase/server";
import { IdeaVaultView } from "./ideas-view";

export default async function IdeasPage() {
  const supabase = await createClient();

  const { data: ideas } = await supabase
    .from("ideas")
    .select("*")
    .order("submitted_at", { ascending: false });

  // Fetch strategic filters for the filter review stage
  const { data: vision } = await supabase
    .from("visions")
    .select("strategic_filters")
    .order("year", { ascending: false })
    .limit(1)
    .single();

  return (
    <IdeaVaultView
      ideas={ideas ?? []}
      strategicFilters={vision?.strategic_filters ?? []}
    />
  );
}
