import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// AI Process Improvement Suggestions
//
// BUILDPLAN 3.13: "AI-assisted improvement suggestions (monthly
// review of process performance data)"
//
// Analyzes a process alongside its linked KPI health and
// automation level to suggest improvements.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { processId } = body;

  if (!processId) {
    return NextResponse.json({ error: "Missing processId" }, { status: 400 });
  }

  // Fetch the process with linked KPIs and bets
  const { data: process } = await supabase
    .from("processes")
    .select("name, description, trigger_conditions, automation_level, version, linked_kpi_ids, linked_bet_ids")
    .eq("id", processId)
    .single();

  if (!process) {
    return NextResponse.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch linked KPI health
  let kpiContext = "";
  if (process.linked_kpi_ids?.length > 0) {
    const { data: kpis } = await supabase
      .from("kpis")
      .select("name, health_status, current_value, target, unit")
      .in("id", process.linked_kpi_ids);

    if (kpis) {
      kpiContext = kpis
        .map(
          (k) =>
            `- ${k.name}: ${k.health_status} (${k.current_value ?? "N/A"} ${k.unit ?? ""} / target ${k.target ?? "N/A"})`
        )
        .join("\n");
    }
  }

  // Fetch linked bet health
  let betContext = "";
  if (process.linked_bet_ids?.length > 0) {
    const { data: bets } = await supabase
      .from("bets")
      .select("outcome, health_status")
      .in("id", process.linked_bet_ids);

    if (bets) {
      betContext = bets
        .map((b) => `- ${b.outcome}: ${b.health_status}`)
        .join("\n");
    }
  }

  const automationLabels = [
    "L0 Manual",
    "L1 Assisted",
    "L2 Partial",
    "L3 Conditional",
    "L4 Full",
  ];

  const prompt = `You are an operational improvement advisor for a business operating system called TrueNorth.

Analyze this process and suggest 3-5 concrete improvements:

**Process:** ${process.name}
**Description:** ${process.description ?? "No description"}
**Trigger conditions:** ${process.trigger_conditions ?? "Not specified"}
**Automation level:** ${automationLabels[process.automation_level] ?? "Unknown"}
**Version:** ${process.version} (${process.version > 5 ? "frequently updated" : "relatively stable"})

${kpiContext ? `**Linked KPIs:**\n${kpiContext}` : "No linked KPIs."}
${betContext ? `**Linked Bets:**\n${betContext}` : "No linked bets."}

For each suggestion, provide:
1. A short title (5-10 words)
2. Why it matters (1 sentence connecting to KPI/bet health if relevant)
3. Concrete next step

Also assess whether the automation level could be advanced (and if so, what would need to be true).

Return as JSON: { "suggestions": [{ "title": string, "why": string, "nextStep": string }], "automationAdvice": string }`;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json(parsed);
    }

    return NextResponse.json({
      suggestions: [
        {
          title: "Analysis complete",
          why: text.slice(0, 200),
          nextStep: "Review the AI output above.",
        },
      ],
      automationAdvice: "",
    });
  } catch (err) {
    console.error("AI process suggestion failed:", err);
    return NextResponse.json(
      { error: "AI analysis failed" },
      { status: 500 }
    );
  }
}
