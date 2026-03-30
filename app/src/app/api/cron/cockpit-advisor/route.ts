import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateDailyAdvice } from "@/lib/ai/cockpit-advisor";
import { sendNotification } from "@/lib/notifications";
import { sendDiscordNotification, getOrgDiscordWebhook } from "@/lib/discord-notify";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { callVps } from "@/lib/hermes/vps-client";
import { persistVpsResult } from "@/lib/hermes/persist-result";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cockpit-advisor
 *
 * Daily cron (7 AM). Generates daily advice for each org and sends
 * notifications to admins. Also posts to Discord if configured.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/cockpit-advisor",
      "0 7 * * *",
      async () => {
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("id");

        if (orgError) throw new Error(`Failed to fetch organizations: ${orgError.message}`);

        const results: Array<{ orgId: string; status: string; error?: string }> = [];

        for (const org of orgs ?? []) {
          try {
            // Fetch ventures and admins
            const [{ data: ventures }, { data: admins }] = await Promise.all([
              supabase
                .from("ventures")
                .select("id")
                .eq("organization_id", org.id),
              supabase
                .from("organization_memberships")
                .select("user_id")
                .eq("organization_id", org.id)
                .eq("role", "admin"),
            ]);

            const adminIds = (admins ?? []).map((a) => a.user_id);

            // Check if this agent is Hermes-enabled for this org
            const { data: hermesAgent } = await supabase
              .from("agents")
              .select("hermes_enabled, hermes_profile_name")
              .eq("organization_id", org.id)
              .eq("category", "cockpit_advisor")
              .single();

            if (hermesAgent?.hermes_enabled && hermesAgent.hermes_profile_name) {
              // Delegate to Hermes VPS per venture
              for (const venture of ventures ?? []) {
                const vpsResult = await callVps("/api/trigger", {
                  profile: hermesAgent.hermes_profile_name,
                  orgId: org.id,
                  ventureId: venture.id,
                  mode: "one-shot",
                }) as Record<string, unknown>;
                await persistVpsResult(supabase, {
                  orgId: org.id,
                  ventureId: venture.id,
                  agentProfile: hermesAgent.hermes_profile_name,
                  agentCategory: "cockpit_advisor",
                  vpsResult: vpsResult,
                });
              }
            } else {
              // Legacy: existing AI call
              for (const venture of ventures ?? []) {
                const recommendation = await generateDailyAdvice(
                  supabase,
                  org.id,
                  venture.id
                );

                // Notify admins
                for (const userId of adminIds) {
                  await sendNotification(supabase, {
                    userId,
                    orgId: org.id,
                    type: "cockpit_advice",
                    tier: "immediate",
                    title: recommendation.action,
                    body: recommendation.reasoning,
                    entityType: recommendation.entityType,
                    entityId: recommendation.entityId,
                  });
                }

                // Post to Discord if configured
                try {
                  const webhookUrl = await getOrgDiscordWebhook(supabase, org.id);
                  if (webhookUrl) {
                    await sendDiscordNotification(webhookUrl, {
                      title: `Cockpit Advisor: ${recommendation.action}`,
                      body: recommendation.reasoning,
                      entityType: recommendation.entityType,
                      entityId: recommendation.entityId,
                      tier: recommendation.urgency === "critical" ? "immediate" : "urgent",
                    });
                  }
                } catch (discordErr) {
                  console.error("Discord notification failed:", discordErr);
                }
              }
            }

            results.push({ orgId: org.id, status: "success" });
          } catch (err) {
            results.push({
              orgId: org.id,
              status: "error",
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return {
          orgsProcessed: results.length,
          summary: {
            organizations: results.length,
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
