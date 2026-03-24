import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { generateMeetingAgenda } from "@/lib/ai/agenda-builder";

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

    const body = (await request.json()) as {
      meetingType: "weekly_sync" | "monthly_review" | "quarterly_summit";
      ventureId?: string;
    };

    const validTypes = ["weekly_sync", "monthly_review", "quarterly_summit"];
    if (!body.meetingType || !validTypes.includes(body.meetingType)) {
      return NextResponse.json(
        { error: "Invalid meetingType. Use: weekly_sync, monthly_review, or quarterly_summit." },
        { status: 400 }
      );
    }

    const ventureId = body.ventureId ?? ctx.ventureId;

    const agenda = await generateMeetingAgenda(
      supabase,
      ctx.orgId,
      ventureId,
      body.meetingType
    );

    return NextResponse.json(agenda);
  } catch (error) {
    console.error("Agenda Builder route error:", error);
    const message =
      error instanceof Error ? error.message : "Agenda generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
