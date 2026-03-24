import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkAndTriggerFilterGuardian } from "@/lib/ai/filter-guardian-trigger";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/cron/filter-guardian
//
// Runs every 6 hours. Checks for ideas whose cooling period
// has expired, advances them to filter_review, and runs
// AI evaluation against strategic filters.
// ============================================================

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const processed = await checkAndTriggerFilterGuardian(supabase);

    return NextResponse.json({
      success: true,
      ideasProcessed: processed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Filter Guardian cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
