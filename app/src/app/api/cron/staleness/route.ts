import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkStaleness } from "@/lib/staleness";
import { sendNotification } from "@/lib/notifications";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/staleness
 *
 * Daily digest cron (8 AM) that checks all organizations for stale artifacts
 * and sends staleness_alert notifications to artifact owners (or org admins).
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Fetch all organizations
    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id");

    if (orgError) {
      return NextResponse.json(
        { error: "Failed to fetch organizations", details: orgError.message },
        { status: 500 }
      );
    }

    const results = [];
    let totalAlerts = 0;

    for (const org of orgs ?? []) {
      try {
        // Fetch ventures for this org
        const { data: ventures } = await supabase
          .from("ventures")
          .select("id")
          .eq("organization_id", org.id);

        // Fetch org admins once (fallback for artifacts without an owner)
        const { data: admins } = await supabase
          .from("organization_memberships")
          .select("user_id")
          .eq("organization_id", org.id)
          .eq("role", "admin");

        const adminIds = (admins ?? []).map((a) => a.user_id);
        let orgAlerts = 0;

        for (const venture of ventures ?? []) {
          const stalenessResults = await checkStaleness(
            supabase,
            venture.id,
            org.id
          );

          const staleArtifacts = stalenessResults.filter((a) => a.is_stale);

          for (const artifact of staleArtifacts) {
            const overdueDays =
              artifact.days_since_update !== null
                ? artifact.days_since_update - artifact.staleness_threshold_days
                : null;

            const body =
              overdueDays !== null && overdueDays > 0
                ? `${artifact.name} is ${overdueDays} day${overdueDays !== 1 ? "s" : ""} overdue for an update.`
                : `${artifact.name} needs an update.`;

            const recipientIds = artifact.owner_id
              ? [artifact.owner_id]
              : adminIds;

            for (const userId of recipientIds) {
              await sendNotification(supabase, {
                userId,
                orgId: org.id,
                type: "staleness_alert",
                tier: "daily_digest",
                title: `Stale artifact: ${artifact.name}`,
                body,
                entityType: "artifact",
                entityId: artifact.artifact_type,
              });
              orgAlerts++;
            }
          }
        }

        totalAlerts += orgAlerts;
        results.push({
          orgId: org.id,
          alerts: orgAlerts,
          status: "success",
        });
      } catch (err) {
        results.push({
          orgId: org.id,
          alerts: 0,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      organizations: results.length,
      totalAlerts,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
