import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyHermesSecret } from "@/lib/hermes/verify-secret";

export const dynamic = "force-dynamic";

/**
 * POST /api/hermes/cron/sync
 *
 * Hermes VPS reports cron job configuration and execution results.
 * TrueNorth upserts into hermes_cron_jobs and hermes_cron_executions.
 *
 * Body: { type: "config"|"execution", orgId, data }
 */
export async function POST(request: Request) {
  if (!verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, orgId } = body;

  if (!type || !orgId) {
    return NextResponse.json(
      { error: "Missing required fields: type, orgId" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  if (type === "config") {
    // Bulk upsert cron job definitions from the VPS.
    // Uses the natural key (org + profile + name) so both VPS proxy cron-manager
    // jobs (UUID ids) and Hermes native cron jobs (short hex ids) are handled.
    const { jobs } = body.data as {
      jobs: Array<{
        id?: string;
        agent_profile: string;
        name: string;
        description?: string;
        prompt?: string;
        schedule: string;
        delivery_target?: string;
        enabled?: boolean;
      }>;
    };

    let synced = 0;
    for (const job of jobs) {
      const row: Record<string, unknown> = {
        organization_id: orgId,
        agent_profile: job.agent_profile,
        name: job.name,
        description: job.description ?? null,
        prompt: job.prompt ?? null,
        schedule: job.schedule,
        delivery_target: job.delivery_target ?? "supabase",
        enabled: job.enabled ?? true,
      };

      // Store the Hermes-side ID for cross-referencing (may be a short hex, not a UUID)
      if (job.id) {
        row.hermes_job_id = job.id;
      }

      const { error } = await supabase.from("hermes_cron_jobs").upsert(
        row,
        { onConflict: "hermes_cron_jobs_org_profile_name_key", ignoreDuplicates: false }
      );

      if (error) {
        console.error(`[hermes/cron/sync] Upsert failed for "${job.name}":`, error.message);
      } else {
        synced++;
      }
    }

    return NextResponse.json({ success: true, synced });
  }

  if (type === "execution") {
    // Record an execution result
    const { hermes_cron_job_id, status, started_at, completed_at, duration_ms, result, error_message, token_usage } = body.data;

    const { error } = await supabase.from("hermes_cron_executions").insert({
      hermes_cron_job_id,
      status,
      started_at,
      completed_at: completed_at ?? null,
      duration_ms: duration_ms ?? null,
      result: result ?? {},
      error_message: error_message ?? null,
      token_usage: token_usage ?? {},
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to log execution", details: error.message },
        { status: 500 }
      );
    }

    // Update last_run fields on the job
    await supabase
      .from("hermes_cron_jobs")
      .update({
        last_run_at: started_at,
        last_run_status: status,
        last_run_result: result ?? null,
      })
      .eq("id", hermes_cron_job_id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown sync type: ${type}` }, { status: 400 });
}
