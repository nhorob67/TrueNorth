import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runSignalWatch, dispatchSignalAlerts } from "@/lib/signal-watch";
import {
  sendDiscordNotification,
  getOrgDiscordWebhook,
} from "@/lib/discord-notify";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { callVps } from "@/lib/hermes/vps-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/signal-watch
 *
 * Daily cron (6 AM) that runs Signal Watch anomaly detection for every org.
 * - Fetches all organizations
 * - Runs KPI anomaly detection with AI enrichment
 * - Dispatches notifications via the notification system
 * - Posts high-severity alerts to Discord if org has a webhook configured
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await logCronExecution(
      supabase,
      "/api/cron/signal-watch",
      "0 6 * * *",
      async () => {
        // Fetch all organizations
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("id, name");

        if (orgError) {
          throw new Error(`Failed to fetch organizations: ${orgError.message}`);
        }

        const results = [];
        let totalAlerts = 0;

        for (const org of orgs ?? []) {
          try {
            // Check if this agent is Hermes-enabled for this org
            const { data: hermesAgent } = await supabase
              .from("agents")
              .select("hermes_enabled, hermes_profile_name")
              .eq("organization_id", org.id)
              .eq("category", "signal_watch")
              .single();

            if (hermesAgent?.hermes_enabled && hermesAgent.hermes_profile_name) {
              // Delegate to Hermes VPS
              try {
                const vpsResult = await callVps("/api/trigger", {
                  profile: hermesAgent.hermes_profile_name,
                  orgId: org.id,
                  mode: "one-shot",
                }) as Record<string, unknown>;

                console.log(
                  `Signal Watch Hermes result for org ${org.id}:`,
                  JSON.stringify(vpsResult)
                );

                // TODO: Parse VPS result to extract alerts in the same shape as
                // runSignalWatch output, then dispatch notifications and Discord
                // alerts using the existing logic below. For now, the VPS agent
                // handles notification dispatch internally.
                results.push({
                  orgId: org.id,
                  orgName: org.name,
                  alertsDetected: 0,
                  notificationsSent: 0,
                  notificationErrors: 0,
                  discordAlertsSent: 0,
                  status: "hermes",
                  hermesResult: vpsResult,
                });
              } catch (err) {
                console.error(
                  `Signal Watch Hermes failed for org ${org.id}:`,
                  err instanceof Error ? err.message : err
                );
                // Fall through to legacy path on Hermes failure
                results.push({
                  orgId: org.id,
                  orgName: org.name,
                  alertsDetected: 0,
                  notificationsSent: 0,
                  notificationErrors: 0,
                  discordAlertsSent: 0,
                  status: "hermes_error",
                  error: err instanceof Error ? err.message : "Hermes VPS error",
                });
              }
            } else {
              // Legacy: existing AI call
              const alerts = await runSignalWatch(supabase, org.id, {
                enableAI: true,
              });

              // Dispatch notifications for all alerts
              const dispatch = await dispatchSignalAlerts(supabase, org.id, alerts);

              // Post high-severity alerts to Discord if webhook configured
              const webhookUrl = await getOrgDiscordWebhook(supabase, org.id);
              let discordSent = 0;

              if (webhookUrl) {
                const highSeverity = alerts.filter((a) => a.severity === "high");
                for (const alert of highSeverity) {
                  try {
                    await sendDiscordNotification(webhookUrl, {
                      title: alert.title,
                      body: alert.body,
                      entityType: "kpi",
                      entityId: alert.kpi_id,
                      tier: "urgent",
                    });
                    discordSent++;
                  } catch (err) {
                    console.error(
                      `Discord alert failed for org ${org.id}:`,
                      err instanceof Error ? err.message : err
                    );
                  }
                }
              }

              totalAlerts += alerts.length;
              results.push({
                orgId: org.id,
                orgName: org.name,
                alertsDetected: alerts.length,
                notificationsSent: dispatch.sent,
                notificationErrors: dispatch.errors,
                discordAlertsSent: discordSent,
                status: "success",
              });
            }
          } catch (err) {
            results.push({
              orgId: org.id,
              orgName: org.name,
              alertsDetected: 0,
              notificationsSent: 0,
              notificationErrors: 0,
              discordAlertsSent: 0,
              status: "error",
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return {
          orgsProcessed: results.length,
          summary: {
            organizations: results.length,
            totalAlerts,
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
