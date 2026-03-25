import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateNarrative,
  saveNarrative,
} from "@/lib/ai/narrative-generator";
import { sendNotification } from "@/lib/notifications";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/narrative-monthly
 *
 * Designed to be called by Vercel Cron on the 1st of each month.
 * Generates a monthly board memo narrative for each organization's primary venture.
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
        // Fetch the primary (first) venture for this org
        const { data: ventures } = await supabase
          .from("ventures")
          .select("id")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (!ventures || ventures.length === 0) {
          results.push({
            orgId: org.id,
            narrativeId: null,
            status: "skipped",
            reason: "No ventures found",
          });
          continue;
        }

        const ventureId = ventures[0].id;

        // Window: last 30 days
        const endDate = new Date().toISOString();
        const startDate = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString();

        // Find org admin as the generating user
        const { data: orgAdmin } = await supabase
          .from("organization_memberships")
          .select("user_id")
          .eq("organization_id", org.id)
          .eq("role", "admin")
          .limit(1)
          .single();

        if (!orgAdmin) {
          results.push({
            orgId: org.id,
            narrativeId: null,
            status: "skipped",
            reason: "No org admin found",
          });
          continue;
        }

        const input = {
          orgId: org.id,
          ventureId,
          narrativeType: "monthly_board_memo" as const,
          startDate,
          endDate,
          userId: orgAdmin.user_id,
        };

        const result = await generateNarrative(supabase, input);
        const narrativeId = await saveNarrative(supabase, input, result);

        // Notify org admin
        await sendNotification(supabase, {
          userId: orgAdmin.user_id,
          orgId: org.id,
          type: "narrative_generated",
          tier: "daily_digest",
          title: "Monthly board memo generated",
          body: "Your monthly board memo has been generated. Review and share it with your board.",
        });

        results.push({
          orgId: org.id,
          narrativeId,
          status: "success",
        });
      } catch (err) {
        results.push({
          orgId: org.id,
          narrativeId: null,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const generated = results.filter((r) => r.status === "success").length;

    return NextResponse.json({
      organizations: results.length,
      narrativesGenerated: generated,
      results,
    });
  } catch (err) {
    console.error("Narrative monthly cron error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
