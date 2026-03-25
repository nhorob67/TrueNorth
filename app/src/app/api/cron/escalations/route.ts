import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runEscalationChecks, dispatchEscalations } from "@/lib/escalation";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/escalations
 *
 * Designed to be called by Vercel Cron every 30 minutes.
 * Runs escalation checks for all organizations and dispatches notifications.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Fetch all organizations
    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id");

    if (error) {
      console.error("Failed to fetch organizations:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch organizations" },
        { status: 500 }
      );
    }

    const results = [];
    for (const org of orgs ?? []) {
      try {
        const escalations = await runEscalationChecks(supabase, org.id);
        if (escalations.length > 0) {
          await dispatchEscalations(supabase, org.id, escalations);
        }
        results.push({
          orgId: org.id,
          escalations: escalations.length,
          status: "success",
        });
      } catch (err) {
        results.push({
          orgId: org.id,
          escalations: 0,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const totalEscalations = results.reduce(
      (sum, r) => sum + r.escalations,
      0
    );

    return NextResponse.json({
      organizations: results.length,
      totalEscalations,
      results,
    });
  } catch (err) {
    console.error("Escalations cron error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
