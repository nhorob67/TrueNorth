import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/notifications";
import { getQuietHoursConfig } from "@/lib/quiet-hours";
import { sendDiscordDigest, getOrgDiscordWebhook } from "@/lib/discord-notify";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";

export const dynamic = "force-dynamic";

/** Default digest delivery hour (8 AM in user's timezone) */
const DEFAULT_DIGEST_HOUR = 8;

/** Delivery window: ±30 minutes around configured time */
const WINDOW_MINUTES = 30;

/**
 * Check if the current time is within the digest delivery window for a user.
 */
function isInDeliveryWindow(
  digestHour: number,
  timezone: string
): boolean {
  const now = new Date();

  let currentHour: number;
  let currentMinute: number;
  try {
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    const minuteFormatter = new Intl.DateTimeFormat("en-US", {
      minute: "numeric",
      timeZone: timezone,
    });
    currentHour = parseInt(hourFormatter.format(now));
    currentMinute = parseInt(minuteFormatter.format(now));
  } catch {
    currentHour = now.getHours();
    currentMinute = now.getMinutes();
  }

  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const targetTotalMinutes = digestHour * 60;
  const diff = Math.abs(currentTotalMinutes - targetTotalMinutes);

  // Handle midnight wrap (e.g., target=0, current=23:45)
  const wrappedDiff = Math.min(diff, 1440 - diff);
  return wrappedDiff <= WINDOW_MINUTES;
}

/**
 * GET /api/cron/digest
 *
 * Daily digest batching cron. Runs every hour at :00.
 * For each user with unread daily_digest notifications from the last 24h,
 * checks their preferred delivery time and batches if within window.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/digest",
      "0 * * * *",
      async () => {
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("id, name, settings");

        if (orgError) {
          throw new Error(`Failed to fetch organizations: ${orgError.message}`);
        }

        const twentyFourHoursAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();

        const results: Array<{
          orgId: string;
          usersProcessed: number;
          status: string;
          error?: string;
        }> = [];
        let totalDigests = 0;

        for (const org of orgs ?? []) {
          try {
            // Find unread daily_digest notifications from last 24h for this org
            const { data: notifications } = await supabase
              .from("notifications")
              .select("id, user_id, title, body, entity_type, entity_id, created_at")
              .eq("organization_id", org.id)
              .eq("tier", "daily_digest")
              .eq("read", false)
              .gte("created_at", twentyFourHoursAgo)
              .order("created_at", { ascending: true });

            if (!notifications || notifications.length === 0) {
              results.push({ orgId: org.id, usersProcessed: 0, status: "success" });
              continue;
            }

            // Group notifications by user_id
            const byUser = new Map<
              string,
              typeof notifications
            >();
            for (const n of notifications) {
              const existing = byUser.get(n.user_id) ?? [];
              existing.push(n);
              byUser.set(n.user_id, existing);
            }

            let orgDigests = 0;

            // Fetch user profiles for all relevant users at once
            const userIds = Array.from(byUser.keys());
            const { data: profiles } = await supabase
              .from("user_profiles")
              .select("id, settings")
              .in("id", userIds);

            const profileMap = new Map(
              (profiles ?? []).map((p) => [p.id, p])
            );

            for (const [userId, userNotifications] of byUser) {
              const profile = profileMap.get(userId);
              const settings = (profile?.settings ?? {}) as Record<string, unknown>;
              const quietConfig = getQuietHoursConfig(settings);

              // Determine digest delivery hour from settings, default 8 AM
              const digestHour =
                typeof settings.digest_hour === "number"
                  ? settings.digest_hour
                  : DEFAULT_DIGEST_HOUR;

              const timezone = quietConfig.timezone || "America/Chicago";

              // Check if we're within the delivery window
              if (!isInDeliveryWindow(digestHour, timezone)) {
                continue;
              }

              // Create a batched summary notification
              const count = userNotifications.length;
              const summaryTitle = `Daily Digest: ${count} item${count !== 1 ? "s" : ""}`;
              const summaryBody = userNotifications
                .map((n) => `- ${n.title}`)
                .join("\n");

              await sendNotification(supabase, {
                userId,
                orgId: org.id,
                type: "staleness_alert", // Re-use type; the title makes it clear it's a digest
                tier: "immediate", // Digest summary itself is delivered immediately
                title: summaryTitle,
                body: summaryBody.slice(0, 4000),
              });

              // Mark individual digest notifications as read (they've been batched)
              const notificationIds = userNotifications.map((n) => n.id);
              await supabase
                .from("notifications")
                .update({ read: true })
                .in("id", notificationIds);

              orgDigests++;
            }

            // If org has Discord webhook, post the org-wide digest
            const webhookUrl = await getOrgDiscordWebhook(supabase, org.id);
            if (webhookUrl && notifications.length > 0) {
              const items = notifications.map((n) => ({
                title: n.title,
                entityType: n.entity_type ?? undefined,
                entityId: n.entity_id ?? undefined,
              }));
              await sendDiscordDigest(
                webhookUrl,
                items,
                (org as Record<string, unknown>).name as string | undefined
              ).catch((err: unknown) => {
                console.error("Discord digest delivery failed:", err);
              });
            }

            totalDigests += orgDigests;
            results.push({
              orgId: org.id,
              usersProcessed: orgDigests,
              status: "success",
            });
          } catch (err) {
            results.push({
              orgId: org.id,
              usersProcessed: 0,
              status: "error",
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return {
          orgsProcessed: results.length,
          summary: {
            organizations: results.length,
            totalDigests,
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
