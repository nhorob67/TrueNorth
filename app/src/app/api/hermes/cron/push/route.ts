import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callVps, isVpsConfigured } from "@/lib/hermes/vps-client";

/**
 * POST /api/hermes/cron/push — Register or update a cron job on the VPS.
 * Body: { action: "register" | "update", job: { id, orgId, profile, name, prompt, schedule, enabled } }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { action, job } = body;

  if (!action || !job?.id) {
    return NextResponse.json({ error: "Missing action or job.id" }, { status: 400 });
  }

  if (!isVpsConfigured()) {
    return NextResponse.json({ error: "VPS not configured" }, { status: 503 });
  }

  try {
    if (action === "register") {
      await callVps("/api/cron/register", {
        id: job.id,
        orgId: job.orgId,
        profile: job.profile,
        name: job.name,
        prompt: job.prompt ?? null,
        schedule: job.schedule,
        enabled: job.enabled,
      });
    } else if (action === "update") {
      await callVps(
        "/api/cron/update",
        {
          id: job.id,
          orgId: job.orgId,
          profile: job.profile,
          name: job.name,
          prompt: job.prompt ?? null,
          schedule: job.schedule,
          enabled: job.enabled,
        },
        { method: "PUT" }
      );
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "VPS push failed";
    console.error("[hermes/cron/push] Error:", message);
    return NextResponse.json({ error: message, vpsError: true }, { status: 502 });
  }
}

/**
 * DELETE /api/hermes/cron/push — Remove a cron job from the VPS.
 * Body: { id: string }
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  if (!isVpsConfigured()) {
    return NextResponse.json({ error: "VPS not configured" }, { status: 503 });
  }

  try {
    await callVps("/api/cron/delete", { id }, { method: "DELETE" });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "VPS delete failed";
    console.error("[hermes/cron/push] Delete error:", message);
    return NextResponse.json({ error: message, vpsError: true }, { status: 502 });
  }
}
