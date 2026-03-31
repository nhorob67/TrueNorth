import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { IdeaVaultView } from "./ideas-view";

export default async function IdeasPage() {
  const [supabase, userCtx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!userCtx) {
    return <p className="text-subtle p-8">Please sign in to view ideas.</p>;
  }

  const [{ data: ideas }, { data: vision }, { data: venture }] =
    await Promise.all([
      supabase
        .from("ideas")
        .select("*")
        .eq("venture_id", userCtx.ventureId)
        .order("submitted_at", { ascending: false }),
      // Fetch strategic filters for the filter review stage
      supabase
        .from("visions")
        .select("strategic_filters")
        .eq("venture_id", userCtx.ventureId)
        .order("year", { ascending: false })
        .limit(1)
        .single(),
      // Fetch venture settings for configurable score threshold
      userCtx?.ventureId
        ? supabase
            .from("ventures")
            .select("settings")
            .eq("id", userCtx.ventureId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  const settings = (venture?.settings ?? {}) as Record<string, unknown>;
  const candidateThreshold =
    typeof settings.candidate_score_threshold === "number"
      ? settings.candidate_score_threshold
      : 70;

  return (
    <IdeaVaultView
      ideas={ideas ?? []}
      strategicFilters={vision?.strategic_filters ?? []}
      candidateThreshold={candidateThreshold}
    />
  );
}
