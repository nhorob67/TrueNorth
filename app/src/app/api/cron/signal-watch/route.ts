import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runSignalWatch, dispatchSignalAlerts } from "@/lib/signal-watch";
import {
  sendDiscordNotification,
  getOrgDiscordWebhook,
} from "@/lib/discord-notify";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

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

    // Fetch all organizations
    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id, name");

    if (orgError) {
      return NextResponse.json(
        { error: "Failed to fetch organizations", details: orgError.message },
        { status: 500 }
      );
    }

    const results = [];
    let totalAlerts = 0;

    for (const org of orgs ?? []) {
      try {
        // Run signal watch with AI enrichment
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

    return NextResponse.json({
      organizations: results.length,
      totalAlerts,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
