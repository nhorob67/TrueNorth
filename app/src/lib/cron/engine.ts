import { SupabaseClient } from "@supabase/supabase-js";
import { executeTemplate, CronTemplateResult } from "./templates";
import { postToDiscordWebhook } from "./discord";
import { applyFormatTemplate } from "./format";

// ============================================================
// Cron Execution Engine
// ============================================================

export interface ExecutionResult {
  jobId: string;
  status: "success" | "error";
  result: CronTemplateResult | null;
  error?: string;
  discordResult?: { ok: boolean; status: number; statusText: string };
}

// ============================================================
// Conditional Logic
// ============================================================

export interface JobConditions {
  only_if_data?: boolean;
  threshold?: { template: string; min_items: number };
  day_filter?: "weekday" | "month_start";
}

/**
 * Check if all conditions are met for executing a job.
 * Returns true if the job should run.
 */
async function checkConditions(
  conditions: JobConditions,
  supabase: SupabaseClient,
  orgId: string,
  ventureId?: string | null,
  templateResult?: CronTemplateResult | null
): Promise<{ shouldRun: boolean; reason?: string }> {
  // Day filter: weekday — only run Mon-Fri
  if (conditions.day_filter === "weekday") {
    const day = new Date().getUTCDay();
    if (day === 0 || day === 6) {
      return { shouldRun: false, reason: "Skipped: not a weekday" };
    }
  }

  // Day filter: month_start — only run on 1st of month
  if (conditions.day_filter === "month_start") {
    const date = new Date().getUTCDate();
    if (date !== 1) {
      return { shouldRun: false, reason: "Skipped: not the 1st of the month" };
    }
  }

  // Threshold: only run if a specific template returns >= N items
  if (conditions.threshold) {
    const thresholdResult = await executeTemplate(
      conditions.threshold.template,
      supabase,
      orgId,
      ventureId
    );
    const totalItems = thresholdResult.sections.reduce(
      (sum, s) => sum + s.items.length,
      0
    );
    if (totalItems < conditions.threshold.min_items) {
      return {
        shouldRun: false,
        reason: `Skipped: ${conditions.threshold.template} returned ${totalItems} items (need >= ${conditions.threshold.min_items})`,
      };
    }
  }

  // only_if_data: check after the template has run
  if (conditions.only_if_data && templateResult && !templateResult.hasData) {
    return { shouldRun: false, reason: "Skipped: no data" };
  }

  return { shouldRun: true };
}

// ============================================================
// Composed Job Execution — run multiple templates
// ============================================================

/**
 * Execute one or more templates (comma-separated) and merge results.
 */
async function executeComposedTemplates(
  queryTemplate: string,
  supabase: SupabaseClient,
  orgId: string,
  ventureId?: string | null
): Promise<CronTemplateResult> {
  const templateKeys = queryTemplate.split(",").map((k) => k.trim()).filter(Boolean);

  if (templateKeys.length === 0) {
    return { hasData: false, title: "No Templates", sections: [] };
  }

  if (templateKeys.length === 1) {
    return executeTemplate(templateKeys[0], supabase, orgId, ventureId);
  }

  // Run all templates in parallel
  const results = await Promise.all(
    templateKeys.map((key) => executeTemplate(key, supabase, orgId, ventureId))
  );

  // Merge results
  const mergedSections = results.flatMap((r) => r.sections);
  const hasData = results.some((r) => r.hasData);
  const titles = results.map((r) => r.title).filter(Boolean);
  const mergedTitle = `Morning Briefing: ${titles.join(" + ")}`;

  return {
    hasData,
    title: mergedTitle,
    sections: mergedSections,
  };
}

/**
 * Execute a single cron job by ID.
 * 1. Fetch the cron_job record
 * 2. Check conditions (day_filter, threshold)
 * 3. Run the query template(s) — supports composed jobs
 * 4. Check post-execution conditions (only_if_data)
 * 5. Apply format template if present
 * 6. Log execution to cron_executions
 * 7. If discord_webhook_url is set, POST the result
 * 8. Update cron_jobs with last_run info
 */
