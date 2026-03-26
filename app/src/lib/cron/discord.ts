import type { CronTemplateResult } from "./templates";

// ============================================================
// Discord Webhook Formatter
// ============================================================
// Converts a CronTemplateResult into a Discord embed payload
// and POSTs it to the provided webhook URL.

const MOSS_GREEN_DECIMAL = 0x5f6f52; // #5F6F52

const STATUS_EMOJI: Record<string, string> = {
  green: "\uD83D\uDFE2",  // green circle
  yellow: "\uD83D\uDFE1", // yellow circle
  red: "\uD83D\uDD34",    // red circle
};

export interface DiscordEmbed {
  title: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
}

export function formatDiscordEmbed(result: CronTemplateResult): DiscordEmbed {
  const fields: DiscordEmbed["fields"] = [];

  for (const section of result.sections) {
    // Add section heading as a field
    const lines = section.items.map((item) => {
      const emoji = item.status ? STATUS_EMOJI[item.status] + " " : "";
      return `${emoji}**${item.label}**: ${item.value}`;
    });

    fields.push({
      name: section.heading,
      value: lines.join("\n") || "No items",
      inline: false,
    });
  }

  // Discord limits: max 25 fields, field value max 1024 chars
  const truncatedFields = fields.slice(0, 25).map((f) => ({
    ...f,
    value: f.value.length > 1024 ? f.value.slice(0, 1021) + "..." : f.value,
  }));

  return {
    title: result.title,
    color: MOSS_GREEN_DECIMAL,
    fields: truncatedFields,
    footer: { text: "TrueNorth Cron Broadcast" },
    timestamp: new Date().toISOString(),
  };
}

export async function postToDiscordWebhook(
  webhookUrl: string,
  result: CronTemplateResult
): Promise<{ ok: boolean; status: number; statusText: string }> {
  const embed = formatDiscordEmbed(result);

  const body = {
    embeds: [embed],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

/**
 * Post a plain-text message to a Discord webhook.
 * Used by external source cron jobs where the LLM composes
 * a natural message instead of structured embed fields.
 */
export async function postTextToDiscordWebhook(
  webhookUrl: string,
  text: string,
  username?: string
): Promise<{ ok: boolean; status: number; statusText: string }> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: text,
      username: username ?? "TrueNorth",
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}
