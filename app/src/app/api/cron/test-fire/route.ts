import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeExternalSourceAdHoc } from "@/lib/cron/engine";
import type { ExternalSourceConfig } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/test-fire
 *
 * Client-facing endpoint for test-firing external source cron jobs.
 * Uses session auth (not CRON_SECRET) so it can be called from the admin UI.
 * Only admins can use this endpoint.
 */
export async function POST(request: Request) {
  try {
    // Auth check: must be logged-in admin
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabaseAuth
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { externalConfig, systemPrompt, jobId } = body as {
      externalConfig: ExternalSourceConfig;
      systemPrompt: string;
      jobId?: string;
    };

    if (!externalConfig?.source_type) {
      return NextResponse.json({ error: "externalConfig with source_type is required" }, { status: 400 });
    }

    if (!systemPrompt) {
      return NextResponse.json({ error: "systemPrompt is required" }, { status: 400 });
    }

    // Use service client for external source execution (needs service role for DB writes)
    const supabase = createServiceClient();

    const result = await executeExternalSourceAdHoc(
      supabase,
      externalConfig,
      membership.organization_id,
      jobId ?? "adhoc",
      systemPrompt
    );

    return NextResponse.json({
      status: "success",
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
