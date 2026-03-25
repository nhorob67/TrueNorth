import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ============================================================
// Generic Webhook Receiver for External Content Crediting
// POST /api/webhooks/content-credit
// ============================================================

interface WebhookPayload {
  platform: "discourse" | "youtube" | "instagram" | "podcast" | "generic";
  external_id: string;
  title: string;
  url: string;
  author?: string;
  category?: string;
  published_at?: string;
}

/**
 * Validate the bearer token against the org's settings.webhook_tokens array.
 * Returns the org ID if valid, null otherwise.
 */
async function validateToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  token: string
): Promise<{ orgId: string } | null> {
  // Fetch all orgs that have webhook tokens configured
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, settings");

  if (!orgs) return null;

  for (const org of orgs) {
    const settings = org.settings as Record<string, unknown> | null;
    if (!settings) continue;
    const tokens = settings.webhook_tokens as string[] | undefined;
    if (Array.isArray(tokens) && tokens.includes(token)) {
      return { orgId: org.id };
    }
  }

  return null;
}

export async function POST(request: Request) {
  // Extract bearer token
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }
  const token = authHeader.slice(7);

  const supabase = createServiceClient();

  // Validate token against org webhook_tokens
  const auth = await validateToken(supabase, token);
  if (!auth) {
    return NextResponse.json(
      { error: "Invalid webhook token" },
      { status: 401 }
    );
  }

  // Parse and validate body
  let body: WebhookPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validPlatforms = ["discourse", "youtube", "instagram", "podcast", "generic"];
  if (!body.platform || !validPlatforms.includes(body.platform)) {
    return NextResponse.json(
      { error: "Invalid or missing platform" },
      { status: 400 }
    );
  }
  if (!body.external_id || !body.title || !body.url) {
    return NextResponse.json(
      { error: "Missing required fields: external_id, title, url" },
      { status: 400 }
    );
  }

  // Find matching recurring moves with external_source config matching platform
  const { data: moves } = await supabase
    .from("moves")
    .select("id, title, external_source, bet_id")
    .eq("organization_id", auth.orgId)
    .eq("type", "recurring")
    .not("external_source", "is", null)
    .not("lifecycle_status", "eq", "cut");

  if (!moves || moves.length === 0) {
    return NextResponse.json({
      credited: false,
      reason: "No recurring moves with external_source config found",
    });
  }

  // Filter moves whose external_source matches the platform + optional category/author
  const matchingMoves = moves.filter((m) => {
    const es = m.external_source as Record<string, unknown>;
    if (es.platform !== body.platform) return false;
    if (es.category && body.category && es.category !== body.category) return false;
    if (es.author && body.author && es.author !== body.author) return false;
    return true;
  });

  if (matchingMoves.length === 0) {
    return NextResponse.json({
      credited: false,
      reason: `No recurring moves match platform "${body.platform}"${body.category ? ` + category "${body.category}"` : ""}`,
    });
  }

  // Credit the first matching move's oldest pending instance
  const move = matchingMoves[0];

  const { data: instances } = await supabase
    .from("move_instances")
    .select("id")
    .eq("move_id", move.id)
    .eq("status", "pending")
    .order("cycle_start", { ascending: true })
    .limit(1);

  if (!instances || instances.length === 0) {
    return NextResponse.json({
      credited: false,
      moveId: move.id,
      moveTitle: move.title,
      reason: "No pending instances to credit for this move",
    });
  }

  const instance = instances[0];

  // Credit the instance
  const webhookData = {
    platform: body.platform,
    external_id: body.external_id,
    title: body.title,
    url: body.url,
    author: body.author ?? null,
    category: body.category ?? null,
    published_at: body.published_at ?? null,
    received_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("move_instances")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      linked_entity_id: null,
      linked_entity_type: null,
      notes: JSON.stringify(webhookData),
    })
    .eq("id", instance.id);

  if (updateError) {
    return NextResponse.json(
      {
        credited: false,
        error: `Failed to credit instance: ${updateError.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    credited: true,
    moveId: move.id,
    moveTitle: move.title,
    instanceId: instance.id,
    webhookData,
  });
}
