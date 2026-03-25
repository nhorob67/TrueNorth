import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { assessBets } from "@/lib/ai/kill-switch";
import { sendNotification, type NotificationTier } from "@/lib/notifications";
import { sendDiscordNotification, getOrgDiscordWebhook } from "@/lib/discord-notify";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/kill-switch
 *
 * Biweekly cron (1st & 15th at 8 AM). Runs bet assessment for each org
 * and sends notifications per bet with tier based on recommendation.
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

    const results: Array<{
      orgId: string;
      status: string;
      assessments: number;
      summary?: { continue: number; pause: number; kill: number };
      error?: string;
    }> = [];

    for (const org of orgs ?? []) {
      try {
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
        let totalAssessments = 0;
        const summary = { continue: 0, pause: 0, kill: 0 };

        for (const venture of ventures ?? []) {
          const assessments = await assessBets(supabase, org.id, venture.id);
          totalAssessments += assessments.length;

          for (const assessment of assessments) {
            summary[assessment.recommendation]++;

            // Determine notification tier
            let tier: NotificationTier;
            switch (assessment.recommendation) {
              case "kill":
                tier = "immediate";
                break;
              case "pause":
                tier = "urgent";
                break;
              default:
                tier = "daily_digest";
            }

            const title =
              assessment.recommendation === "kill"
                ? `Kill Switch: recommend killing "${assessment.betOutcome}"`
                : assessment.recommendation === "pause"
                  ? `Kill Switch: "${assessment.betOutcome}" needs investigation`
                  : `Kill Switch: "${assessment.betOutcome}" is on track`;

            for (const userId of adminIds) {
              await sendNotification(supabase, {
                userId,
                orgId: org.id,
                type: "kill_switch_assessment",
                tier,
                title,
                body: assessment.reasoning,
                entityType: "bet",
                entityId: assessment.betId,
              });
            }

            // Post kill/pause to Discord
            if (
              assessment.recommendation === "kill" ||
              assessment.recommendation === "pause"
            ) {
              try {
                const webhookUrl = await getOrgDiscordWebhook(supabase, org.id);
                if (webhookUrl) {
                  await sendDiscordNotification(webhookUrl, {
                    title,
                    body: assessment.reasoning,
                    entityType: "bet",
                    entityId: assessment.betId,
                    tier:
                      assessment.recommendation === "kill"
                        ? "immediate"
                        : "urgent",
                  });
                }
              } catch (discordErr) {
                console.error("Discord notification failed:", discordErr);
              }
            }
          }
        }

        results.push({
          orgId: org.id,
          status: "success",
          assessments: totalAssessments,
          summary,
        });
      } catch (err) {
        results.push({
          orgId: org.id,
          status: "error",
          assessments: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      organizations: results.length,
      totalAssessments: results.reduce((s, r) => s + r.assessments, 0),
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
