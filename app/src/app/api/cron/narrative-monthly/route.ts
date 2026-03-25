import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateNarrative,
  saveNarrative,
} from "@/lib/ai/narrative-generator";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

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
    const supabase = await createClient();

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
          .from("organization_members")
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
        await supabase.from("notifications").insert({
          user_id: orgAdmin.user_id,
          type: "narrative_generated",
          tier: "daily_digest",
          title: "Monthly board memo generated",
          body: "Your monthly board memo has been generated — review and share with your board.",
          entity_type: "narrative",
          created_at: new Date().toISOString(),
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
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
