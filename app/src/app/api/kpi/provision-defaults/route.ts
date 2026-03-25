import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { provisionDefaultKpis } from "@/lib/kpi-templates";

export const dynamic = "force-dynamic";

/**
 * POST /api/kpi/provision-defaults
 *
 * Seeds the 9 default KPI definitions for the user's venture.
 * Skips any that already exist (idempotent).
 */
export async function POST() {
  try {
    // Auth check via user client
    const userSupabase = await createClient();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up org + venture for this user
    const { data: orgMembership } = await userSupabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgMembership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    const { data: venture } = await userSupabase
      .from("ventures")
      .select("id")
      .eq("organization_id", orgMembership.organization_id)
      .order("created_at")
      .limit(1)
      .single();

    if (!venture) {
      return NextResponse.json(
        { error: "No venture found" },
        { status: 400 }
      );
    }

    // Use service client for writes (bypasses RLS)
    const serviceSupabase = createServiceClient();

    const result = await provisionDefaultKpis(
      serviceSupabase,
      venture.id,
      orgMembership.organization_id,
      user.id
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
