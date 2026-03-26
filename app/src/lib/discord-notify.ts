// ============================================================
// Discord Notification Delivery (PRD Section 2.14)
//
// Sends formatted embeds to Discord via webhook URLs configured
// at the organization level.
// ============================================================

import { getEntityHref } from "./format";

const COLORS = {
  normal: 0x5f6f52, // moss green
  immediate: 0xa04230, // brick
} as const;

interface DiscordNotification {
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  tier: string;
}

/**
 * Build a deep link URL for a given entity type and ID.
 * Returns undefined if no mapping exists.
 */
function buildDeepLink(
  entityType?: string,
  entityId?: string
): string | undefined {
  return getEntityHref(entityType, entityId) ?? undefined;
}

/**
 * Send a single notification to Discord via webhook.
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  notification: DiscordNotification
): Promise<void> {
  const color =
    notification.tier === "immediate" ? COLORS.immediate : COLORS.normal;

  const deepLink = buildDeepLink(
    notification.entityType,
    notification.entityId
  );

  const tierLabel =
    notification.tier.charAt(0).toUpperCase() +
    notification.tier.slice(1).replace("_", " ");

  const footerParts = [tierLabel];
  if (deepLink) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.truenorth.so";
    footerParts.push(`View: ${appUrl}${deepLink}`);
  }

  const embed: Record<string, unknown> = {
    title: notification.title,
    color,
    footer: { text: footerParts.join(" | ") },
  };

  if (notification.body) {
    embed.description = notification.body;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [embed],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(
      `Discord webhook failed (${res.status}): ${text}`
    );
  }
}

/**
 * Send a digest summary embed to Discord.
 */
export async function sendDiscordDigest(
  webhookUrl: string,
  items: Array<{ title: string; entityType?: string; entityId?: string }>,
  orgName?: string
): Promise<void> {
  const title = orgName
    ? `Daily Digest: ${items.length} items for ${orgName}`
    : `Daily Digest: ${items.length} items`;

  const body = items
    .map((item, i) => {
      const deepLink = buildDeepLink(item.entityType, item.entityId);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.truenorth.so";
      const link = deepLink ? ` ([view](${appUrl}${deepLink}))` : "";
      return `${i + 1}. ${item.title}${link}`;
    })
    .join("\n");

  const embed: Record<string, unknown> = {
    title,
    description: body.slice(0, 4096), // Discord embed description limit
    color: COLORS.normal,
    footer: { text: "Daily digest" },
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [embed],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(
      `Discord digest webhook failed (${res.status}): ${text}`
    );
  }
}

/**
 * Look up the Discord webhook URL from org settings.
 * Returns null if not configured.
 */
export async function getOrgDiscordWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single();

  if (!data?.settings) return null;
  const settings = data.settings as Record<string, unknown>;
  const url = settings.discord_webhook_url;
  if (typeof url === "string" && url.startsWith("https://discord.com/api/webhooks/")) {
    return url;
  }
  return null;
}
