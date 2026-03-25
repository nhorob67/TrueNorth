import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resurfaceRelevantIdeas } from "@/lib/ai/vault-archaeologist";
import { sendNotification } from "@/lib/notifications";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

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

    // Fetch all orgs and their ventures
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name");

    const results = [];

    for (const org of orgs ?? []) {
      try {
        const { data: ventures } = await supabase
          .from("ventures")
          .select("id, name")
          .eq("organization_id", org.id);

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
      } catch (err) {
        results.push({
          orgId: org.id,
          orgName: org.name,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      results,
      totalResurfaced: results.reduce(
        (sum, r) => sum + ((r as { resurfaced?: number }).resurfaced ?? 0),
        0
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
