import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { logAiAction } from "./action-log";

// ============================================================
// Filter Guardian Agent
//
// Evaluates ideas against strategic filters using Claude.
// PRD Section 2.2: AI Filter Guardian
// ============================================================

const anthropic = new Anthropic();

export interface FilterGuardianInput {
  ideaName: string;
  ideaDescription: string;
  ideaClassification: string | null;
  strategicFilters: Array<{ id: string; name: string; description: string }>;
  bhag: string;
}

export interface IdeaFilterResult {
  filter_id: string;
  filter_name: string;
  passed: boolean;
  reasoning: string;
  ai_generated: boolean;
}

export interface FilterGuardianResult {
  results: IdeaFilterResult[];
  confidence: "high" | "medium" | "low";
  summary: string;
  sourceInputs: string[];
}

function buildSystemPrompt(bhag: string, filterCount: number): string {
  return `You are the TrueNorth Filter Guardian, an AI agent that evaluates business ideas against a venture's strategic filters.

The venture's BHAG (Big Hairy Audacious Goal):
"${bhag}"

Your job:
1. Evaluate the idea against EACH strategic filter provided.
2. For each filter, determine if the idea PASSES (aligns with / satisfies the filter) or FAILS (does not align).
3. Provide 2-3 sentences of reasoning for each filter evaluation.
4. Provide an overall confidence level and a brief summary.

Confidence levels:
- "high": The idea description provides enough context to evaluate all ${filterCount} filters with clear reasoning.
- "medium": Some filters are ambiguous — the idea partially relates but the description lacks specifics.
- "low": The idea description is too vague or short to make reliable evaluations.

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "evaluations": [
    {
      "filter_id": "<the filter id>",
      "filter_name": "<the filter name>",
      "passed": true,
      "reasoning": "2-3 sentence explanation."
    }
  ],
  "confidence": "high",
  "summary": "Brief 1-2 sentence overall assessment."
}`;
}

function buildUserMessage(input: FilterGuardianInput): string {
  const classificationNote = input.ideaClassification
    ? `Classification: ${input.ideaClassification}`
    : "Classification: not yet assigned";

  const filterList = input.strategicFilters
    .map(
      (f, i) =>
        `${i + 1}. Filter ID: "${f.id}" | Name: "${f.name}" | Description: "${f.description}"`
    )
    .join("\n");

  return `Evaluate this idea against the strategic filters below.

Idea: ${input.ideaName}
Description: ${input.ideaDescription}
${classificationNote}

Strategic Filters:
${filterList}`;
}

interface ClaudeFilterEvaluation {
  filter_id: string;
  filter_name: string;
  passed: boolean;
  reasoning: string;
}

interface ClaudeFilterResponse {
  evaluations: ClaudeFilterEvaluation[];
  confidence: "high" | "medium" | "low";
  summary: string;
}

export async function evaluateIdeaAgainstFilters(
  input: FilterGuardianInput,
  supabase?: SupabaseClient,
  orgId?: string,
  ideaId?: string
): Promise<FilterGuardianResult> {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt(
    input.bhag,
    input.strategicFilters.length
  );
  const userMessage = buildUserMessage(input);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textContent = message.content.find((c) => c.type === "text");
  const rawText = textContent?.type === "text" ? textContent.text : "";

  // Parse JSON response from Claude
  let parsed: ClaudeFilterResponse;
  try {
    parsed = JSON.parse(rawText) as ClaudeFilterResponse;
  } catch {
    // If parsing fails, return low confidence with empty results
    return {
      results: input.strategicFilters.map((f) => ({
        filter_id: f.id,
        filter_name: f.name,
        passed: false,
        reasoning: "AI evaluation failed to produce valid results.",
        ai_generated: true,
      })),
      confidence: "low",
      summary: "AI evaluation could not parse results. Please review manually.",
      sourceInputs: [
        "idea description",
        "BHAG",
        `${input.strategicFilters.length} strategic filters`,
      ],
    };
  }

  // Map parsed evaluations to IdeaFilterResult with ai_generated flag
  const results: IdeaFilterResult[] = parsed.evaluations.map((evaluation) => ({
    filter_id: evaluation.filter_id,
    filter_name: evaluation.filter_name,
    passed: evaluation.passed,
    reasoning: evaluation.reasoning,
    ai_generated: true,
  }));

  // Validate confidence
  const validConfidences = ["high", "medium", "low"] as const;
  const confidence = validConfidences.includes(
    parsed.confidence as (typeof validConfidences)[number]
  )
    ? (parsed.confidence as "high" | "medium" | "low")
    : "medium";

  const result: FilterGuardianResult = {
    results,
    confidence,
    summary: parsed.summary || "Evaluation complete.",
    sourceInputs: [
      "idea description",
      "BHAG",
      `${input.strategicFilters.length} strategic filters`,
    ],
  };

  // Log AI action
  if (supabase && orgId) {
    const passCount = results.filter((r) => r.passed).length;
    await logAiAction(supabase, {
      orgId,
      agentCategory: "filter_guardian",
      actionType: "evaluation",
      entityId: ideaId,
      entityType: "idea",
      inputSummary: `Evaluated "${input.ideaName}" against ${input.strategicFilters.length} filters`,
      outputSummary: `${passCount}/${results.length} filters passed. ${result.summary}`,
      confidence,
      processingTimeMs: Date.now() - startTime,
    });
  }

  return result;
}
