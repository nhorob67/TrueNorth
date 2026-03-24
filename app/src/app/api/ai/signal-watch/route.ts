import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { runSignalWatch } from "@/lib/signal-watch";
import { NextResponse } from "next/server";

// ============================================================
// Signal Watch API Route
//
// POST /api/ai/signal-watch
// Triggers the Signal Watch anomaly detection agent.
// Can be called by Vercel Cron (daily 6am) or manually.
// ============================================================

export async function POST() {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const alerts = await runSignalWatch(supabase, ctx.orgId, {
      enableAI: true,
    });

    return NextResponse.json({
      alerts_count: alerts.length,
      alerts: alerts.map((a) => ({
        kpi: a.kpi_name,
        type: a.alert_type,
        severity: a.severity,
        title: a.title,
      })),
    });
  } catch (error) {
    console.error("Signal Watch error:", error);
    const message =
      error instanceof Error ? error.message : "Signal Watch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
