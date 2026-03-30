import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persist a Hermes VPS trigger result as an agent_task for Cockpit Inbox review.
 *
 * Extracts a human-readable title and summary from the VPS response,
 * inserts into agent_tasks with status='review', and returns the task ID.
 *
 * Fire-and-forget safe — errors are logged but never thrown.
 */
export async function persistVpsResult(
  supabase: SupabaseClient,
  opts: {
    orgId: string;
    ventureId?: string;
    agentProfile: string;
    agentCategory: string;
    vpsResult: Record<string, unknown>;
    entityId?: string;
    entityType?: string;
  }
): Promise<string | null> {
  try {
    const output = opts.vpsResult.output as string | undefined;

    // Try to extract structured JSON from the output
    let parsed: Record<string, unknown> | null = null;
    if (output) {
      const jsonMatch = output.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          // Not valid JSON — use raw output
        }
      }
    }

    // Build a human-readable title
    const title = buildTitle(opts.agentCategory, parsed);

    // Build output_data for the review card
    const outputData: Record<string, unknown> = {
      source: "hermes",
      profile: opts.agentProfile,
      session_id: opts.vpsResult.sessionId ?? null,
      raw_output: output?.slice(0, 5000) ?? null,
    };

    if (parsed) {
      outputData.structured = parsed;
      outputData.summary = extractSummary(opts.agentCategory, parsed);
    }

    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({
        organization_id: opts.orgId,
        venture_id: opts.ventureId ?? null,
        agent_profile: opts.agentProfile,
        title,
        description: `Hermes agent result for review`,
        status: "review",
        priority: inferPriority(opts.agentCategory, parsed),
        entity_id: opts.entityId ?? null,
        entity_type: opts.entityType ?? null,
        input_data: {
          trigger: "cron",
          agent_category: opts.agentCategory,
        },
        output_data: outputData,
        requires_human_review: true,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to persist VPS result for ${opts.agentProfile}:`, error.message);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error(
      `Error persisting VPS result for ${opts.agentProfile}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Build a human-readable title from the agent category and parsed output.
 */
function buildTitle(
  category: string,
  parsed: Record<string, unknown> | null
): string {
  const labels: Record<string, string> = {
    bet_tracker: "Bet Tracker Assessment",
    signal_watch: "Signal Watch Report",
    filter_guardian: "Filter Guardian Evaluation",
    agenda_builder: "Meeting Agenda",
    cockpit_advisor: "Cockpit Recommendation",
    vault_archaeologist: "Resurfaced Ideas",
    dispatch_scribe: "Dispatch Scribe Update",
    funnel_watchdog: "Funnel Health Report",
    community_pulse: "Community Pulse Report",
    content_copilot: "Content Draft",
    launch_assistant: "Launch Status",
  };

  const base = labels[category] ?? `Agent Report (${category})`;

  if (!parsed) return base;

  // Try to add context from the parsed result
  if (category === "bet_tracker" && parsed.summary) {
    const s = parsed.summary as Record<string, number>;
    return `${base}: ${s.continue ?? 0} continue, ${s.pause ?? 0} pause, ${s.kill ?? 0} kill`;
  }

  if (category === "cockpit_advisor" && parsed.action) {
    return `${base}: ${(parsed.action as string).slice(0, 60)}`;
  }

  return base;
}

/**
 * Extract a short summary string for the review card.
 */
function extractSummary(
  category: string,
  parsed: Record<string, unknown>
): string {
  if (category === "bet_tracker") {
    const bets = parsed.bets as Array<Record<string, unknown>> | undefined;
    if (bets?.length) {
      return bets
        .map((b) => `${b.outcome}: ${b.recommendation} (${b.confidence})`)
        .join("; ");
    }
  }

  if (category === "cockpit_advisor") {
    return (parsed.reasoning as string)?.slice(0, 200) ?? "";
  }

  if (category === "signal_watch") {
    const alerts = (parsed.alerts ?? parsed.totalAlerts) as number | undefined;
    if (alerts !== undefined) return `${alerts} alerts detected`;
  }

  if (category === "vault_archaeologist") {
    const total = parsed.totalResurfaced as number | undefined;
    if (total !== undefined) return `${total} ideas resurfaced`;
  }

  if (category === "agenda_builder") {
    return (parsed.ai_summary as string)?.slice(0, 200) ?? "Agenda prepared";
  }

  // Fallback: stringify first 200 chars
  const str = JSON.stringify(parsed);
  return str.length > 200 ? str.slice(0, 200) + "..." : str;
}

/**
 * Infer priority from the agent category and parsed result.
 */
function inferPriority(
  category: string,
  parsed: Record<string, unknown> | null
): "low" | "normal" | "high" | "urgent" {
  if (!parsed) return "normal";

  if (category === "bet_tracker") {
    const s = parsed.summary as Record<string, number> | undefined;
    if (s?.kill && s.kill > 0) return "urgent";
    if (s?.pause && s.pause > 0) return "high";
  }

  if (category === "cockpit_advisor") {
    const urgency = parsed.urgency as string | undefined;
    if (urgency === "critical") return "urgent";
    if (urgency === "high") return "high";
  }

  return "normal";
}
