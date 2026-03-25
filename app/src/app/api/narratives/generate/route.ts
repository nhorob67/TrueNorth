import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { generateNarrative, saveNarrative } from "@/lib/ai/narrative-generator";
import { NarrativeType } from "@/types/database";

export const dynamic = "force-dynamic";

const VALID_TYPES: NarrativeType[] = [
  "weekly_team_update",
  "monthly_board_memo",
  "investor_update",
  "all_hands_talking_points",
  "quarterly_retrospective",
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      narrativeType,
      startDate,
      endDate,
      ventureId,
      additionalContext,
      save = true,
    } = body as {
      narrativeType: NarrativeType;
      startDate: string;
      endDate: string;
      ventureId?: string;
      additionalContext?: string;
      save?: boolean;
    };

    if (!narrativeType || !VALID_TYPES.includes(narrativeType)) {
      return NextResponse.json({ error: "Invalid narrative type" }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const input = {
      orgId: ctx.orgId,
      ventureId: ventureId ?? ctx.ventureId,
      narrativeType,
      startDate,
      endDate,
      userId: ctx.userId,
      isSingleVenture: ctx.isSingleVenture,
      additionalContext,
    };

    const result = await generateNarrative(supabase, input);

    let narrativeId: string | null = null;
    if (save) {
      narrativeId = await saveNarrative(supabase, input, result);
    }

    return NextResponse.json({
      id: narrativeId,
      title: result.title,
      html: result.html,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Narrative generation error:", error);
    return NextResponse.json({ error: "Failed to generate narrative" }, { status: 500 });
  }
}
