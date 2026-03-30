import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agents/status
 *
 * Check status of a specific task or list all agent profiles.
 * Query params: ?taskId=xxx OR (nothing for agent overview)
 * Authenticated via Supabase session.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  // Task-specific status
  if (taskId) {
    const { data: task, error } = await supabase
      .from("agent_tasks")
      .select("id, agent_profile, status, priority, title, output_data, error_message, created_at, started_at, completed_at")
      .eq("id", taskId)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  }

  // Agent overview: all hermes-enabled agents with connection status
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, category, hermes_profile_name, hermes_enabled, hermes_runtime, connection_status, last_heartbeat_at, current_task_id, last_error")
    .eq("hermes_enabled", true)
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch agents", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ profiles: agents ?? [] });
}
