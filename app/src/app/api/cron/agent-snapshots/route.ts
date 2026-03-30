import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/agent-snapshots
 *
 * Weekly cron (Sunday midnight UTC). Aggregates the past week's data
 * from agent_token_usage, agent_tasks, and ai_actions into
 * agent_performance_snapshots for drift detection and trend analysis.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/agent-snapshots",
      "0 0 * * 0",
      async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const snapshotDate = now.toISOString().slice(0, 10);
        const weekAgoStr = weekAgo.toISOString();

        // Fetch all orgs
        const { data: orgs } = await supabase.from("organizations").select("id");
        let totalSnapshots = 0;

        for (const org of orgs ?? []) {
          // Fetch hermes-enabled agents for this org
          const { data: agents } = await supabase
            .from("agents")
            .select("id, hermes_profile_name, category")
            .eq("organization_id", org.id)
            .eq("hermes_enabled", true);

          for (const agent of agents ?? []) {
            const profile = agent.hermes_profile_name;
            if (!profile) continue;

            // Aggregate token usage
            const { data: usageRows } = await supabase
              .from("agent_token_usage")
              .select("input_tokens, output_tokens, cache_read_tokens, estimated_cost, model")
              .eq("organization_id", org.id)
              .eq("hermes_profile", profile)
              .gte("created_at", weekAgoStr);

            const totalCost = (usageRows ?? []).reduce((s, r) => s + Number(r.estimated_cost), 0);
            const totalInput = (usageRows ?? []).reduce((s, r) => s + r.input_tokens, 0);
            const totalOutput = (usageRows ?? []).reduce((s, r) => s + r.output_tokens, 0);
            const totalCache = (usageRows ?? []).reduce((s, r) => s + r.cache_read_tokens, 0);
            const modelsUsed = [...new Set((usageRows ?? []).map((r) => r.model))];

            // Aggregate tasks
            const { data: tasks } = await supabase
              .from("agent_tasks")
              .select("status, started_at, completed_at")
              .eq("organization_id", org.id)
              .eq("agent_profile", profile)
              .gte("created_at", weekAgoStr);

            const tasksCompleted = (tasks ?? []).filter((t) => t.status === "done" || t.status === "approved").length;
            const tasksFailed = (tasks ?? []).filter((t) => t.status === "failed").length;
            const tasksTotal = (tasks ?? []).length;

            // Compute average processing time from completed tasks
            const completedWithTimes = (tasks ?? []).filter(
              (t) => t.started_at && t.completed_at && (t.status === "done" || t.status === "approved")
            );
            const avgProcessingMs = completedWithTimes.length > 0
              ? completedWithTimes.reduce((s, t) => {
                  return s + (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime());
                }, 0) / completedWithTimes.length
              : null;

            // Aggregate ai_actions for acceptance/override rates
            const { data: actions } = await supabase
              .from("ai_actions")
              .select("outcome, confidence")
              .eq("organization_id", org.id)
              .eq("agent_category", agent.category)
              .gte("created_at", weekAgoStr);

            const accepted = (actions ?? []).filter((a) => a.outcome === "accepted").length;
            const overridden = (actions ?? []).filter((a) => a.outcome === "overridden").length;
            const totalDecided = accepted + overridden;
            const acceptanceRate = totalDecided > 0 ? (accepted / totalDecided) * 100 : null;
            const overrideRate = totalDecided > 0 ? (overridden / totalDecided) * 100 : null;

            // Confidence distribution
            const confidences = (actions ?? []).map((a) => a.confidence).filter(Boolean);
            const highConf = confidences.filter((c) => c === "high").length;
            const medConf = confidences.filter((c) => c === "medium").length;
            const avgConfidence = confidences.length > 0
              ? highConf >= medConf ? "high" : "medium"
              : null;

            // Upsert snapshot
            await supabase.from("agent_performance_snapshots").upsert(
              {
                organization_id: org.id,
                agent_profile: profile,
                snapshot_date: snapshotDate,
                period: "weekly",
                metrics: {
                  tasks_completed: tasksCompleted,
                  tasks_failed: tasksFailed,
                  tasks_total: tasksTotal,
                  avg_processing_time_ms: avgProcessingMs ? Math.round(avgProcessingMs) : null,
                  acceptance_rate: acceptanceRate !== null ? Math.round(acceptanceRate * 10) / 10 : null,
                  override_rate: overrideRate !== null ? Math.round(overrideRate * 10) / 10 : null,
                  total_cost: Math.round(totalCost * 1000000) / 1000000,
                  avg_cost_per_task: tasksTotal > 0 ? Math.round((totalCost / tasksTotal) * 1000000) / 1000000 : null,
                  avg_confidence: avgConfidence,
                  token_usage: { input: totalInput, output: totalOutput, cache_read: totalCache },
                  models_used: modelsUsed,
                },
              },
              { onConflict: "organization_id,agent_profile,snapshot_date,period" }
            );

            totalSnapshots++;
          }
        }

        return {
          orgsProcessed: (orgs ?? []).length,
          summary: { snapshots_created: totalSnapshots, snapshot_date: snapshotDate },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
