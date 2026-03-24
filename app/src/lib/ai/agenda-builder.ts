import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { logAiAction } from "./action-log";

// ============================================================
// Agenda Builder Agent (PRD Section 3.7)
//
// Generates structured meeting agendas by analysing operational
// data (KPIs, blockers, commitments, bets, pulses, etc.) and
// asking Claude to prioritise discussion items.
// ============================================================

const anthropic = new Anthropic();

export interface AgendaItem {
  text: string;
  priority: "high" | "medium" | "low";
  entityType?: string;
  entityId?: string;
}

export interface AgendaSection {
  title: string;
  duration_minutes: number;
  items: AgendaItem[];
  notes: string;
}

export interface GeneratedAgenda {
  meeting_type: "weekly_sync" | "monthly_review" | "quarterly_summit";
  sections: AgendaSection[];
  ai_summary: string;
  confidence: "high" | "medium" | "low";
}

type MeetingType = "weekly_sync" | "monthly_review" | "quarterly_summit";

// ------------------------------------------------------------------
// Data fetching helpers
// ------------------------------------------------------------------

async function fetchWeeklyContext(supabase: SupabaseClient, orgId: string, ventureId: string) {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const fortyEightHours = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [
    { data: redYellowKpis },
    { data: openBlockers },
    { data: pendingDecisions },
    { data: recentPulses },
    { data: atRiskBets },
    { data: overdueCommitments },
    { data: upcomingMilestones },
  ] = await Promise.all([
    supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, unit")
      .eq("organization_id", orgId)
      .eq("lifecycle_status", "active")
      .in("health_status", ["red", "yellow"]),
    supabase
      .from("blockers")
      .select("id, description, severity, created_at")
      .eq("organization_id", orgId)
      .eq("resolution_state", "open")
      .order("created_at"),
    supabase
      .from("decisions")
      .select("id, title, created_at")
      .eq("organization_id", orgId)
      .is("decided_at", null),
    supabase
      .from("pulses")
      .select("id, user_id, mood, energy, blockers_text, wins, date")
      .eq("organization_id", orgId)
      .gte("date", fiveDaysAgo),
    supabase
      .from("bets")
      .select("id, outcome, health_status")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("lifecycle_status", "active")
      .in("health_status", ["red", "yellow"]),
    supabase
      .from("commitments")
      .select("id, description, due_date, status")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .not("due_date", "is", null)
      .lte("due_date", new Date().toISOString().split("T")[0]),
    supabase
      .from("moves")
      .select("id, title, due_date, bet_id")
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

  return {
    redYellowKpis: redYellowKpis ?? [],
    openBlockers: blockersWithAge,
    pendingDecisions: pendingDecisions ?? [],
    recentPulses: recentPulses ?? [],
    atRiskBets: atRiskBets ?? [],
    overdueCommitments: overdueCommitments ?? [],
    upcomingMilestones: upcomingMilestones ?? [],
  };
}

async function fetchMonthlyContext(supabase: SupabaseClient, orgId: string, ventureId: string) {
  const weekly = await fetchWeeklyContext(supabase, orgId, ventureId);

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { data: kpiSnapshots },
    { data: completedCommitments },
    { data: totalCommitments },
    { data: graveyardBets },
  ] = await Promise.all([
    supabase
      .from("kpi_snapshots")
      .select("kpi_id, value, snapshot_date")
      .eq("organization_id", orgId)
      .gte("snapshot_date", fourWeeksAgo)
      .order("snapshot_date"),
    supabase
      .from("commitments")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .gte("updated_at", fourWeeksAgo),
    supabase
      .from("commitments")
      .select("id")
      .eq("organization_id", orgId)
      .gte("created_at", fourWeeksAgo),
    supabase
      .from("bets")
      .select("id, outcome, health_status")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("lifecycle_status", "killed")
      .gte("updated_at", startOfMonth.toISOString()),
  ]);

  const completionRate =
    (totalCommitments ?? []).length > 0
      ? Math.round(
          ((completedCommitments ?? []).length / (totalCommitments ?? []).length) * 100
        )
      : null;

  return {
    ...weekly,
    kpiTrends: kpiSnapshots ?? [],
    commitmentCompletionRate: completionRate,
    graveyardBets: graveyardBets ?? [],
  };
}

async function fetchQuarterlyContext(supabase: SupabaseClient, orgId: string, ventureId: string) {
  const monthly = await fetchMonthlyContext(supabase, orgId, ventureId);

  const [
    { data: vision },
    { data: ideaVault },
    { data: allBets },
  ] = await Promise.all([
    supabase
      .from("ventures")
      .select("settings")
      .eq("id", ventureId)
      .single(),
    supabase
      .from("ideas")
      .select("id, title, score, created_at")
      .eq("organization_id", orgId)
      .eq("lifecycle_status", "active")
      .order("score", { ascending: false })
      .limit(10),
    supabase
      .from("bets")
      .select("id, outcome, health_status, grade")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .eq("lifecycle_status", "active"),
  ]);

  return {
    ...monthly,
    visionSettings: vision?.settings ?? {},
    topIdeas: ideaVault ?? [],
    allActiveBets: allBets ?? [],
  };
}

// ------------------------------------------------------------------
// System prompt
// ------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the TrueNorth Agenda Builder, an AI agent inside a business operating system for digital media companies.

Your job is to generate a structured meeting agenda based on the current operational state of a venture.

Rules:
- Prioritise items that need immediate decisions or are blocking progress.
- Allocate time proportional to the urgency and complexity of each section.
- Keep agendas focused. A weekly sync should be 30-60 min. A monthly review 60-90 min. A quarterly summit 90-180 min.
- Items in red health status or with aging blockers get HIGH priority.
- Always include a brief "wins & celebrations" section to maintain team morale.
- End with clear next-steps / commitments.

Return ONLY a valid JSON object matching this schema (no markdown, no commentary):
{
  "meeting_type": "weekly_sync" | "monthly_review" | "quarterly_summit",
  "sections": [
    {
      "title": "string",
      "duration_minutes": number,
      "items": [
        { "text": "string", "priority": "high" | "medium" | "low", "entityType": "string or omit", "entityId": "string or omit" }
      ],
      "notes": "string — facilitator notes"
    }
  ],
  "ai_summary": "string — one-paragraph executive summary of the agenda rationale",
  "confidence": "high" | "medium" | "low"
}`;

// ------------------------------------------------------------------
// Main export
// ------------------------------------------------------------------

export async function generateMeetingAgenda(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string,
  meetingType: MeetingType
): Promise<GeneratedAgenda> {
  // Fetch context based on meeting type
  let context: Record<string, unknown>;
  switch (meetingType) {
    case "weekly_sync":
      context = await fetchWeeklyContext(supabase, orgId, ventureId);
      break;
    case "monthly_review":
      context = await fetchMonthlyContext(supabase, orgId, ventureId);
      break;
    case "quarterly_summit":
      context = await fetchQuarterlyContext(supabase, orgId, ventureId);
      break;
  }

  const userMessage = `Generate a ${meetingType.replace("_", " ")} agenda for the following operational state:\n\n${JSON.stringify(context, null, 2)}`;

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
    const parsed = JSON.parse(raw) as GeneratedAgenda;

    // Ensure meeting_type is set correctly
    parsed.meeting_type = meetingType;

    // Log AI action
    const totalItems = parsed.sections.reduce((sum, s) => sum + s.items.length, 0);
    await logAiAction(supabase, {
      orgId,
      agentCategory: "agenda_builder",
      actionType: "generation",
      inputSummary: `Generated ${meetingType.replace("_", " ")} agenda from operational data`,
      outputSummary: `${parsed.sections.length} sections, ${totalItems} items. ${parsed.ai_summary}`,
      confidence: parsed.confidence,
      processingTimeMs: Date.now() - startTime,
    });

    return parsed;
  } catch (error) {
    console.error("Agenda Builder AI error:", error);
    // Return a minimal fallback agenda
    return {
      meeting_type: meetingType,
      sections: [
        {
          title: "Review & Discussion",
          duration_minutes: 30,
          items: [
            {
              text: "AI agenda generation failed — review operational dashboard manually",
              priority: "high",
            },
          ],
          notes: "Fallback agenda generated due to AI processing error.",
        },
      ],
      ai_summary: "Agenda generation encountered an error. Please review the cockpit dashboard for current priorities.",
      confidence: "low",
    };
  }
}
