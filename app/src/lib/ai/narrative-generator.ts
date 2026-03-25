import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { NarrativeType, NarrativeDataSnapshot } from "@/types/database";
import { logAiAction } from "./action-log";
import { collectNarrativeData } from "./narrative-collector";

// ============================================================
// AI Narrative Generator (Phase 4)
//
// Auto-generates polished written narratives from operational
// data collected across all pillars.
// ============================================================

const anthropic = new Anthropic();

interface NarrativeTemplate {
  type: NarrativeType;
  label: string;
  description: string;
  defaultWindowDays: number;
  systemPrompt: string;
}

const TEMPLATES: NarrativeTemplate[] = [
  {
    type: "weekly_team_update",
    label: "Weekly Team Update",
    description: "Casual 3-5 paragraph update covering wins, focus areas, watch items, and shoutouts.",
    defaultWindowDays: 7,
    systemPrompt: `You are a writer for a company's internal weekly team update. Write in a warm, direct, conversational tone — like a trusted team lead addressing their team.

Structure your update with these sections:
## Wins
Highlight what was shipped, completed, or achieved. Be specific — name the bet, KPI, or move.

## Focus This Week
What bets and moves are the team focused on? What milestones are coming up?

## Watch Items
Red or yellow KPIs, aging blockers, missed commitments. Frame as "here's what needs attention" not "here's what's wrong."

## Shoutouts
Call out individuals with high pulse streaks, shipped moves, or resolved blockers. Keep it genuine.

Guidelines:
- 3-5 paragraphs per section, concise but specific
- Use names of bets, KPIs, and moves — never be vague
- If data is sparse, acknowledge it briefly and focus on what IS there
- End on an energizing note
- Do NOT use bullet points excessively — write in paragraphs with occasional bullets
- Return the narrative as clean HTML (h2 for sections, p for paragraphs, strong for emphasis, ul/li for lists where needed)`,
  },
  {
    type: "monthly_board_memo",
    label: "Monthly Board Memo",
    description: "Formal structured memo with executive summary, KPI dashboard, bet updates, and risks.",
    defaultWindowDays: 30,
    systemPrompt: `You are writing a monthly board memo for a digital media company. Write in a professional, data-driven tone — clear and concise, respecting the reader's time.

Structure:
## Executive Summary
One paragraph summarizing the month: overall trajectory, biggest win, biggest concern.

## KPI Dashboard
Table-style summary of key metrics: name, current value, target, status (green/yellow/red), trend. Highlight biggest movers with % change.

## Strategic Bets Update
For each active bet: status, moves shipped vs. planned, key milestones hit, any blockers.

## Key Decisions Made
List decisions with one-line context and outcome.

## Operating Health
Overall score and notable metric changes (decision velocity, blocker resolution, etc.)

## Risks & Mitigations
Red/yellow KPIs, aging blockers, stalled bets. For each, state the mitigation.

## Next Month Focus
Top 3 priorities based on current state.

Guidelines:
- Be direct and factual
- Use tables (HTML) for data-heavy sections
- Quantify everything possible
- Flag what needs board input or decision
- Return as clean HTML`,
  },
  {
    type: "investor_update",
    label: "Investor Update",
    description: "Data-heavy, concise update with key metrics, progress, and team health.",
    defaultWindowDays: 30,
    systemPrompt: `You are writing a monthly investor update for a digital media company. Investors want signal, not noise. Be honest, data-forward, and concise.

Structure:
## Key Metrics
Table of 5-8 most important KPIs with current value, target, and trend.

## Progress Against Annual Outcomes
Brief update on each annual outcome — what moved, what didn't.

## Bet Portfolio
Active bets with one-line status each.

## Content & Funnel Performance
Content published, funnel health, notable audience growth.

## Team Health
Operating health score, pulse activity, team engagement signals.

## Ask
If there's anything the team needs from investors (intros, advice, capital), state it clearly. If not, omit this section.

Guidelines:
- Maximum 400 words total
- Lead with the most important number
- Be honest about misses — investors respect candor
- Return as clean HTML`,
  },
  {
    type: "all_hands_talking_points",
    label: "All-Hands Talking Points",
    description: "Bullet-format conversational points for a team all-hands meeting.",
    defaultWindowDays: 7,
    systemPrompt: `You are preparing talking points for a company all-hands meeting. These will be spoken aloud by a team lead. Write in a conversational, energizing tone.

Structure:
## Big Wins
3-5 bullets of what went well — shipped moves, KPI improvements, content milestones.

## What We're Working On
3-5 bullets on current bet focus and upcoming milestones.

## Where We Need Help
2-3 bullets on blockers, at-risk KPIs, or areas where the team can pitch in.

## Upcoming Milestones
3-5 bullets of what's due in the next 1-2 weeks.

Guidelines:
- Each bullet should be speakable in one breath
- Use names of team members where relevant (for shoutouts)
- Keep energy high — this is a rallying moment
- Total length: ~200-300 words
- Return as clean HTML (h2 for sections, ul/li for bullets)`,
  },
  {
    type: "quarterly_retrospective",
    label: "Quarterly Retrospective",
    description: "Reflective narrative covering goals vs. actuals, bet scorecard, and lessons learned.",
    defaultWindowDays: 90,
    systemPrompt: `You are writing a quarterly retrospective for a digital media company. This is a reflective document — honest, analytical, forward-looking.

Structure:
## Quarter in Review
One paragraph overview: what was the thesis for this quarter, and how did reality compare?

## Goals vs. Actuals
For each annual outcome: what was planned, what happened, gap analysis.

## Bet Scorecard
For each bet (active, completed, or killed): outcome, moves shipped, KPI impact, grade (A/B/C/D/F).

## KPI Trajectory
Which KPIs improved, which declined, which stayed flat. Biggest surprises.

## Biggest Lessons
3-5 lessons learned — be specific and honest.

## Next Quarter Preview
Based on what we learned, what should change? What bets should we consider?

Guidelines:
- Be analytically honest — don't sugarcoat misses
- Use data to support every claim
- Lessons should be actionable, not platitudes
- Total length: 600-1000 words
- Return as clean HTML`,
  },
];

