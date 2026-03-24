import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { logAiAction } from "./action-log";

// ============================================================
// Kill Switch Agent (PRD Section 3.16)
//
// Evaluates each active bet's execution signals and KPI outcomes,
// recommending: continue, pause, or kill.
// ============================================================

const anthropic = new Anthropic();

export interface BetSignal {
  signal: string;
  verdict: "positive" | "negative" | "neutral";
}

export interface BetAssessment {
  betId: string;
  betOutcome: string;
  recommendation: "continue" | "pause" | "kill";
  confidence: "high" | "medium" | "low";
  reasoning: string;
  signals: BetSignal[];
}

const SYSTEM_PROMPT = `You are the TrueNorth Kill Switch agent, an AI inside a business operating system for digital media companies.

For each bet, analyze execution signals and KPI outcomes to recommend one of:
- "continue": on track, keep executing
- "pause": needs investigation — execution is faltering or signals are mixed
- "kill": failing with low recovery chance — recommend shutting it down

Evaluation criteria (in priority order):
1. KPI health of linked lead indicators (red = negative, green = positive)
2. Move velocity: milestones completed vs total (low ratio = negative)
3. Rhythm compliance: recurring move completion rates
4. Blocker density: active blockers on moves (high = negative)
5. Age of bet (older bets with poor signals = stronger kill signal)
6. Proof criteria progress

Return ONLY a valid JSON array (no markdown, no commentary):
[
  {
    "betId": "string",
    "betOutcome": "string",
    "recommendation": "continue" | "pause" | "kill",
    "confidence": "high" | "medium" | "low",
    "reasoning": "string — 1-2 sentence explanation",
    "signals": [
      { "signal": "string — description of signal", "verdict": "positive" | "negative" | "neutral" }
    ]
  }
]`;

interface BetContext {
  id: string;
  outcome: string;
  health_status: string;
  grade: string | null;
  created_at: string;
  proof_criteria: unknown;
  linkedKpis: Array<{
    id: string;
    name: string;
    health_status: string;
    current_value: number | null;
    target: number | null;
  }>;
  totalMilestones: number;
  completedMilestones: number;
  recentMoves: number;
  activeBlockers: number;
  recurringMoveCompletionRate: number | null;
  // Enhanced signals (3.2)
  moveVelocity14d: { shipped: number; total: number };
  rhythmCompliance: { completed: number; total: number; rate: number | null };
  blockerDensity: number;
  kpiTrendVsMoveExecution: "aligned" | "diverging" | "insufficient_data";
}

