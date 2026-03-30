import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/submit-task
 *
 * Submit an async task to an agent. Inserts into agent_tasks table.
 * Authenticated via Supabase session (user-initiated) or CRON_SECRET (cron-initiated).
 *
 * Body: { profile, title, description?, prompt?, orgId, ventureId?, entityId?, entityType?, priority? }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { profile, title, description, prompt, orgId, ventureId, entityId, entityType, priority } = body;

  if (!profile || !title || !orgId) {
    return NextResponse.json(
      { error: "Missing required fields: profile, title, orgId" },
      { status: 400 }
    );
  }

  // Determine auth: cron secret or user session
  let supabase;
  let submittedBy: string | null = null;

  if (verifyCronSecret(request)) {
    supabase = createServiceClient();
  } else {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    submittedBy = user.id;
  }

  // Verify agent exists
  const serviceClient = createServiceClient();
  const { data: agent } = await serviceClient
    .from("agents")
    .select("id, automation_level, hermes_enabled")
    .eq("organization_id", orgId)
    .eq("hermes_profile_name", profile)
    .single();

  if (!agent) {
    return NextResponse.json(
      { error: `Agent profile '${profile}' not found` },
      { status: 404 }
    );
  }

  // Determine if human review is required based on automation level
  const requiresReview = agent.automation_level < 3;

  const { data: task, error } = await serviceClient
    .from("agent_tasks")
    .insert({
      organization_id: orgId,
      venture_id: ventureId ?? null,
      agent_profile: profile,
      title,
      description: description ?? prompt ?? null,
      status: "submitted",
      priority: priority ?? "normal",
      entity_id: entityId ?? null,
      entity_type: entityType ?? null,
      input_data: prompt ? { prompt } : {},
      submitted_by: submittedBy,
      requires_human_review: requiresReview,
      automation_level_at_submission: agent.automation_level,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create task", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ taskId: task.id, status: "submitted", profile });
}
