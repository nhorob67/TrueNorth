import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { generateDailyAdvice } from "@/lib/ai/cockpit-advisor";
import { validateUuid } from "@/lib/validation";

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

    if (body.ventureId && !validateUuid(body.ventureId)) {
      return NextResponse.json(
        { error: "ventureId must be a valid UUID" },
        { status: 400 }
      );
    }

    const ventureId = body.ventureId ?? ctx.ventureId;

    const recommendation = await generateDailyAdvice(
      supabase,
      ctx.orgId,
      ventureId
    );

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Cockpit Advisor route error:", error);
    const message =
      error instanceof Error ? error.message : "Advice generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
