import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeCronJob } from "@/lib/cron/engine";
import { shouldRunNow } from "@/lib/cron/schedule";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

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
    const supabase = await createClient();

    const { data: jobs, error } = await supabase
      .from("cron_jobs")
      .select("id, schedule, last_run_at")
      .eq("enabled", true);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch jobs", details: error.message },
        { status: 500 }
      );
    }

    const dueJobs = (jobs ?? []).filter((job) =>
      shouldRunNow(job.schedule, job.last_run_at)
    );

    const results = [];
    for (const job of dueJobs) {
      const result = await executeCronJob(supabase, job.id);
      results.push({ jobId: job.id, status: result.status });
    }

    return NextResponse.json({
      checked: (jobs ?? []).length,
      executed: dueJobs.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
