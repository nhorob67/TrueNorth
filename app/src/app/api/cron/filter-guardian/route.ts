import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkAndTriggerFilterGuardian } from "@/lib/ai/filter-guardian-trigger";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { callVps } from "@/lib/hermes/vps-client";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/cron/filter-guardian
//
// Runs every 6 hours. Checks for ideas whose cooling period
// has expired, advances them to filter_review, and runs
// AI evaluation against strategic filters.
// ============================================================

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await logCronExecution(
      supabase,
      "/api/cron/filter-guardian",
      "0 */6 * * *",
      async () => {
        // Check if any orgs have a Hermes-enabled filter_guardian agent
        const { data: hermesOrgs } = await supabase
          .from("agents")
          .select("organization_id, hermes_enabled, hermes_profile_name")
          .eq("category", "filter_guardian")
          .eq("hermes_enabled", true);

        const hermesOrgIds = new Set(
          (hermesOrgs ?? [])
            .filter((a) => a.hermes_profile_name)
            .map((a) => a.organization_id)
        );

        // Delegate Hermes-enabled orgs to VPS
        let hermesProcessed = 0;
        for (const agent of hermesOrgs ?? []) {
          if (!agent.hermes_profile_name) continue;
          try {
            const vpsResult = await callVps("/api/trigger", {
              profile: agent.hermes_profile_name,
              orgId: agent.organization_id,
              mode: "one-shot",
            }) as Record<string, unknown>;
            console.log(
              `Filter Guardian Hermes result for org ${agent.organization_id}:`,
              JSON.stringify(vpsResult)
            );
            hermesProcessed++;
            // TODO: Parse VPS result and apply downstream effects (idea status updates, etc.)
            // when Hermes agents are fully wired. For now, VPS agent handles everything internally.
          } catch (err) {
            console.error(
              `Filter Guardian Hermes failed for org ${agent.organization_id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }

        // Legacy path: checkAndTriggerFilterGuardian processes all ideas globally.
        // It doesn't support per-org filtering, so we call it for all ideas.
        // Ideas belonging to Hermes-enabled orgs may be processed by both paths
        // until the legacy function supports org scoping.
        // TODO: Add org_id filtering to checkAndTriggerFilterGuardian to avoid
        // double-processing ideas for Hermes-enabled orgs.
        const legacyProcessed = await checkAndTriggerFilterGuardian(supabase);

        return {
          orgsProcessed: hermesOrgIds.size,
          summary: {
            success: true,
            legacyIdeasProcessed: legacyProcessed,
            hermesOrgsProcessed: hermesProcessed,
            timestamp: new Date().toISOString(),
          },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Filter Guardian cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
