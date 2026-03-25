import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  computeOperatingHealth,
  saveHealthSnapshot,
} from "@/lib/operating-health";
import { interpretHealthReport } from "@/lib/ai/health-interpreter";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/cron/operating-health
 *
 * Designed to be called by Vercel Cron weekly (e.g. Sunday 11pm).
 * Computes Operating Health for every venture across all organizations,
 * saves snapshots, runs AI interpretation, and checks for threshold crossings.
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
      return NextResponse.json(
        { error: "Failed to fetch organizations", details: error.message },
        { status: 500 }
      );
    }

    const results = [];

    for (const org of orgs ?? []) {
      try {
        // Fetch ventures for this org
        const { data: ventures } = await supabase
          .from("ventures")
          .select("id")
          .eq("organization_id", org.id);

        if (!ventures || ventures.length === 0) {
          results.push({
            orgId: org.id,
            ventures: 0,
            snapshots: 0,
            thresholdCrossings: 0,
            status: "success",
          });
          continue;
        }

        const isSingleVenture = ventures.length === 1;
        let snapshotCount = 0;
        let thresholdCrossings = 0;

        for (const venture of ventures) {
          // Compute current operating health
          const report = await computeOperatingHealth(
            supabase,
            org.id,
            venture.id,
            isSingleVenture
          );

          // Optionally run AI interpretation
          let aiInterpretation: string | undefined;
          try {
            const interpretation = await interpretHealthReport(
              supabase,
              org.id,
              report
            );
            aiInterpretation = interpretation.interpretation;
          } catch (aiErr) {
            console.error(
              `AI interpretation failed for org=${org.id} venture=${venture.id}:`,
              aiErr
            );
          }

          // Save snapshot
          await saveHealthSnapshot(supabase, report, aiInterpretation);
          snapshotCount++;

          // --- Threshold crossing detection ---
          // Fetch the most recent snapshot BEFORE this run
          const { data: previousSnapshots } = await supabase
            .from("operating_health_snapshots")
            .select("composite_status, created_at")
            .eq("organization_id", org.id)
            .eq("venture_id", venture.id)
            .order("created_at", { ascending: false })
            .limit(2); // The first one is the one we just saved; the second is the previous

          const previousSnapshot =
            previousSnapshots && previousSnapshots.length >= 2
              ? previousSnapshots[1]
              : null;

          if (
            previousSnapshot &&
            previousSnapshot.composite_status !== report.composite_status
          ) {
            thresholdCrossings++;

            const prevStatus = previousSnapshot.composite_status;
            const currStatus = report.composite_status;

            // Determine direction
            const statusOrder: Record<string, number> = {
              green: 3,
              yellow: 2,
              red: 1,
            };
            const improved =
              (statusOrder[currStatus] ?? 0) >
              (statusOrder[prevStatus as string] ?? 0);

            const title = improved
              ? `Operating Health improved: ${prevStatus} → ${currStatus}`
              : `Operating Health changed: ${prevStatus} → ${currStatus}`;

            const body = improved
              ? `Your operating health score improved from ${prevStatus} to ${currStatus} (composite: ${report.composite_score}/100).`
              : `Your operating health score dropped from ${prevStatus} to ${currStatus} (composite: ${report.composite_score}/100). Review the dashboard for details.`;

            // Find org admin to notify
            const { data: orgAdmin } = await supabase
              .from("organization_memberships")
              .select("user_id")
              .eq("organization_id", org.id)
              .eq("role", "admin")
              .limit(1)
              .single();

            if (orgAdmin) {
              await sendNotification(supabase, {
                userId: orgAdmin.user_id,
                orgId: org.id,
                type: "health_threshold",
                tier: "immediate",
                title,
                body,
              });
            }
          }
        }

        results.push({
          orgId: org.id,
          ventures: ventures.length,
          snapshots: snapshotCount,
          thresholdCrossings,
          status: "success",
        });
      } catch (err) {
        results.push({
          orgId: org.id,
          ventures: 0,
          snapshots: 0,
          thresholdCrossings: 0,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const totalSnapshots = results.reduce((sum, r) => sum + r.snapshots, 0);
    const totalCrossings = results.reduce(
      (sum, r) => sum + r.thresholdCrossings,
      0
    );

    return NextResponse.json({
      organizations: results.length,
      totalSnapshots,
      totalThresholdCrossings: totalCrossings,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
