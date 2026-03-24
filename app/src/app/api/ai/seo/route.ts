import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

// ============================================================
// SEO Suggestions API Route
//
// PRD Section 3.5: AI-powered SEO analysis.
// Returns structured title, meta description, keywords,
// readability score, and improvement suggestions.
// ============================================================

const anthropic = new Anthropic();

interface SeoRequest {
  content: string;
  title: string;
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

    const body = (await request.json()) as SeoRequest;
    const { content, title } = body;

    if (!content || content.length < 20) {
      return NextResponse.json(
        { error: "Content must be at least 20 characters for SEO analysis." },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an SEO analysis expert. Analyze the given content and return a JSON object with these exact fields:
- title: An SEO-optimized title tag (50-60 characters)
- metaDescription: An SEO-optimized meta description (150-160 characters)
- keywords: An array of 5-8 relevant keywords/phrases
- readabilityScore: A score from 0-100 (100 = very readable, Flesch-like scale)
- improvements: An array of 3-5 specific actionable SEO improvement suggestions

Return ONLY the JSON object, no markdown fences, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Analyze this content for SEO optimization.\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 4000)}`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const text = textContent?.type === "text" ? textContent.text : "{}";

    try {
      const suggestions = JSON.parse(text);
      return NextResponse.json({
        title: suggestions.title ?? title,
        metaDescription: suggestions.metaDescription ?? "",
        keywords: Array.isArray(suggestions.keywords) ? suggestions.keywords : [],
        readabilityScore:
          typeof suggestions.readabilityScore === "number"
            ? suggestions.readabilityScore
            : 50,
        improvements: Array.isArray(suggestions.improvements)
          ? suggestions.improvements
          : [],
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to parse SEO suggestions" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("SEO analysis error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "SEO analysis failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
