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

// Re-export default prompts from the shared module (which is safe for client imports)
export { DEFAULT_SYSTEM_PROMPTS } from "./system-prompts";
