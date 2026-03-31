import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { callVps } from "@/lib/hermes/vps-client";
import { persistVpsResult } from "@/lib/hermes/persist-result";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/market-scout
 *
 * Weekly cron (Monday 9 AM) that runs Market Scout for every org.
 * Hermes-only agent — performs competitor monitoring and market intelligence.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await logCronExecution(
      supabase,
      "/api/cron/market-scout",
      "0 9 * * 1",
      async () => {
        // Fetch all organizations
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("id, name");

        if (orgError) {
          throw new Error(`Failed to fetch organizations: ${orgError.message}`);
        }

        const results = [];

        for (const org of orgs ?? []) {
          try {
            // Check if this agent is Hermes-enabled for this org
            const { data: hermesAgent } = await supabase
              .from("agents")
              .select("hermes_enabled, hermes_profile_name")
              .eq("organization_id", org.id)
              .eq("category", "market_scout")
              .single();

            if (hermesAgent?.hermes_enabled && hermesAgent.hermes_profile_name) {
              // Delegate to Hermes VPS
              try {
                const vpsResult = await callVps("/api/trigger", {
                  profile: hermesAgent.hermes_profile_name,
                  orgId: org.id,
                  mode: "one-shot",
                }, { timeout: 270_000 }) as Record<string, unknown>;

                await persistVpsResult(supabase, {
                  orgId: org.id,
                  agentProfile: hermesAgent.hermes_profile_name,
                  agentCategory: "market_scout",
                  vpsResult: vpsResult,
                });

                results.push({
                  orgId: org.id,
                  orgName: org.name,
                  status: "hermes",
                  hermesResult: vpsResult,
                });
              } catch (err) {
                console.error(
                  `Market Scout Hermes failed for org ${org.id}:`,
                  err instanceof Error ? err.message : err
                );
                results.push({
                  orgId: org.id,
                  orgName: org.name,
                  status: "hermes_error",
                  error: err instanceof Error ? err.message : "Hermes VPS error",
                });
              }
            } else {
              // Market Scout is Hermes-only — no legacy path
              console.log(`Market Scout not enabled for org ${org.id}`);
              results.push({
                orgId: org.id,
                orgName: org.name,
                status: "not_enabled",
              });
            }
          } catch (err) {
            results.push({
              orgId: org.id,
              orgName: org.name,
              status: "error",
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return {
          orgsProcessed: results.length,
          summary: {
            organizations: results.length,
            results,
          },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
