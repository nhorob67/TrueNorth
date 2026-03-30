import { SupabaseClient } from "@supabase/supabase-js";

interface CronResult {
  orgsProcessed?: number;
  summary?: Record<string, unknown>;
}

/**
 * Wraps a cron route handler to log execution start/end/status/duration
 * to the vercel_cron_executions table. Failures in logging do not
 * propagate — the cron handler's result is returned unmodified.
 */
export async function logCronExecution(
  supabase: SupabaseClient,
  cronPath: string,
  schedule: string,
  fn: () => Promise<CronResult>
): Promise<CronResult> {
  const startedAt = new Date();

  try {
    const result = await fn();

    // Fire-and-forget — don't let logging failures break the cron
    supabase
      .from("vercel_cron_executions")
      .insert({
        cron_path: cronPath,
        schedule,
        status: "success",
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt.getTime(),
        result_summary: result.summary ?? {},
        organizations_processed: result.orgsProcessed ?? 0,
      })
      .then(({ error }) => {
        if (error) console.error("Failed to log cron execution:", error.message);
      });

    return result;
  } catch (err) {
    // Log the failure, then re-throw
    supabase
      .from("vercel_cron_executions")
      .insert({
        cron_path: cronPath,
        schedule,
        status: "error",
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt.getTime(),
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .then(({ error: logErr }) => {
        if (logErr) console.error("Failed to log cron execution error:", logErr.message);
      });

    throw err;
  }
}
