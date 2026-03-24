import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { logAiAction } from "./action-log";

// ============================================================
// Cockpit Advisor Agent (PRD Section 3.8)
//
// Analyses the operational state and recommends the single most
// important action an operator should take today.
// ============================================================

const anthropic = new Anthropic();

export interface AdvisorRecommendation {
  action: string;
  reasoning: string;
  entityType?: string;
  entityId?: string;
  urgency: "critical" | "important" | "suggested";
  confidence: "high" | "medium" | "low";
}

const SYSTEM_PROMPT = `You are the TrueNorth Cockpit Advisor, an AI agent inside a business operating system for digital media companies.

Analyze the operational state and recommend the SINGLE most important action the operator should take today.

Rules:
- Be specific and actionable. Name the exact entity (KPI, bet, blocker, commitment) involved.
- Explain WHY this is the top priority in 1-2 sentences.
- Critical: something is failing and needs immediate intervention.
- Important: something needs attention today to prevent future failure.
- Suggested: an improvement opportunity that would strengthen operations.
- Prioritisation order: red KPIs > aging blockers (>3d) > overdue commitments > stalled bets > yellow KPIs > missed pulses > upcoming milestones.

Return ONLY a valid JSON object (no markdown, no commentary):
{
  "action": "string — the specific recommended action",
  "reasoning": "string — why this is the #1 priority",
  "entityType": "string or omit",
  "entityId": "string or omit",
  "urgency": "critical" | "important" | "suggested",
  "confidence": "high" | "medium" | "low"
}`;

