import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { computeOperatingHealth, saveHealthSnapshot } from "@/lib/operating-health";
import { interpretHealthReport } from "@/lib/ai/health-interpreter";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Compute fresh health report
    const report = await computeOperatingHealth(
      supabase,
      ctx.orgId,
      ctx.ventureId,
      ctx.isSingleVenture
    );

    // Interpret with AI
    const interpretation = await interpretHealthReport(supabase, ctx.orgId, report);

    // Save snapshot with interpretation
    await saveHealthSnapshot(supabase, report, interpretation.interpretation);

    return NextResponse.json({
      report,
      interpretation,
    });
  } catch (error) {
    console.error("Health interpret error:", error);
    return NextResponse.json({ error: "Failed to interpret health" }, { status: 500 });
  }
}
