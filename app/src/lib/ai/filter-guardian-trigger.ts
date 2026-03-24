import { SupabaseClient } from "@supabase/supabase-js";
import { evaluateIdeaAgainstFilters } from "./filter-guardian";

// ============================================================
// Filter Guardian Trigger
//
// Checks for ideas whose cooling period has expired and
// automatically advances them to filter_review with AI evaluation.
// ============================================================

export async function checkAndTriggerFilterGuardian(
  supabase: SupabaseClient
): Promise<number> {
  // Find ideas in quarantine whose cooling period has expired
  const { data: expiredIdeas, error: queryError } = await supabase
    .from("ideas")
    .select("id, name, description, classification, venture_id")
    .eq("lifecycle_status", "quarantine")
    .lte("cooling_expires_at", new Date().toISOString());

  if (queryError) {
    console.error("Filter Guardian trigger query error:", queryError.message);
    return 0;
  }

  if (!expiredIdeas || expiredIdeas.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (const idea of expiredIdeas) {
    try {
      // Fetch the venture's vision for BHAG and strategic filters
      const { data: vision } = await supabase
        .from("visions")
        .select("bhag, strategic_filters")
        .eq("venture_id", idea.venture_id)
        .limit(1)
        .single();

      const bhag = vision?.bhag ?? "";
      const strategicFilters: Array<{
        id: string;
        name: string;
        description: string;
      }> = vision?.strategic_filters ?? [];

      // Advance to filter_review
      await supabase
        .from("ideas")
        .update({
          lifecycle_status: "filter_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", idea.id);

      // Run AI evaluation if there are strategic filters defined
      if (strategicFilters.length > 0 && bhag) {
        const evaluation = await evaluateIdeaAgainstFilters({
          ideaName: idea.name,
          ideaDescription: idea.description,
          ideaClassification: idea.classification,
          strategicFilters,
          bhag,
        });

        // Store results
        await supabase
          .from("ideas")
          .update({
            filter_results: evaluation.results,
            updated_at: new Date().toISOString(),
          })
          .eq("id", idea.id);
      }

      processedCount++;
    } catch (err) {
      console.error(
        `Filter Guardian: failed to process idea ${idea.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return processedCount;
}
