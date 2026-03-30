import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeCronJob } from "@/lib/cron/engine";
import { shouldRunNow } from "@/lib/cron/schedule";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/tick
 *
 * Designed to be called by Vercel Cron every 5 minutes.
 * Fetches all enabled cron_jobs, checks which are due, and executes them.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/tick",
      "*/5 * * * *",
      async () => {
        const { data: jobs, error } = await supabase
          .from("cron_jobs")
          .select("id, schedule, last_run_at")
          .eq("enabled", true);

        if (error) {
          throw new Error(`Failed to fetch cron jobs: ${error.message}`);
        }

        const dueJobs = (jobs ?? []).filter((job) =>
          shouldRunNow(job.schedule, job.last_run_at)
        );

        const results = [];
        for (const job of dueJobs) {
          const r = await executeCronJob(supabase, job.id);
          results.push({ jobId: job.id, status: r.status });
        }

        return {
          orgsProcessed: 0,
          summary: {
            checked: (jobs ?? []).length,
            executed: dueJobs.length,
            results,
          },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    console.error("Cron tick error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