export async function executeCronJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<ExecutionResult> {
  const startedAt = new Date().toISOString();

  // 1. Fetch the job
  const { data: job, error: jobError } = await supabase
    .from("cron_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return {
      jobId,
      status: "error",
      result: null,
      error: jobError?.message ?? "Job not found",
    };
  }

  // Create execution log entry
  const { data: execution } = await supabase
    .from("cron_executions")
    .insert({
      cron_job_id: jobId,
      started_at: startedAt,
      status: "running",
      records_processed: 0,
    })
    .select("id")
    .single();

  const executionId = execution?.id;

  // Parse conditions from format_template jsonb field
  const formatConfig = (job.format_template ?? {}) as Record<string, unknown>;
  const conditions: JobConditions = {
    only_if_data: formatConfig.only_if_data === true,
    threshold: formatConfig.threshold as JobConditions["threshold"],
    day_filter: formatConfig.day_filter as JobConditions["day_filter"],
  };

  try {
    // 2. Check pre-execution conditions (day_filter, threshold)
    const preCheck = await checkConditions(
      { day_filter: conditions.day_filter, threshold: conditions.threshold },
      supabase,
      job.organization_id,
      job.venture_id
    );

    if (!preCheck.shouldRun) {
      // Log as skipped
      if (executionId) {
        await supabase
          .from("cron_executions")
          .update({
            completed_at: new Date().toISOString(),
            status: "success",
            result: { skipped: true, reason: preCheck.reason } as unknown as Record<string, unknown>,
            records_processed: 0,
          })
          .eq("id", executionId);
      }

      return {
        jobId,
        status: "success",
        result: { hasData: false, title: preCheck.reason ?? "Skipped", sections: [] },
      };
    }

    // 3. Run the template(s) — supports comma-separated composed jobs
    let templateResult = await executeComposedTemplates(
      job.query_template,
      supabase,
      job.organization_id,
      job.venture_id
    );

    // 4. Check post-execution conditions (only_if_data)
    const postCheck = await checkConditions(
      { only_if_data: conditions.only_if_data },
      supabase,
      job.organization_id,
      job.venture_id,
      templateResult
    );

    if (!postCheck.shouldRun) {
      if (executionId) {
        await supabase
          .from("cron_executions")
          .update({
            completed_at: new Date().toISOString(),
            status: "success",
            result: { skipped: true, reason: postCheck.reason } as unknown as Record<string, unknown>,
            records_processed: 0,
          })
          .eq("id", executionId);
      }

      return {
        jobId,
        status: "success",
        result: { hasData: false, title: postCheck.reason ?? "Skipped", sections: [] },
      };
    }

    // 5. Apply custom format template if present
    const handlebarsTemplate = formatConfig.handlebars_template as string | undefined;
    if (handlebarsTemplate) {
      templateResult = applyFormatTemplate(templateResult, handlebarsTemplate);
    }

    // Count records
    const recordsProcessed = templateResult.sections.reduce(
      (sum, s) => sum + s.items.length,
      0
    );

    // 6. Post to Discord if webhook is configured
    let discordResult: ExecutionResult["discordResult"];
    if (job.discord_webhook_url && templateResult.hasData) {
      try {
        discordResult = await postToDiscordWebhook(
          job.discord_webhook_url,
          templateResult
        );
      } catch (err) {
        discordResult = {
          ok: false,
          status: 0,
          statusText: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    // 7. Update execution log
    if (executionId) {
      await supabase
        .from("cron_executions")
        .update({
          completed_at: new Date().toISOString(),
          status: "success",
          result: templateResult as unknown as Record<string, unknown>,
          records_processed: recordsProcessed,
        })
        .eq("id", executionId);
    }

    // 8. Update job
    await supabase
      .from("cron_jobs")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "success",
        last_run_result: templateResult as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      jobId,
      status: "success",
      result: templateResult,
      discordResult,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown execution error";

    // Update execution log with error
    if (executionId) {
      await supabase
        .from("cron_executions")
        .update({
          completed_at: new Date().toISOString(),
          status: "error",
          error_message: errorMessage,
        })
        .eq("id", executionId);
    }

    // Update job with error
    await supabase
      .from("cron_jobs")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "error",
        last_run_result: { error: errorMessage },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      jobId,
      status: "error",
      result: null,
      error: errorMessage,
    };
  }
}

/**
 * Execute a template ad-hoc (without saving to cron_jobs).
 * Useful for "Test Fire" and preview.
 */
export async function executeTemplateAdHoc(
  supabase: SupabaseClient,
  templateKey: string,
  orgId: string,
  ventureId?: string | null
): Promise<CronTemplateResult> {
  return executeComposedTemplates(templateKey, supabase, orgId, ventureId);
}