async function gatherBetContext(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string
): Promise<BetContext[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all active bets
  const { data: bets } = await supabase
    .from("bets")
    .select("id, outcome, health_status, grade, created_at, proof_criteria")
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .eq("lifecycle_status", "active");

  if (!bets || bets.length === 0) return [];

  const betIds = bets.map((b) => b.id);

  // Fetch all related data in parallel
  const [
    { data: allMoves },
    { data: allBlockerLinks },
    { data: kpiLinks },
  ] = await Promise.all([
    supabase
      .from("moves")
      .select("id, bet_id, lifecycle_status, type, updated_at")
      .eq("organization_id", orgId)
      .in("bet_id", betIds),
    supabase
      .from("blockers")
      .select("id, linked_entity_id")
      .eq("organization_id", orgId)
      .eq("resolution_state", "open")
      .eq("linked_entity_type", "move"),
    supabase
      .from("kpi_links")
      .select("kpi_id, linked_entity_id")
      .eq("linked_entity_type", "bet")
      .in("linked_entity_id", betIds),
  ]);

  // Fetch linked KPI details
  const kpiIds = [...new Set((kpiLinks ?? []).map((l) => l.kpi_id))];
  const { data: kpis } = kpiIds.length > 0
    ? await supabase
        .from("kpis")
        .select("id, name, health_status, current_value, target")
        .in("id", kpiIds)
    : { data: [] as Array<{ id: string; name: string; health_status: string; current_value: number | null; target: number | null }> };

  const kpiMap = new Map((kpis ?? []).map((k) => [k.id, k]));
  const moves = allMoves ?? [];
  const blockerLinks = allBlockerLinks ?? [];

  // Build per-move blocker set
  const moveIdsWithBlockers = new Set(
    blockerLinks.map((b) => b.linked_entity_id).filter(Boolean)
  );

  return bets.map((bet) => {
    const betMoves = moves.filter((m) => m.bet_id === bet.id);
    const milestones = betMoves.filter((m) => m.type === "milestone");
    const completedMilestones = milestones.filter(
      (m) => m.lifecycle_status === "completed"
    );
    const recentMoves = betMoves.filter(
      (m) =>
        m.lifecycle_status === "completed" &&
        m.updated_at &&
        m.updated_at >= fourteenDaysAgo
    );
    const activeBlockers = betMoves.filter((m) =>
      moveIdsWithBlockers.has(m.id)
    ).length;

    // Recurring move completion rate (rolling 3 cycles approximation)
    const recurringMoves = betMoves.filter((m) => m.type === "recurring");
    const recurringCompleted = recurringMoves.filter(
      (m) => m.lifecycle_status === "completed"
    );
    const recurringRate =
      recurringMoves.length > 0
        ? Math.round((recurringCompleted.length / recurringMoves.length) * 100)
        : null;

    // Linked KPIs
    const betKpiLinks = (kpiLinks ?? []).filter(
      (l) => l.linked_entity_id === bet.id
    );
    const linkedKpis = betKpiLinks
      .map((l) => kpiMap.get(l.kpi_id))
      .filter(Boolean) as Array<{
        id: string;
        name: string;
        health_status: string;
        current_value: number | null;
        target: number | null;
      }>;

    // Enhanced signals: Move velocity (14-day window)
    const shippedRecent = milestones.filter(
      (m) =>
        m.lifecycle_status === "completed" &&
        m.updated_at &&
        m.updated_at >= fourteenDaysAgo
    ).length;
    const moveVelocity14d = {
      shipped: shippedRecent,
      total: milestones.length,
    };

    // Rhythm compliance: recurring move completion rates
    const rhythmCompliance = {
      completed: recurringCompleted.length,
      total: recurringMoves.length,
      rate: recurringRate,
    };

    // Blocker density: count of moves with active blockers / total moves
    const blockerDensity =
      betMoves.length > 0
        ? Math.round((activeBlockers / betMoves.length) * 100)
        : 0;

    // Divergence detection: KPI health vs move execution
    const kpiRedCount = linkedKpis.filter(
      (k) => k.health_status === "red"
    ).length;
    const kpiGreenCount = linkedKpis.filter(
      (k) => k.health_status === "green"
    ).length;
    const movesExecuting = recentMoves.length > 0;
    let kpiTrendVsMoveExecution: "aligned" | "diverging" | "insufficient_data" =
      "insufficient_data";
    if (linkedKpis.length > 0 && betMoves.length > 0) {
      if (kpiRedCount > kpiGreenCount && movesExecuting) {
        kpiTrendVsMoveExecution = "diverging"; // executing but KPIs declining
      } else if (kpiGreenCount >= kpiRedCount) {
        kpiTrendVsMoveExecution = "aligned";
      } else {
        kpiTrendVsMoveExecution = "diverging";
      }
    }

    return {
      id: bet.id,
      outcome: bet.outcome,
      health_status: bet.health_status,
      grade: bet.grade,
      created_at: bet.created_at,
      proof_criteria: bet.proof_criteria,
      linkedKpis,
      totalMilestones: milestones.length,
      completedMilestones: completedMilestones.length,
      recentMoves: recentMoves.length,
      activeBlockers,
      recurringMoveCompletionRate: recurringRate,
      moveVelocity14d,
      rhythmCompliance,
      blockerDensity,
      kpiTrendVsMoveExecution,
    };
  });
}

export async function assessBets(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string
): Promise<BetAssessment[]> {
  const betContexts = await gatherBetContext(supabase, orgId, ventureId);

  if (betContexts.length === 0) {
    return [];
  }

  // Add age in weeks
  const enriched = betContexts.map((b) => ({
    ...b,
    age_weeks: Math.floor(
      (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24 * 7)
    ),
  }));

  const userMessage = `Assess the following active bets and provide continue/pause/kill recommendations:\n\n${JSON.stringify(enriched, null, 2)}`;

  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = JSON.parse(raw) as BetAssessment[];

    // Ensure betId and betOutcome are present from context if AI missed them
    const results = parsed.map((assessment, i) => ({
      ...assessment,
      betId: assessment.betId || enriched[i]?.id || "",
      betOutcome: assessment.betOutcome || enriched[i]?.outcome || "",
    }));

    // Log each bet assessment as a separate AI action
    const elapsed = Date.now() - startTime;
    for (const assessment of results) {
      await logAiAction(supabase, {
        orgId,
        agentCategory: "kill_switch",
        actionType: "assessment",
        entityId: assessment.betId,
        entityType: "bet",
        inputSummary: `Kill-switch assessment for bet "${assessment.betOutcome}"`,
        outputSummary: `Recommendation: ${assessment.recommendation}. ${assessment.reasoning}`,
        confidence: assessment.confidence,
        processingTimeMs: Math.round(elapsed / results.length),
      });
    }

    return results;
  } catch (error) {
    console.error("Kill Switch AI error:", error);
    // Return neutral fallback for each bet
    return betContexts.map((bet) => ({
      betId: bet.id,
      betOutcome: bet.outcome,
      recommendation: "continue" as const,
      confidence: "low" as const,
      reasoning: "Kill Switch analysis could not be completed. Manual review recommended.",
      signals: [
        {
          signal: "Automated assessment unavailable",
          verdict: "neutral" as const,
        },
      ],
    }));
  }
}
