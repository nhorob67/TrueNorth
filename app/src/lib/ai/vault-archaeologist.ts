import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { logAiAction } from "./action-log";

// ============================================================
// Vault Archaeologist Agent (PRD Section 3.15)
//
// Resurfaces archived ideas that may be newly relevant given
// current strategic context (active bets, KPI trends, filters).
// ============================================================

const anthropic = new Anthropic();

export interface ResurfacedIdea {
  ideaId: string;
  ideaName: string;
  reason: string;
}

const SYSTEM_PROMPT = `You are the TrueNorth Vault Archaeologist, an AI agent inside a business operating system for digital media companies.

Your job: Given a list of archived/quarantined ideas and the current strategic context (active bets, recent KPI trends, strategic filters), identify which archived ideas are NOW newly relevant.

An idea is "newly relevant" if:
- A new bet or strategic direction makes it viable
- KPI trends suggest a gap this idea could fill
- A strategic filter has shifted (new audience, platform, or format)
- Market conditions implied by recent changes make it timely

Be selective — only resurface ideas with genuine, specific reasons. Quality over quantity.

Return ONLY a valid JSON array (no markdown, no commentary):
[
  { "ideaId": "string", "ideaName": "string", "reason": "string — 1-2 sentence explanation of why this idea is newly relevant" }
]

If no ideas are relevant, return an empty array: []`;

export async function resurfaceRelevantIdeas(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string
): Promise<ResurfacedIdea[]> {
  // 1. Fetch archived ideas
  const { data: archivedIdeas } = await supabase
    .from("ideas")
    .select("id, title, description, strategic_fit, tags, created_at")
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .in("lifecycle_status", ["archived", "quarantine"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (!archivedIdeas || archivedIdeas.length === 0) {
    return [];
  }

  // 2. Fetch current strategic context
  const [
    { data: activeBets },
    { data: kpis },
    { data: filters },
  ] = await Promise.all([
    supabase
      .from("bets")
      .select("id, outcome, mechanism, health_status")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("lifecycle_status", "active"),
    supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, unit")
      .eq("organization_id", orgId)
      .eq("lifecycle_status", "active")
      .in("health_status", ["red", "yellow"]),
    supabase
      .from("strategic_filters")
      .select("id, name, value, category")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("is_active", true),
  ]);

  const context = {
    activeBets: activeBets ?? [],
    driftingKpis: kpis ?? [],
    strategicFilters: filters ?? [],
  };

  const userMessage = `Archived Ideas:\n${JSON.stringify(archivedIdeas, null, 2)}\n\nCurrent Strategic Context:\n${JSON.stringify(context, null, 2)}`;

  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = JSON.parse(raw) as ResurfacedIdea[];

    // Log the action
    await logAiAction(supabase, {
      orgId,
      agentCategory: "vault_archaeologist",
      actionType: "resurface",
      inputSummary: `Analyzed ${archivedIdeas.length} archived ideas against ${(activeBets ?? []).length} active bets and ${(kpis ?? []).length} drifting KPIs`,
      outputSummary: `Resurfaced ${parsed.length} ideas: ${parsed.map((i) => i.ideaName).join(", ") || "none"}`,
      confidence: "medium",
      processingTimeMs: Date.now() - startTime,
    });

    return parsed;
  } catch (error) {
    console.error("Vault Archaeologist AI error:", error);
    return [];
  }
}
