import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// Launch Assistant — AI-powered import and guidance for onboarding
//
// Two capabilities:
// 1. Parse unstructured text into structured TrueNorth entities
// 2. Generate contextual step guidance based on existing context
// ============================================================

const anthropic = new Anthropic();

export type ImportTargetType = "kpis" | "bets" | "filters" | "outcomes";

export interface ParseImportResult {
  items: Array<Record<string, unknown>>;
  confidence: "high" | "medium" | "low";
  suggestions: string[];
}

export interface StepGuidanceResult {
  guidance: string;
  examples: string[];
  tips: string[];
}

export interface StepContext {
  ventureName?: string;
  bhag?: string;
  filters?: string[];
  outcomes?: string[];
  kpis?: string[];
  bets?: string[];
}

// ============================================================
// Parse unstructured text into structured entities
// ============================================================

const PARSE_SYSTEM_PROMPT = `You are the TrueNorth Launch Assistant, an AI that helps operators set up their business operating system.

You parse unstructured text (from docs, spreadsheets, notes) into structured TrueNorth entities.

Return ONLY valid JSON matching the requested format. No markdown, no explanation outside the JSON.`;

function buildParseUserPrompt(text: string, targetType: ImportTargetType): string {
  const formatInstructions: Record<ImportTargetType, string> = {
    kpis: `Extract KPIs from the text. For each KPI, extract:
- name: string (the metric name)
- target: number | null (the target value if mentioned)
- unit: string | null (the unit of measurement, e.g., "$", "%", "users")
- frequency: string | null (how often it's measured: "daily", "weekly", "monthly")

Return JSON: { "items": [{ "name": "...", "target": ..., "unit": "...", "frequency": "..." }], "confidence": "high"|"medium"|"low", "suggestions": ["..."] }`,

    bets: `Extract quarterly bets/initiatives from the text. For each bet, extract:
- outcome: string (what success looks like)
- mechanism: string | null (how it will be achieved)

Return JSON: { "items": [{ "outcome": "...", "mechanism": "..." }], "confidence": "high"|"medium"|"low", "suggestions": ["..."] }`,

    filters: `Extract strategic filters (decision criteria) from the text. For each filter, extract:
- name: string (a short name for the filter)
- description: string | null (longer explanation of the filter)

Return JSON: { "items": [{ "name": "...", "description": "..." }], "confidence": "high"|"medium"|"low", "suggestions": ["..."] }`,

    outcomes: `Extract annual outcomes/goals from the text. For each outcome, extract:
- description: string (what must be true by year-end)
- metric: string | null (how you'll measure it)

Return JSON: { "items": [{ "description": "...", "metric": "..." }], "confidence": "high"|"medium"|"low", "suggestions": ["..."] }`,
  };

  return `Parse the following text and extract ${targetType}.

${formatInstructions[targetType]}

Set confidence based on how cleanly the text maps:
- "high": text clearly contains structured ${targetType} data
- "medium": text contains some relevant info but requires interpretation
- "low": text is vague or only loosely related

Add 1-3 suggestions for improving or completing the extracted data.

Text to parse:
"""
${text}
"""`;
}

export async function parseImportText(
  text: string,
  targetType: ImportTargetType
): Promise<ParseImportResult> {
  if (!text.trim()) {
    return { items: [], confidence: "low", suggestions: ["Please paste some text to parse."] };
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: PARSE_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildParseUserPrompt(text, targetType) },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    return { items: [], confidence: "low", suggestions: ["Failed to parse response."] };
  }

  try {
    const parsed = JSON.parse(content.text) as ParseImportResult;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      confidence: parsed.confidence ?? "medium",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return { items: [], confidence: "low", suggestions: ["AI response was not valid JSON. Try simplifying your input."] };
  }
}

// ============================================================
// Generate contextual step guidance
// ============================================================

const GUIDANCE_SYSTEM_PROMPT = `You are the TrueNorth Launch Assistant. You help operators set up their business operating system by providing contextual guidance during onboarding.

You provide:
1. A brief guidance paragraph (2-3 sentences) explaining the current step
2. 2-3 concrete examples relevant to their venture
3. 2-3 actionable tips

Respond with ONLY valid JSON. No markdown, no explanation outside the JSON.`;

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "naming their venture",
  2: "defining their Big Hairy Audacious Goal (BHAG) — a 10-25 year vision",
  3: "setting strategic filters — criteria for saying yes or no to new ideas",
  4: "defining annual outcomes — what must be true by year-end",
  5: "building their KPI scoreboard — the metrics that matter most",
  6: "choosing quarterly bets — up to 3 focused initiatives",
  7: "inviting team members",
  8: "submitting their first daily pulse",
  9: "scheduling their weekly sync meeting",
  10: "setting up their monthly review cadence",
};

export async function generateStepGuidance(
  step: number,
  existingContext: StepContext
): Promise<StepGuidanceResult> {
  const stepDesc = STEP_DESCRIPTIONS[step] ?? `step ${step}`;

  const contextParts: string[] = [];
  if (existingContext.ventureName) {
    contextParts.push(`Venture name: "${existingContext.ventureName}"`);
  }
  if (existingContext.bhag) {
    contextParts.push(`BHAG: "${existingContext.bhag}"`);
  }
  if (existingContext.filters?.length) {
    contextParts.push(`Strategic filters: ${existingContext.filters.join(", ")}`);
  }
  if (existingContext.outcomes?.length) {
    contextParts.push(`Annual outcomes: ${existingContext.outcomes.join(", ")}`);
  }
  if (existingContext.kpis?.length) {
    contextParts.push(`KPIs: ${existingContext.kpis.join(", ")}`);
  }
  if (existingContext.bets?.length) {
    contextParts.push(`Bets: ${existingContext.bets.join(", ")}`);
  }

  const contextBlock = contextParts.length > 0
    ? `\n\nExisting context from previous steps:\n${contextParts.join("\n")}`
    : "\n\nNo previous context available yet (this is an early step).";

  const prompt = `The operator is currently ${stepDesc}.${contextBlock}

Generate guidance for this step. Examples and tips should build on the existing context when available. For instance, if they've set a BHAG, suggest filters that align with it. If they have filters, suggest outcomes that pass them.

Return JSON: { "guidance": "...", "examples": ["...", "..."], "tips": ["...", "..."] }`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: GUIDANCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    return { guidance: "", examples: [], tips: [] };
  }

  try {
    const parsed = JSON.parse(content.text) as StepGuidanceResult;
    return {
      guidance: parsed.guidance ?? "",
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    };
  } catch {
    return { guidance: "", examples: [], tips: [] };
  }
}
