import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

// ============================================================
// Content Copilot API Route
//
// PRD Section 3.5 / 6.2:
// Actions: draft, rewrite, continue, summarize
// All output tagged as AI-generated with confidence level
// Reads org brand_voice from settings and appends to system prompt.
// ============================================================

const anthropic = new Anthropic();

const BASE_SYSTEM_PROMPT = `You are the TrueNorth Content Copilot, an AI writing assistant embedded in a business operating system for digital media businesses.

Your writing style:
- Clear, direct, and authoritative
- Warm but professional — like a trusted advisor
- Information-dense without being academic
- Written for operators and digital business builders

Guidelines:
- Write in the voice of the organization (assume a knowledgeable, experienced operator tone)
- Use concrete examples and specific numbers when possible
- Avoid filler words, empty transitions, and unnecessary qualifiers
- Structure content with clear headings and scannable sections
- When drafting, produce complete, publishable content — not outlines or placeholders`;

type CopilotAction = "draft" | "rewrite" | "continue" | "summarize";

interface CopilotRequest {
  action: CopilotAction;
  prompt?: string;
  content?: string;
  selection?: string;
  tone?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);
    if (!ctx) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Fetch org brand voice from settings
    let brandVoice = "";
    const { data: orgData } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", ctx.orgId)
      .single();

    if (orgData?.settings) {
      const settings = orgData.settings as Record<string, unknown>;
      if (typeof settings.brand_voice === "string" && settings.brand_voice.trim()) {
        brandVoice = settings.brand_voice.trim();
      }
    }

    // Build system prompt with optional brand voice
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (brandVoice) {
      systemPrompt += `\n\n--- Organization Brand Voice ---\n${brandVoice}\n\nAlways write in accordance with the brand voice described above.`;
    }

    const body = (await request.json()) as CopilotRequest;
    const { action, prompt, content, selection, tone } = body;

    let userMessage = "";

    switch (action) {
      case "draft":
        userMessage = `Write a complete draft about the following topic or outline:\n\n${prompt}\n\nProduce well-structured content with headings, paragraphs, and formatting. Write the full piece, not an outline.`;
        break;

      case "rewrite": {
        const toneInstruction = tone
          ? `Rewrite in a ${tone} tone.`
          : "Rewrite for clarity and impact.";
        userMessage = `${toneInstruction}\n\nOriginal text:\n${selection}\n\nRewrite this text while preserving the core meaning. Return only the rewritten text.`;
        break;
      }

      case "continue":
        userMessage = `Here is the content written so far:\n\n${content}\n\nContinue writing the next logical section. Match the existing style, voice, and structure. Write 2-4 paragraphs.`;
        break;

      case "summarize":
        userMessage = `Summarize the following text concisely. Preserve the key points and any specific numbers or data:\n\n${selection}\n\nReturn only the summary.`;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: draft, rewrite, continue, or summarize." },
          { status: 400 }
        );
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const text = textContent?.type === "text" ? textContent.text : "";

    // Determine confidence based on input quality
    const confidence =
      action === "draft" && (!prompt || prompt.length < 20)
        ? "medium"
        : action === "rewrite" && (!selection || selection.length < 10)
          ? "low"
          : "high";

    return NextResponse.json({
      text,
      action,
      confidence,
      model: message.model,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Copilot error:", error);
    const message =
      error instanceof Error ? error.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
