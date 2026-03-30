import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resurfaceRelevantIdeas } from "@/lib/ai/vault-archaeologist";
import { sendNotification } from "@/lib/notifications";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { callVps } from "@/lib/hermes/vps-client";

export const dynamic = "force-dynamic";

// ============================================================
// Monthly Vault Archaeologist Cron
// Runs 1st of month at 8am — resurfaces archived ideas
// ============================================================

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await logCronExecution(
      supabase,
      "/api/cron/vault-archaeologist",
      "0 8 1 * *",
      async () => {
        // Fetch all orgs and their ventures
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name");

        const results: Array<Record<string, unknown>> = [];

        for (const org of orgs ?? []) {
          try {
            const { data: ventures } = await supabase
              .from("ventures")
              .select("id, name")
              .eq("organization_id", org.id);

            // Check if this agent is Hermes-enabled for this org
            const { data: hermesAgent } = await supabase
              .from("agents")
              .select("hermes_enabled, hermes_profile_name")
              .eq("organization_id", org.id)
              .eq("category", "vault_archaeologist")
              .single();

            if (hermesAgent?.hermes_enabled && hermesAgent.hermes_profile_name) {
              // Delegate to Hermes VPS per venture
              for (const venture of ventures ?? []) {
                const vpsResult = await callVps("/api/trigger", {
                  profile: hermesAgent.hermes_profile_name,
                  orgId: org.id,
                  ventureId: venture.id,
                  mode: "one-shot",
                }) as Record<string, unknown>;
                // TODO: Parse VPS result and dispatch notifications when Hermes agents are fully wired
                console.log(`Delegated to Hermes: ${hermesAgent.hermes_profile_name} for org ${org.id}, venture ${venture.id}`, vpsResult);
              }
            } else {
              // Legacy: existing AI call
              for (const venture of ventures ?? []) {
                try {
                  const ideas = await resurfaceRelevantIdeas(
                    supabase,
                    org.id,
                    venture.id
                  );

                  // Send notifications for resurfaced ideas
                  if (ideas.length > 0) {
                    // Find admins to notify
                    const { data: admins } = await supabase
                      .from("organization_memberships")
                      .select("user_id")
                      .eq("organization_id", org.id)
                      .eq("role", "admin");

                    for (const idea of ideas) {
                      for (const admin of admins ?? []) {
                        await sendNotification(supabase, {
                          userId: admin.user_id,
                          orgId: org.id,
                          type: "cockpit_advice",
                          tier: "daily_digest",
                          title: `Resurfaced Idea: ${idea.ideaName}`,
                          body: idea.reason,
                          entityId: idea.ideaId,
                          entityType: "idea",
                        });
                      }
                    }
                  }

                  results.push({
                    orgId: org.id,
                    ventureId: venture.id,
                    ventureName: venture.name,
                    resurfaced: ideas.length,
                    ideas: ideas.map((i) => i.ideaName),
                  });
                } catch (err) {
                  results.push({
                    orgId: org.id,
                    ventureId: venture.id,
                    ventureName: venture.name,
                    status: "error",
                    error: err instanceof Error ? err.message : "Unknown error",
                  });
                }
              }
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
            results,
            totalResurfaced: results.reduce(
              (sum, r) => sum + ((r as { resurfaced?: number }).resurfaced ?? 0),
              0
            ),
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
