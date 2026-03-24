import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// Thread Summarization via Claude
// ============================================================

const anthropic = new Anthropic();

export interface ThreadSummary {
  summary: string[];
  decisions: string[];
  blockers: string[];
  actionItems: string[];
}

const SYSTEM_PROMPT = `You are TrueNorth's discussion summarizer. You analyze Discord channel messages and extract structured insights.

Respond with ONLY valid JSON matching this format:
{
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "decisions": ["decision 1"],
  "blockers": ["blocker 1"],
  "actionItems": ["action 1", "action 2"]
}

Rules:
- summary: 3-5 bullet points capturing the key topics discussed
- decisions: any decisions that were made or agreed upon (can be empty)
- blockers: any blockers, obstacles, or concerns raised (can be empty)
- actionItems: any commitments, action items, or next steps (can be empty)
- Keep each item concise (1-2 sentences max)
- If a category has no items, use an empty array
- Do NOT include markdown formatting in the JSON values`;

export async function summarizeThread(messageText: string): Promise<ThreadSummary> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Summarize the following Discord conversation:\n\n${messageText}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    return { summary: [], decisions: [], blockers: [], actionItems: [] };
  }

  try {
    const parsed = JSON.parse(content.text) as ThreadSummary;
    return {
      summary: Array.isArray(parsed.summary) ? parsed.summary : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch {
    return { summary: [], decisions: [], blockers: [], actionItems: [] };
  }
}
