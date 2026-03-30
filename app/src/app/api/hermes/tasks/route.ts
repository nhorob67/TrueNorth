import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyHermesSecret } from "@/lib/hermes/verify-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/hermes/tasks?profile=xxx
 *
 * Returns pending tasks for a specific Hermes agent profile.
 * Hermes VPS polls this endpoint to pick up work.
 */
export async function GET(request: Request) {
  if (!verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profile = searchParams.get("profile");

  if (!profile) {
    return NextResponse.json(
      { error: "Missing required query param: profile" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: tasks, error } = await supabase
    .from("agent_tasks")
    .select("id, organization_id, venture_id, title, description, status, priority, entity_id, entity_type, input_data, requires_human_review, automation_level_at_submission, retry_count, max_retries, created_at")
    .eq("agent_profile", profile)
    .eq("status", "submitted")
    .order("priority", { ascending: false }) // urgent first
    .order("created_at", { ascending: true }) // oldest first within priority
    .limit(5);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch tasks", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ tasks: tasks ?? [] });
}

/**
 * PATCH /api/hermes/tasks
 *
 * Update a task's status, output, or error from the Hermes VPS.
 * Body: { taskId, status?, output_data?, error_message?, run_metadata?, claim_token? }
 */
export async function PATCH(request: Request) {
  if (!verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { taskId, status, output_data, error_message, run_metadata, claim_token } = body;

  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const updates: Record<string, unknown> = {};

  if (status) {
    updates.status = status;

    if (status === "assigned" || status === "running") {
      updates.started_at = new Date().toISOString();
      updates.claimed_at = new Date().toISOString();
      if (claim_token) updates.claim_token = claim_token;

      // Update agent connection status
      const { data: task } = await supabase
        .from("agent_tasks")
        .select("agent_profile")
        .eq("id", taskId)
        .single();

      if (task) {
        await supabase
          .from("agents")
          .update({
            connection_status: "busy",
            current_task_id: taskId,
            last_heartbeat_at: new Date().toISOString(),
          })
          .eq("hermes_profile_name", task.agent_profile);
      }
    }

    if (status === "review" || status === "done" || status === "failed") {
      updates.completed_at = new Date().toISOString();

      // Clear agent busy state
      const { data: task } = await supabase
        .from("agent_tasks")
        .select("agent_profile")
        .eq("id", taskId)
        .single();

      if (task) {
        await supabase
          .from("agents")
          .update({
            connection_status: "idle",
            current_task_id: null,
            last_heartbeat_at: new Date().toISOString(),
            last_error: status === "failed" ? (error_message ?? null) : null,
          })
          .eq("hermes_profile_name", task.agent_profile);
      }
    }
  }

  if (output_data !== undefined) updates.output_data = output_data;
  if (error_message !== undefined) updates.error_message = error_message;
  if (run_metadata !== undefined) updates.run_metadata = run_metadata;

  const { error } = await supabase
    .from("agent_tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update task", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
