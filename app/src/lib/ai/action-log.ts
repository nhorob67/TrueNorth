import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// AI Action Logging Library
//
// Provides a consistent interface for AI agents to log their
// actions and for humans to record outcomes (accept/override/ignore).
// ============================================================

export interface LogAiActionInput {
  orgId: string;
  agentCategory: string;
  actionType: string;
  entityId?: string;
  entityType?: string;
  inputSummary: string;
  outputSummary: string;
  confidence?: string;
  processingTimeMs?: number;
}

/**
 * Log an AI action to the ai_actions table.
 * Returns the action ID for later outcome recording.
 */
export async function logAiAction(
  supabase: SupabaseClient,
  action: LogAiActionInput
): Promise<string> {
  const { data, error } = await supabase
    .from("ai_actions")
    .insert({
      organization_id: action.orgId,
      agent_category: action.agentCategory,
      action_type: action.actionType,
      entity_id: action.entityId ?? null,
      entity_type: action.entityType ?? null,
      input_summary: action.inputSummary,
      output_summary: action.outputSummary,
      outcome: "pending",
      confidence: action.confidence ?? null,
      processing_time_ms: action.processingTimeMs ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to log AI action:", error);
    // Return empty string on failure — callers should not block on logging
    return "";
  }

  return data.id;
}

/**
 * Record the outcome of a previously logged AI action.
 */
export async function recordActionOutcome(
  supabase: SupabaseClient,
  actionId: string,
  outcome: string,
  overrideReason?: string
): Promise<void> {
  if (!actionId) return;

  const { error } = await supabase
    .from("ai_actions")
    .update({
      outcome,
      override_reason: overrideReason ?? null,
    })
    .eq("id", actionId);

  if (error) {
    console.error("Failed to record action outcome:", error);
  }
}
