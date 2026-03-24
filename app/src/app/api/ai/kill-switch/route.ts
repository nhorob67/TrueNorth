import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { assessBets } from "@/lib/ai/kill-switch";

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

    const body = (await request.json().catch(() => ({}))) as {
      ventureId?: string;
    };

    const ventureId = body.ventureId ?? ctx.ventureId;

    const assessments = await assessBets(supabase, ctx.orgId, ventureId);

    return NextResponse.json({
      assessments,
      total: assessments.length,
      summary: {
        continue: assessments.filter((a) => a.recommendation === "continue").length,
        pause: assessments.filter((a) => a.recommendation === "pause").length,
        kill: assessments.filter((a) => a.recommendation === "kill").length,
      },
    });
  } catch (error) {
    console.error("Kill Switch route error:", error);
    const message =
      error instanceof Error ? error.message : "Bet assessment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
