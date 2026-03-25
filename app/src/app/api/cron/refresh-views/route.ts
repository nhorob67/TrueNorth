import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh-views
 *
 * Refreshes materialized views (currently mv_kpi_trailing_90d).
 * Protected by CRON_SECRET. Intended to run every 15 minutes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const { error } = await supabase.rpc("refresh_kpi_materialized_view");

    if (error) {
      console.error("refresh_kpi_materialized_view error:", error.message);
      return NextResponse.json(
        { error: "Failed to refresh materialized view" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refreshed: ["mv_kpi_trailing_90d"],
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("refresh-views cron error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
