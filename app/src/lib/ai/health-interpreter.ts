import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { OperatingHealthReport } from "@/types/database";
import { logAiAction } from "./action-log";

// ============================================================
// Health Interpreter Agent (Phase 4)
//
// Interprets Operating Health changes and recommends actions.
// Triggered weekly via cron and on-demand from the dashboard.
// ============================================================

const anthropic = new Anthropic();

export interface HealthInterpretation {
  interpretation: string;
  recommendedAction: string;
  urgency: "critical" | "important" | "suggested";
  confidence: "high" | "medium" | "low";
}

const SYSTEM_PROMPT = `You are the TrueNorth Health Interpreter, an AI agent that analyzes behavioral culture metrics for a digital media company.

You receive the current Operating Health report (6 metrics, each 0-100 with trends) and recent history. Your job is to:

1. Identify the most significant change or pattern across the metrics
2. Explain WHY it matters in 2-3 sentences (not just what changed, but the organizational implication)
3. Recommend ONE specific action the operator should take

Metric definitions:
- Decision Velocity: How fast decisions go from opened to decided. Slower = possible bureaucracy or unclear authority.
- Blocker Half-Life: Median time to resolve blockers. Longer = execution friction increasing.
- Strategy Connection Rate: % of daily pulse items linked to bets/KPIs. Lower = team drifting from strategy.
- Execution Cadence Health: Composite of pulse frequency, commitment completion, and sync attendance.
- Cross-Venture Collaboration: How often work references span ventures. Higher = more cross-pollination.
- Kill Courage: Ratio of early bet kills vs. bets that limp. Higher = healthier decision-making culture.

Rules:
- Be specific. Reference the exact metric names and values.
- Don't just restate numbers — interpret their organizational meaning.
- The recommended action should be concrete (e.g., "Review the 3 open decisions with Alex" not "improve decision-making").
- If everything is green and stable, acknowledge it and suggest a proactive improvement.

Return ONLY valid JSON:
{
  "interpretation": "string — 2-3 sentence analysis",
  "recommendedAction": "string — one specific action",
  "urgency": "critical" | "important" | "suggested",
  "confidence": "high" | "medium" | "low"
}`;

export async function interpretHealthReport(
  supabase: SupabaseClient,
  orgId: string,
  report: OperatingHealthReport
): Promise<HealthInterpretation> {
  const startTime = Date.now();

  // Fetch recent snapshots for trend context
  const { data: recentSnapshots } = await supabase
    .from("operating_health_snapshots")
    .select("composite_score, composite_status, metrics, created_at")
    .eq("organization_id", orgId)
    .eq("venture_id", report.venture_id)
    .order("created_at", { ascending: false })
    .limit(4);

  const context = {
    current: {
      composite_score: report.composite_score,
      composite_status: report.composite_status,
      metrics: Object.entries(report.metrics).map(([key, m]) => ({
        key,
        label: m.label,
        value: m.value,
        unit: m.unit,
        status: m.status,
        trend: m.trend,
        trend_delta: m.trend_delta,
      })),
    },
    recentHistory: (recentSnapshots ?? []).map((s) => ({
      date: s.created_at,
      score: s.composite_score,
      status: s.composite_status,
    })),
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the current Operating Health report:\n\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = JSON.parse(raw) as HealthInterpretation;

    await logAiAction(supabase, {
      orgId,
      agentCategory: "health_interpreter",
      actionType: "recommendation",
      inputSummary: `Operating Health composite: ${report.composite_score} (${report.composite_status})`,
      outputSummary: `[${parsed.urgency}] ${parsed.recommendedAction}`,
      confidence: parsed.confidence,
      processingTimeMs: Date.now() - startTime,
    });

    return parsed;
  } catch (error) {
    console.error("Health Interpreter AI error:", error);
    return {
      interpretation: "The automated health analysis could not be completed. Review the Operating Health dashboard manually for the latest metrics.",
      recommendedAction: "Check the Operating Health dashboard and review any red or declining metrics.",
      urgency: "suggested",
      confidence: "low",
    };
  }
}
