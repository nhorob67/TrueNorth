import Anthropic from "@anthropic-ai/sdk";
import type { ExternalSourceResult } from "./external-sources";

// ============================================================
// LLM Message Composer for External Source Cron Jobs
// ============================================================
// Takes structured data from an external source and uses Claude
// to compose a natural, human-like Discord message.

const anthropic = new Anthropic();

const TIMEOUT_MS = 15_000;

/**
 * Compose a Discord-ready message from external source data using Claude.
 */
export async function composeCronMessage(
  data: ExternalSourceResult,
  systemPrompt: string,
  model: string = "claude-sonnet-4-20250514"
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await anthropic.messages.create(
      {
        model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here is today's data:\n\n${JSON.stringify(data.data, null, 2)}\n\nWrite a brief, natural Discord message based on this data.`,
          },
        ],
      },
      { signal: controller.signal }
    );

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text ?? data.summary;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// Default System Prompts
// ============================================================

export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  kit_subscribers: `You are a friendly newsletter growth analyst reporting to a team Discord channel. Given today's subscriber data, write a brief, conversational message (2-3 sentences) about the current subscriber count and how it changed from yesterday. Be encouraging when growth is positive, and matter-of-fact when it's flat or declining. Always include the actual numbers. Do not use markdown headers or bullet points — just write natural sentences. Keep it under 280 characters if possible.`,

  discourse_unreplied: `You are a community support coordinator alerting the team about forum posts that need attention. Given the list of unreplied posts, write a brief Discord message highlighting posts that need replies. Mention each post's title and author. If there are no unreplied posts, celebrate briefly. Keep it concise and action-oriented — the team should know exactly what to do. Do not use markdown headers.`,
};