export function getTemplates(): NarrativeTemplate[] {
  return TEMPLATES;
}

export function getTemplateByType(type: NarrativeType): NarrativeTemplate | undefined {
  return TEMPLATES.find((t) => t.type === type);
}

export interface GenerateNarrativeInput {
  orgId: string;
  ventureId: string | null;
  narrativeType: NarrativeType;
  startDate: string;
  endDate: string;
  userId: string;
  isSingleVenture?: boolean;
  additionalContext?: string;
}

export interface GenerateNarrativeResult {
  html: string;
  title: string;
  confidence: "high" | "medium" | "low";
  sourceEntityIds: string[];
  dataSnapshot: NarrativeDataSnapshot;
}

export async function generateNarrative(
  supabase: SupabaseClient,
  input: GenerateNarrativeInput
): Promise<GenerateNarrativeResult> {
  const template = getTemplateByType(input.narrativeType);
  if (!template) throw new Error(`Unknown narrative type: ${input.narrativeType}`);

  const startTime = Date.now();

  // Collect data
  const snapshot = await collectNarrativeData(
    supabase,
    input.orgId,
    input.ventureId,
    input.startDate,
    input.endDate,
    input.isSingleVenture
  );

  // Determine data richness → confidence
  const dataPoints = [
    snapshot.kpis.total > 0,
    snapshot.pulses.totalSubmitted > 0,
    snapshot.bets.active > 0,
    snapshot.decisions.length > 0,
    snapshot.commitments.completed + snapshot.commitments.missed > 0,
    snapshot.contentOutput.published > 0,
  ];
  const richness = dataPoints.filter(Boolean).length;
  const confidence: "high" | "medium" | "low" =
    richness >= 5 ? "high" : richness >= 3 ? "medium" : "low";

  // Build user message with collected data
  const userMessage = buildUserMessage(snapshot, input.additionalContext);

  // Generate with Claude
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: template.systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  const html = textBlock?.type === "text" ? textBlock.text : "";

  // Generate a title
  const title = generateTitle(template, input.startDate, input.endDate);

  // Log AI action
  await logAiAction(supabase, {
    orgId: input.orgId,
    agentCategory: "narrative_generator",
    actionType: "generation",
    inputSummary: `Generated ${template.label} for ${input.startDate} to ${input.endDate}`,
    outputSummary: `${title} (${confidence} confidence, ${html.length} chars)`,
    confidence,
    processingTimeMs: Date.now() - startTime,
  });

  return {
    html,
    title,
    confidence,
    sourceEntityIds: [],
    dataSnapshot: snapshot,
  };
}

