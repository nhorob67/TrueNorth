import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { computeOperatingHealth, saveHealthSnapshot } from "@/lib/operating-health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const windowDays = parseInt(searchParams.get("windowDays") ?? "30", 10);
    const ventureId = searchParams.get("ventureId") ?? ctx.ventureId;

    const report = await computeOperatingHealth(
      supabase,
      ctx.orgId,
      ventureId,
      ctx.isSingleVenture,
      windowDays
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("Health compute error:", error);
    return NextResponse.json({ error: "Failed to compute operating health" }, { status: 500 });
  }
}

// POST: compute and save a snapshot (for cron or manual trigger)
export async function POST() {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const report = await computeOperatingHealth(
      supabase,
      ctx.orgId,
      ctx.ventureId,
      ctx.isSingleVenture
    );

    await saveHealthSnapshot(supabase, report);

    return NextResponse.json({ saved: true, composite_score: report.composite_score });
  } catch (error) {
    console.error("Health snapshot error:", error);
    return NextResponse.json({ error: "Failed to save health snapshot" }, { status: 500 });
  }
}
