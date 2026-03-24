import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateDailyAdvice } from "@/lib/ai/cockpit-advisor";
import { sendNotification } from "@/lib/notifications";
import { sendDiscordNotification, getOrgDiscordWebhook } from "@/lib/discord-notify";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

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

    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id");

    if (orgError) {
      return NextResponse.json(
        { error: "Failed to fetch organizations", details: orgError.message },
        { status: 500 }
      );
    }

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

        results.push({ orgId: org.id, status: "success" });
      } catch (err) {
        results.push({
          orgId: org.id,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      organizations: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
