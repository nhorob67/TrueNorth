import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { callVps } from "@/lib/hermes/vps-client";
import { persistVpsResult } from "@/lib/hermes/persist-result";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/content-cascade
 *
 * Weekly catch-up cron (Sunday 10 AM) that finds published flagship
 * pieces not yet cascaded and triggers Content Cascade for each.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await logCronExecution(
      supabase,
      "/api/cron/content-cascade",
      "0 10 * * 0",
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
            // Check if Content Cascade agent is enabled for this org
            const { data: agent } = await supabase
              .from("agents")
              .select("hermes_enabled, hermes_profile_name")
              .eq("organization_id", org.id)
              .eq("category", "content_cascade")
              .single();

            if (!agent?.hermes_enabled || !agent.hermes_profile_name) {
              results.push({
                orgId: org.id,
                orgName: org.name,
                status: "not_enabled",
              });
              continue;
            }

            // Find published flagship pieces not yet cascaded (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const { data: pieces } = await supabase
              .from("content_pieces")
              .select("id, venture_id, title, machine_type")
              .eq("organization_id", org.id)
              .eq("lifecycle_status", "published")
              .in("machine_type", ["newsletter", "deep_content"])
              .is("cascade_status", null)
              .gte("created_at", thirtyDaysAgo);

            if (!pieces?.length) {
              results.push({
                orgId: org.id,
                orgName: org.name,
                status: "no_pieces",
                piecesFound: 0,
              });
              continue;
            }

            let cascaded = 0;
            let errors = 0;

            for (const piece of pieces) {
              try {
                // Mark as pending
                await supabase
                  .from("content_pieces")
                  .update({ cascade_status: "pending" })
                  .eq("id", piece.id);

                const vpsResult = await callVps("/api/trigger", {
                  profile: agent.hermes_profile_name,
                  orgId: org.id,
                  ventureId: piece.venture_id,
                  mode: "one-shot",
                  context: {
                    source_piece_id: piece.id,
                    source_machine_type: piece.machine_type,
                  },
                }, { timeout: 270_000 }) as Record<string, unknown>;

                await persistVpsResult(supabase, {
                  orgId: org.id,
                  ventureId: piece.venture_id,
                  agentProfile: agent.hermes_profile_name,
                  agentCategory: "content_cascade",
                  vpsResult,
                  entityId: piece.id,
                  entityType: "content_piece",
                });

                // Mark as running (awaiting review)
                await supabase
                  .from("content_pieces")
                  .update({ cascade_status: "running" })
                  .eq("id", piece.id);

                cascaded++;
              } catch (err) {
                // Revert status on failure
                await supabase
                  .from("content_pieces")
                  .update({ cascade_status: null })
                  .eq("id", piece.id);

                console.error(
                  `Content Cascade failed for piece ${piece.id}:`,
                  err instanceof Error ? err.message : err
                );
                errors++;
              }
            }

            results.push({
              orgId: org.id,
              orgName: org.name,
              status: "processed",
              piecesFound: pieces.length,
              cascaded,
              errors,
            });
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
