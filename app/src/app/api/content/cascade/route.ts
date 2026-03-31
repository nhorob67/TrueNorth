import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUserContext } from "@/lib/user-context";
import { callVps, isVpsConfigured } from "@/lib/hermes/vps-client";
import { persistVpsResult } from "@/lib/hermes/persist-result";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/content/cascade
 *
 * Triggers Content Cascade for a published flagship content piece.
 * Extracts insights and generates variants for all other content machines.
 * Results land in Cockpit Inbox for Nick review.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getUserContext(supabase);
  if (!ctx) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { contentPieceId } = (await request.json()) as { contentPieceId?: string };
  if (!contentPieceId) {
    return NextResponse.json({ error: "contentPieceId is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Fetch the content piece
  const { data: piece, error: pieceErr } = await serviceClient
    .from("content_pieces")
    .select("id, organization_id, venture_id, title, machine_type, lifecycle_status, cascade_status")
    .eq("id", contentPieceId)
    .eq("organization_id", ctx.orgId)
    .single();

  if (pieceErr || !piece) {
    return NextResponse.json({ error: "Content piece not found" }, { status: 404 });
  }

  // Validate: must be published and a flagship type
  if (piece.lifecycle_status !== "published") {
    return NextResponse.json({ error: "Content piece must be published to cascade" }, { status: 400 });
  }

  if (piece.machine_type !== "newsletter" && piece.machine_type !== "deep_content") {
    return NextResponse.json(
      { error: "Only newsletter and deep_content pieces can be cascaded" },
      { status: 400 }
    );
  }

  // Idempotency: don't re-cascade
  if (piece.cascade_status === "running" || piece.cascade_status === "completed") {
    return NextResponse.json({
      cascadeStarted: false,
      reason: `Cascade already ${piece.cascade_status}`,
    });
  }

  // Check if VPS is configured
  if (!isVpsConfigured()) {
    return NextResponse.json({ error: "Hermes VPS is not configured" }, { status: 503 });
  }

  // Look up the content-cascade agent
  const { data: agent } = await serviceClient
    .from("agents")
    .select("hermes_enabled, hermes_profile_name")
    .eq("organization_id", ctx.orgId)
    .eq("category", "content_cascade")
    .single();

  if (!agent?.hermes_enabled || !agent.hermes_profile_name) {
    return NextResponse.json({ error: "Content Cascade agent not enabled" }, { status: 400 });
  }

  // Mark cascade as pending
  await serviceClient
    .from("content_pieces")
    .update({ cascade_status: "pending" })
    .eq("id", contentPieceId);

  try {
    // Trigger Hermes VPS
    const vpsResult = await callVps("/api/trigger", {
      profile: agent.hermes_profile_name,
      orgId: ctx.orgId,
      ventureId: piece.venture_id,
      mode: "one-shot",
      context: {
        source_piece_id: contentPieceId,
        source_machine_type: piece.machine_type,
      },
    }, { timeout: 270_000 }) as Record<string, unknown>;

    // Persist result as reviewable task in Cockpit Inbox
    await persistVpsResult(serviceClient, {
      orgId: ctx.orgId,
      ventureId: piece.venture_id,
      agentProfile: agent.hermes_profile_name,
      agentCategory: "content_cascade",
      vpsResult,
      entityId: contentPieceId,
      entityType: "content_piece",
    });

    // Mark cascade as running (awaiting review)
    await serviceClient
      .from("content_pieces")
      .update({ cascade_status: "running" })
      .eq("id", contentPieceId);

    return NextResponse.json({ cascadeStarted: true });
  } catch (err) {
    // Revert cascade status on failure
    await serviceClient
      .from("content_pieces")
      .update({ cascade_status: null })
      .eq("id", contentPieceId);

    console.error("Content Cascade trigger failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to trigger cascade", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
