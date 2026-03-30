import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { verifyHermesSecret } from "@/lib/hermes/verify-secret";
import { callVps, isVpsConfigured } from "@/lib/hermes/vps-client";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/trigger
 *
 * Triggers a Hermes agent profile on the VPS.
 * Authenticated via CRON_SECRET (for Vercel cron routes) or HERMES_API_SECRET.
 *
 * Body: { profile, orgId, ventureId?, mode: "one-shot"|"async", timeout? }
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request) && !verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVpsConfigured()) {
    return NextResponse.json(
      { error: "Hermes VPS is not configured" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { profile, orgId, ventureId, mode = "one-shot", timeout } = body;

  if (!profile || !orgId) {
    return NextResponse.json(
      { error: "Missing required fields: profile, orgId" },
      { status: 400 }
    );
  }

  // Verify the agent exists and is hermes-enabled
  const supabase = createServiceClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("id, hermes_enabled, hermes_profile_name")
    .eq("organization_id", orgId)
    .eq("hermes_profile_name", profile)
    .single();

  if (!agent?.hermes_enabled) {
    return NextResponse.json(
      { error: `Agent profile '${profile}' is not enabled for Hermes` },
      { status: 404 }
    );
  }

  try {
    const result = await callVps("/api/trigger", {
      profile,
      orgId,
      ventureId: ventureId ?? null,
      mode,
    }, { timeout: timeout ?? 55_000 });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "VPS call failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
