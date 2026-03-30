import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/run-workflow
 *
 * Manually trigger a workflow execution from the UI.
 * Creates a workflow_execution row and enqueues agent_tasks for the first step(s).
 * TrueNorth owns orchestration — Hermes picks up individual tasks.
 *
 * Body: { workflowId, triggerContext? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workflowId, triggerContext } = await request.json();
  if (!workflowId) {
    return NextResponse.json({ error: "Missing workflowId" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Fetch the workflow template
  const { data: template, error: templateErr } = await serviceClient
    .from("workflow_templates")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (templateErr || !template) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (!template.enabled) {
    return NextResponse.json({ error: "Workflow is disabled" }, { status: 400 });
  }

  const steps = (template.steps ?? []) as Array<{
    order: number;
    agent_profile: string;
    action: string;
    prompt_template?: string;
    input_mapping?: Record<string, string>;
    output_key?: string;
    depends_on?: number[];
    parallel_group?: string;
  }>;

  if (steps.length === 0) {
    return NextResponse.json({ error: "Workflow has no steps" }, { status: 400 });
  }

  // Create execution record
  const { data: execution, error: execErr } = await serviceClient
    .from("workflow_executions")
    .insert({
      organization_id: template.organization_id,
      workflow_template_id: workflowId,
      status: "running",
      trigger_context: triggerContext ?? { source: "manual", user_id: user.id },
      current_step: 1,
      total_steps: steps.length,
      triggered_by: user.id,
    })
    .select("id")
    .single();

  if (execErr || !execution) {
    return NextResponse.json(
      { error: "Failed to create execution", details: execErr?.message },
      { status: 500 }
    );
  }

  // Find initial steps (those with no dependencies)
  const initialSteps = steps.filter(
    (s) => !s.depends_on || s.depends_on.length === 0
  );

  // Create agent_tasks for initial steps
  for (const step of initialSteps) {
    const prompt = step.prompt_template ?? `Execute workflow step: ${step.action}`;

    await serviceClient.from("agent_tasks").insert({
      organization_id: template.organization_id,
      agent_profile: step.agent_profile,
      title: `[Workflow] ${template.name} — Step ${step.order}: ${step.action}`,
      description: prompt,
      status: "submitted",
      priority: "normal",
      input_data: {
        workflow_execution_id: execution.id,
        workflow_template_id: workflowId,
        step_order: step.order,
        action: step.action,
        prompt: prompt,
        trigger_context: triggerContext ?? {},
      },
      submitted_by: user.id,
      requires_human_review: false, // Workflow steps auto-advance
      run_metadata: {
        workflow_execution_id: execution.id,
        step_order: step.order,
      },
    });
  }

  return NextResponse.json({
    executionId: execution.id,
    status: "running",
    stepsQueued: initialSteps.length,
    totalSteps: steps.length,
  });
}
