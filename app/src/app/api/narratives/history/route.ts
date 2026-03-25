import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { getNarrativeHistory } from "@/lib/ai/narrative-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const history = await getNarrativeHistory(supabase, ctx.orgId, ctx.ventureId);

    return NextResponse.json(history);
  } catch (error) {
    console.error("Narrative history error:", error);
    return NextResponse.json({ error: "Failed to fetch narrative history" }, { status: 500 });
  }
}