export async function generateDailyAdvice(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string
): Promise<AdvisorRecommendation> {
  const fortyEightHours = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: redKpis },
    { data: yellowKpis },
    { data: openBlockers },
    { data: overdueCommitments },
    { data: activeBets },
    { data: todayPulses },
    { data: upcomingMilestones },
  ] = await Promise.all([
    supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, unit")
      .eq("organization_id", orgId)
      .eq("lifecycle_status", "active")
      .eq("health_status", "red"),
    supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, unit, updated_at")
      .eq("organization_id", orgId)
      .eq("lifecycle_status", "active")
      .eq("health_status", "yellow"),
    supabase
      .from("blockers")
      .select("id, description, severity, created_at")
      .eq("organization_id", orgId)
      .eq("resolution_state", "open")
      .order("created_at"),
    supabase
      .from("commitments")
      .select("id, description, due_date, status")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .not("due_date", "is", null)
      .lte("due_date", today),
    supabase
      .from("bets")
      .select("id, outcome, health_status, updated_at")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("lifecycle_status", "active"),
    supabase
      .from("pulses")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("date", today),
    supabase
      .from("moves")
      .select("id, title, due_date, bet_id, updated_at")
      .eq("organization_id", orgId)
      .eq("type", "milestone")
      .in("lifecycle_status", ["not_started", "in_progress"])
      .lte("due_date", fortyEightHours)
      .order("due_date"),
  ]);

  // Compute blocker ages
  const blockersWithAge = (openBlockers ?? []).map((b) => ({
    ...b,
    age_days: Math.floor(
      (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
  const agingBlockers = blockersWithAge.filter((b) => b.age_days > 3);

  // Find stalled bets (no update in 10+ days)
  const stalledBets = (activeBets ?? []).filter(
    (b) => b.updated_at && new Date(b.updated_at).toISOString() < tenDaysAgo
  );

  // Filter yellow KPIs that have been yellow for 2+ weeks
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const longYellowKpis = (yellowKpis ?? []).filter(
    (k) => k.updated_at && k.updated_at < twoWeeksAgo
  );

  // Enhanced: Milestone moves due within 48h with no recent status change
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stalledMilestones = ((upcomingMilestones ?? []) as Array<{ id: string; title: string; due_date: string; bet_id: string; updated_at?: string }>).filter(
    (m) => !m.updated_at || m.updated_at < sevenDaysAgo
  );

  // Enhanced: Recurring moves at risk of missing cycle target
  const { data: recurringMoves } = await supabase
    .from("moves")
    .select("id, title, cadence, target_per_cycle, bet_id")
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .eq("type", "recurring")
    .eq("lifecycle_status", "in_progress");

  const atRiskRhythms: Array<{
    moveTitle: string;
    pending: number;
    target: number;
    daysRemaining: number;
  }> = [];

  for (const rm of recurringMoves ?? []) {
    const now = new Date();
    const { data: pendingInstances } = await supabase
      .from("move_instances")
      .select("id, cycle_end")
      .eq("move_id", rm.id)
      .eq("status", "pending")
      .lte("cycle_end", fortyEightHours);

    if (pendingInstances && pendingInstances.length > 0) {
      const target = rm.target_per_cycle ?? 1;
      const nearest = pendingInstances[0];
      const daysRemaining = nearest
        ? Math.max(
            0,
            Math.ceil(
              (new Date(nearest.cycle_end).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0;
      if (pendingInstances.length >= target && daysRemaining <= 2) {
        atRiskRhythms.push({
          moveTitle: rm.title,
          pending: pendingInstances.length,
          target,
          daysRemaining,
        });
      }
    }
  }

  // Enhanced: Bets where all moves are green but KPIs trending down
  const greenBetsRedKpis: Array<{
    betOutcome: string;
    redKpiNames: string[];
  }> = [];

  for (const bet of activeBets ?? []) {
    const { data: betMoves } = await supabase
      .from("moves")
      .select("health_status")
      .eq("bet_id", bet.id)
      .not("lifecycle_status", "in", '("cut","shipped")');

    const allGreen =
      (betMoves ?? []).length > 0 &&
      (betMoves ?? []).every((m) => m.health_status === "green");

    if (allGreen) {
      const { data: betKpiLinks } = await supabase
        .from("kpi_links")
        .select("kpi_id")
        .eq("linked_entity_type", "bet")
        .eq("linked_entity_id", bet.id);

      const betKpiIds = (betKpiLinks ?? []).map((l) => l.kpi_id);
      if (betKpiIds.length > 0) {
        const { data: betKpis } = await supabase
          .from("kpis")
          .select("name, health_status")
          .in("id", betKpiIds)
          .in("health_status", ["red", "yellow"]);

        if (betKpis && betKpis.length > 0) {
          greenBetsRedKpis.push({
            betOutcome: bet.outcome,
            redKpiNames: betKpis.map((k) => k.name),
          });
        }
      }
    }
  }

  const context = {
    redKpis: redKpis ?? [],
    longYellowKpis,
    agingBlockers,
    overdueCommitments: overdueCommitments ?? [],
    stalledBets,
    pulsesSubmittedToday: (todayPulses ?? []).length,
    upcomingMilestones: upcomingMilestones ?? [],
    // Enhanced signals
    stalledMilestonesNearDeadline: stalledMilestones,
    atRiskRhythms,
    greenBetsWithDecliningKpis: greenBetsRedKpis,
  };

  const userMessage = `Here is the current operational state for this venture. Recommend the single most important action:\n\n${JSON.stringify(context, null, 2)}`;

  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = JSON.parse(raw) as AdvisorRecommendation;

    // Log AI action
    await logAiAction(supabase, {
      orgId,
      agentCategory: "cockpit_advisor",
      actionType: "recommendation",
      entityId: parsed.entityId,
      entityType: parsed.entityType,
      inputSummary: `Analyzed ${(redKpis ?? []).length} red KPIs, ${agingBlockers.length} aging blockers, ${(overdueCommitments ?? []).length} overdue commitments`,
      outputSummary: `[${parsed.urgency}] ${parsed.action}`,
      confidence: parsed.confidence,
      processingTimeMs: Date.now() - startTime,
    });

    return parsed;
  } catch (error) {
    console.error("Cockpit Advisor AI error:", error);
    return {
      action: "Review the cockpit dashboard — AI advisor encountered an error generating today's recommendation.",
      reasoning: "The automated analysis could not be completed. Manual review of red KPIs and open blockers is recommended.",
      urgency: "important",
      confidence: "low",
    };
  }
}
