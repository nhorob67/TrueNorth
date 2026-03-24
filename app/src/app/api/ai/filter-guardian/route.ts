import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { evaluateIdeaAgainstFilters } from "@/lib/ai/filter-guardian";
import { validateUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/ai/filter-guardian
//
// Evaluates an idea against the venture's strategic filters
// using the AI Filter Guardian agent.
// ============================================================

interface FilterGuardianRequest {
  ideaId: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);
    if (!ctx) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as FilterGuardianRequest;
    const { ideaId } = body;

    if (!ideaId || !validateUuid(ideaId)) {
      return NextResponse.json(
        { error: "ideaId must be a valid UUID" },
        { status: 400 }
      );
    }

    // Fetch the idea — ensure it belongs to the user's org
    const { data: idea, error: ideaError } = await supabase
      .from("ideas")
      .select("id, name, description, classification, venture_id")
      .eq("id", ideaId)
      .eq("organization_id", ctx.orgId)
      .single();

    if (ideaError || !idea) {
      return NextResponse.json(
        { error: "Idea not found" },
        { status: 404 }
      );
    }

    // Fetch the venture's vision (BHAG + strategic filters)
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

    if (strategicFilters.length === 0) {
      return NextResponse.json(
        { error: "No strategic filters defined. Add filters on the Vision Board first." },
        { status: 400 }
      );
    }

    if (!bhag) {
      return NextResponse.json(
        { error: "No BHAG defined. Set your BHAG on the Vision Board first." },
        { status: 400 }
      );
    }

    // Run AI evaluation
    const evaluation = await evaluateIdeaAgainstFilters({
      ideaName: idea.name,
      ideaDescription: idea.description,
      ideaClassification: idea.classification,
      strategicFilters,
      bhag,
    });

    // Update the idea's filter_results in DB
    const { error: updateError } = await supabase
      .from("ideas")
      .update({
        filter_results: evaluation.results,
        updated_at: new Date().toISOString(),
      })
      .eq("id", idea.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save evaluation results", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: evaluation.results,
      confidence: evaluation.confidence,
      summary: evaluation.summary,
      sourceInputs: evaluation.sourceInputs,
    });
  } catch (error) {
    console.error("Filter Guardian error:", error);
    const message =
      error instanceof Error ? error.message : "AI evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
