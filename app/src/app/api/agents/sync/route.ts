import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyHermesSecret } from "@/lib/hermes/verify-secret";
import { callVps, isVpsConfigured } from "@/lib/hermes/vps-client";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/sync
 *
 * Bidirectional sync between TrueNorth and the Hermes VPS.
 *
 * direction: "to-vps" — Admin pushes SOUL/memory to VPS (authenticated via Supabase session)
 * direction: "from-vps" — VPS pushes memory/session/skill data back (authenticated via HERMES_API_SECRET)
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { direction } = body;

  if (direction === "to-vps") {
    return handleToVps(request, body);
  }

  if (direction === "from-vps") {
    return handleFromVps(request, body);
  }

  return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
}

async function handleToVps(request: Request, body: Record<string, unknown>) {
  // Authenticate via Supabase session (admin only)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVpsConfigured()) {
    return NextResponse.json(
      { error: "Hermes VPS is not configured" },
      { status: 503 }
    );
  }

  const { type, agentId, data } = body as {
    type: string;
    agentId: string;
    data: { profile_name: string; content: string };
  };

  if (!type || !agentId || !data?.profile_name) {
    return NextResponse.json(
      { error: "Missing required fields: type, agentId, data.profile_name" },
      { status: 400 }
    );
  }

  try {
    const result = await callVps(`/api/sync-${type}`, data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "VPS sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function handleFromVps(request: Request, body: Record<string, unknown>) {
  // Authenticate via shared secret
  if (!verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { type, profile_name, data } = body as {
    type: string;
    profile_name: string;
    data: Record<string, unknown>;
  };

  if (!type || !profile_name) {
    return NextResponse.json(
      { error: "Missing required fields: type, profile_name" },
      { status: 400 }
    );
  }

  // Look up agent by profile name
  const { data: agent } = await supabase
    .from("agents")
    .select("id, organization_id")
    .eq("hermes_profile_name", profile_name)
    .single();

  if (!agent) {
    return NextResponse.json(
      { error: `Agent profile '${profile_name}' not found` },
      { status: 404 }
    );
  }

  if (type === "memory") {
    const { memory_type, key, content, metadata } = data as {
      memory_type: string;
      key: string;
      content: string;
      metadata?: Record<string, unknown>;
    };

    await supabase.from("agent_memory").upsert(
      {
        organization_id: agent.organization_id,
        agent_id: agent.id,
        memory_type,
        key,
        content,
        metadata: metadata ?? {},
      },
      { onConflict: "agent_id,memory_type,key" }
    );

    return NextResponse.json({ success: true });
  }

  if (type === "session_end") {
    // Update heartbeat and connection status
    await supabase
      .from("agents")
      .update({
        connection_status: "idle",
        last_heartbeat_at: new Date().toISOString(),
        current_task_id: null,
      })
      .eq("id", agent.id);

    return NextResponse.json({ success: true });
  }

  if (type === "skill_learned") {
    const { skill_name, skill_content } = data as {
      skill_name: string;
      skill_content: string;
    };

    await supabase.from("agent_skills").upsert(
      {
        organization_id: agent.organization_id,
        agent_profile: profile_name,
        skill_name,
        skill_content,
        auto_generated: true,
        approved: false,
        source: "auto_generated",
      },
      { onConflict: "organization_id,agent_profile,skill_name" }
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown sync type: ${type}` }, { status: 400 });
}
