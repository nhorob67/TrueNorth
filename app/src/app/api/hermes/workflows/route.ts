import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyHermesSecret } from "@/lib/hermes/verify-secret";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/hermes/workflows
 *
 * VPS reports step completion for a workflow execution.
 * TrueNorth advances the workflow: enqueues the next dependent steps
 * or marks the execution as completed/failed.
 *
 * Body: {
 *   executionId: string,
 *   stepOrder: number,
 *   status: "completed" | "failed",
 *   output?: unknown,
 *   taskId?: string,
 *   error?: string
 * }
 */
export async function PATCH(request: Request) {
  if (!verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { executionId, stepOrder, status, output, taskId, error: stepError } = await request.json();

  if (!executionId || stepOrder === undefined || !status) {
    return NextResponse.json(
      { error: "Missing required fields: executionId, stepOrder, status" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Fetch the execution and its template
  const { data: execution } = await supabase
    .from("workflow_executions")
    .select("*, workflow_templates(*)")
    .eq("id", executionId)
    .single();

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  if (execution.status !== "running") {
    return NextResponse.json({ error: "Execution is not running" }, { status: 400 });
  }

  const template = Array.isArray(execution.workflow_templates)
    ? execution.workflow_templates[0]
    : execution.workflow_templates;

  const steps = (template?.steps ?? []) as Array<{
    order: number;
    agent_profile: string;
    action: string;
    prompt_template?: string;
    input_mapping?: Record<string, string>;
    output_key?: string;
    depends_on?: number[];
  }>;

  // Record step result
  const stepResults = [...(execution.step_results as Array<Record<string, unknown>>)];
  stepResults.push({
    step_order: stepOrder,
    agent_profile: steps.find((s) => s.order === stepOrder)?.agent_profile ?? "unknown",
    status,
    task_id: taskId ?? null,
    output: output ?? null,
    error: stepError ?? null,
    completed_at: new Date().toISOString(),
  });

  // If step failed, fail the entire workflow
  if (status === "failed") {
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        step_results: stepResults,
        completed_at: new Date().toISOString(),
        error_message: stepError ?? `Step ${stepOrder} failed`,
      })
      .eq("id", executionId);

    return NextResponse.json({ workflowStatus: "failed", reason: stepError });
  }

  // Find which steps are now unblocked
  const completedStepOrders = new Set(
    stepResults
      .filter((r) => r.status === "completed")
      .map((r) => r.step_order as number)
  );

  const nextSteps = steps.filter((s) => {
    // Already completed?
    if (completedStepOrders.has(s.order)) return false;
    // Already queued (check step_results for any entry)?
    if (stepResults.some((r) => r.step_order === s.order)) return false;
    // All dependencies completed?
    const deps = s.depends_on ?? [];
    return deps.every((d) => completedStepOrders.has(d));
  });

  // Check if workflow is complete (all steps done, no more to queue)
  const allStepsComplete = steps.every((s) => completedStepOrders.has(s.order)) && nextSteps.length === 0;

  if (allStepsComplete) {
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        step_results: stepResults,
        current_step: steps.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    return NextResponse.json({ workflowStatus: "completed", stepsCompleted: stepResults.length });
  }

  // Enqueue next steps as agent_tasks
  // Build a context map from completed step outputs for input_mapping
  const outputMap: Record<string, unknown> = {};
  for (const result of stepResults) {
    if (result.status === "completed" && result.output) {
      const step = steps.find((s) => s.order === result.step_order);
      if (step) {
        outputMap[`step_${result.step_order}`] = result.output;
        if (step.output_key) {
          outputMap[step.output_key] = result.output;
        }
      }
    }
  }

  for (const step of nextSteps) {
    // Resolve input_mapping: replace $steps.N.output references with actual data
    let prompt = step.prompt_template ?? `Execute: ${step.action}`;
    if (step.input_mapping) {
      for (const [key, ref] of Object.entries(step.input_mapping)) {
        const resolved = resolveRef(ref, outputMap);
        if (resolved !== undefined) {
          prompt += `\n\n${key}: ${typeof resolved === "string" ? resolved : JSON.stringify(resolved)}`;
        }
      }
    }

    await supabase.from("agent_tasks").insert({
      organization_id: execution.organization_id,
      agent_profile: step.agent_profile,
      title: `[Workflow] ${template.name} — Step ${step.order}: ${step.action}`,
      description: prompt,
      status: "submitted",
      priority: "normal",
      input_data: {
        workflow_execution_id: executionId,
        workflow_template_id: execution.workflow_template_id,
        step_order: step.order,
        action: step.action,
        prompt,
        previous_outputs: outputMap,
      },
      requires_human_review: false,
      run_metadata: {
        workflow_execution_id: executionId,
        step_order: step.order,
      },
    });
  }

  // Update execution progress
  await supabase
    .from("workflow_executions")
    .update({
      step_results: stepResults,
      current_step: Math.max(...completedStepOrders) + 1,
    })
    .eq("id", executionId);

  return NextResponse.json({
    workflowStatus: "running",
    stepsCompleted: completedStepOrders.size,
    stepsQueued: nextSteps.length,
    totalSteps: steps.length,
  });
}

function resolveRef(ref: string, outputMap: Record<string, unknown>): unknown {
  // Supports: "$steps.1.output", "$step_1", or direct key references
  if (ref.startsWith("$steps.")) {
    const parts = ref.slice(7).split(".");
    const stepNum = parts[0];
    return outputMap[`step_${stepNum}`];
  }
  if (ref.startsWith("$")) {
    return outputMap[ref.slice(1)];
  }
  return ref;
}
