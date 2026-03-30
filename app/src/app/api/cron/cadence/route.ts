import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeCadenceReport } from "@/lib/cadence-intelligence";
import { sendNotification } from "@/lib/notifications";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cadence
 *
 * Daily cron (9 AM) that computes cadence compliance for all ventures
 * and sends notifications for overdue cadences.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/cadence",
      "0 9 * * *",
      async () => {
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("id");

        if (orgError) {
          throw new Error(`Failed to fetch organizations: ${orgError.message}`);
        }

        const results: Array<{
          orgId: string;
          ventureId: string;
          overall_score: number;
          overall_status: string;
          overdue_count: number;
          status: string;
          error?: string;
        }> = [];
        let totalNotifications = 0;

        for (const org of orgs ?? []) {
          const { data: ventures } = await supabase
            .from("ventures")
            .select("id")
            .eq("organization_id", org.id);

          // Fetch org admins for notifications
          const { data: admins } = await supabase
            .from("organization_memberships")
            .select("user_id")
            .eq("organization_id", org.id)
            .eq("role", "admin");

          const adminIds = (admins ?? []).map((a) => a.user_id);

          for (const venture of ventures ?? []) {
            try {
              const report = await computeCadenceReport(supabase, org.id, venture.id);

              const overdueMetrics = report.metrics.filter((m) => m.is_overdue);

              for (const metric of overdueMetrics) {
                const isHighPriority =
                  metric.cadence_type === "daily_pulse" || metric.cadence_type === "weekly_sync";

                const tier = isHighPriority ? "urgent" : ("daily_digest" as const);
                const title = `Overdue cadence: ${metric.label}`;
                const body = metric.days_since_last !== null
                  ? `${metric.label} is ${metric.days_since_last} days since last completion (compliance: ${metric.compliance_rate}%).`
                  : `${metric.label} has never been completed.`;

                for (const userId of adminIds) {
                  await sendNotification(supabase, {
                    userId,
                    orgId: org.id,
                    type: "staleness_alert",
                    tier,
                    title,
                    body,
                    entityType: "cadence",
                    entityId: metric.cadence_type,
                  });
                  totalNotifications++;
                }
              }

              results.push({
                orgId: org.id,
                ventureId: venture.id,
                overall_score: report.overall_score,
                overall_status: report.overall_status,
                overdue_count: overdueMetrics.length,
                status: "success",
              });
            } catch (err) {
              results.push({
                orgId: org.id,
                ventureId: venture.id,
                overall_score: 0,
                overall_status: "red",
                overdue_count: 0,
                status: "error",
                error: err instanceof Error ? err.message : "Unknown error",
              });
            }
          }
        }

        return {
          orgsProcessed: (orgs ?? []).length,
          summary: {
            ventures_processed: results.length,
            total_notifications: totalNotifications,
            results,
          },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