function buildUserMessage(snapshot: NarrativeDataSnapshot, additionalContext?: string): string {
  const parts: string[] = [];

  parts.push(`# Operational Data for ${snapshot.timeWindow.start} to ${snapshot.timeWindow.end}\n`);

  // KPIs
  parts.push(`## KPI Summary`);
  parts.push(`Total active: ${snapshot.kpis.total} | Green: ${snapshot.kpis.green} | Yellow: ${snapshot.kpis.yellow} | Red: ${snapshot.kpis.red}`);
  if (snapshot.kpis.biggestMovers.length > 0) {
    parts.push(`Biggest movers:`);
    for (const m of snapshot.kpis.biggestMovers) {
      parts.push(`  - ${m.name}: ${m.change_pct > 0 ? "+" : ""}${m.change_pct}% (${m.direction})`);
    }
  }

  // Bets
  parts.push(`\n## Bets`);
  parts.push(`Active bets: ${snapshot.bets.active}`);
  parts.push(`Moves shipped: ${snapshot.bets.movesShipped} | Cut: ${snapshot.bets.movesCut}`);
  parts.push(`New blockers: ${snapshot.bets.newBlockers}`);

  // Pulses
  parts.push(`\n## Pulse Activity`);
  parts.push(`Total pulses: ${snapshot.pulses.totalSubmitted} from ${snapshot.pulses.uniqueContributors} contributors`);
  if (snapshot.pulses.topShippedItems.length > 0) {
    parts.push(`Top shipped items:`);
    for (const item of snapshot.pulses.topShippedItems.slice(0, 5)) {
      parts.push(`  - ${item}`);
    }
  }
  if (snapshot.pulses.recurringBlockerThemes.length > 0) {
    parts.push(`Recurring blocker themes:`);
    for (const theme of snapshot.pulses.recurringBlockerThemes.slice(0, 3)) {
      parts.push(`  - ${theme}`);
    }
  }
  if (snapshot.pulses.signalHighlights.length > 0) {
    parts.push(`Signal highlights:`);
    for (const signal of snapshot.pulses.signalHighlights.slice(0, 3)) {
      parts.push(`  - ${signal}`);
    }
  }

  // Decisions
  if (snapshot.decisions.length > 0) {
    parts.push(`\n## Decisions Made (${snapshot.decisions.length})`);
    for (const d of snapshot.decisions) {
      parts.push(`  - "${d.title}": ${d.final_decision}`);
    }
  }

  // Content
  parts.push(`\n## Content Output`);
  parts.push(`Published: ${snapshot.contentOutput.published}`);
  if (Object.keys(snapshot.contentOutput.byMachineType).length > 0) {
    parts.push(`By type: ${JSON.stringify(snapshot.contentOutput.byMachineType)}`);
  }

  // Commitments
  parts.push(`\n## Commitments`);
  parts.push(`Completed: ${snapshot.commitments.completed} | Missed: ${snapshot.commitments.missed} | New: ${snapshot.commitments.newCreated}`);

  // Operating Health
  if (snapshot.operatingHealth) {
    parts.push(`\n## Operating Health`);
    parts.push(`Composite Score: ${snapshot.operatingHealth.compositeScore}/100 (${snapshot.operatingHealth.compositeStatus})`);
    for (const m of snapshot.operatingHealth.metricSummaries) {
      parts.push(`  - ${m.label}: ${m.value} (${m.status}, ${m.trend})`);
    }
  }

  // Blockers resolved
  if (snapshot.blockersResolved.length > 0) {
    parts.push(`\n## Blockers Resolved (${snapshot.blockersResolved.length})`);
    for (const b of snapshot.blockersResolved.slice(0, 5)) {
      parts.push(`  - [${b.severity}] ${b.description}`);
    }
  }

  if (additionalContext) {
    parts.push(`\n## Additional Context from Author`);
    parts.push(additionalContext);
  }

  return parts.join("\n");
}

function generateTitle(template: NarrativeTemplate, startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  switch (template.type) {
    case "weekly_team_update":
      return `Weekly Update — ${formatDate(start)} to ${formatDate(end)}`;
    case "monthly_board_memo":
      return `Board Memo — ${start.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
    case "investor_update":
      return `Investor Update — ${start.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
    case "all_hands_talking_points":
      return `All-Hands Talking Points — ${formatDate(start)} to ${formatDate(end)}`;
    case "quarterly_retrospective":
      return `Q${Math.ceil((start.getMonth() + 1) / 3)} ${start.getFullYear()} Retrospective`;
    default:
      return `Narrative — ${formatDate(start)} to ${formatDate(end)}`;
  }
}

// ============================================================
// Save Generated Narrative
// ============================================================

export async function saveNarrative(
  supabase: SupabaseClient,
  input: GenerateNarrativeInput,
  result: GenerateNarrativeResult
): Promise<string | null> {
  const { data, error } = await supabase
    .from("generated_narratives")
    .insert({
      organization_id: input.orgId,
      venture_id: input.ventureId,
      narrative_type: input.narrativeType,
      title: result.title,
      body_json: { sections: result.html },
      body_html: result.html,
      time_window_start: input.startDate.split("T")[0],
      time_window_end: input.endDate.split("T")[0],
      source_entity_ids: result.sourceEntityIds,
      confidence: result.confidence,
      generated_by: input.userId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save narrative:", error);
    return null;
  }

  return data.id;
}

// ============================================================
// Fetch Narrative History
// ============================================================

export async function getNarrativeHistory(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string | null,
  limit: number = 20
) {
  let query = supabase
    .from("generated_narratives")
    .select("id, narrative_type, title, confidence, generated_by, created_at, time_window_start, time_window_end")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data } = await query;
  return data ?? [];
}
