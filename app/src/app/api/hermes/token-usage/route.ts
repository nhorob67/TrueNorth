import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyHermesSecret } from "@/lib/hermes/verify-secret";

export const dynamic = "force-dynamic";

/**
 * POST /api/hermes/token-usage
 *
 * Hermes reports token usage after an LLM call or at session end.
 *
 * Body: { orgId, agentId?, hermesProfile, sessionId?, taskId?, model, inputTokens, outputTokens, cacheReadTokens?, estimatedCost, metadata? }
 * Or batch: { records: Array<above> }
 */
export async function POST(request: Request) {
  if (!verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createServiceClient();

  // Support both single record and batch
  const records: Array<Record<string, unknown>> = body.records ?? [body];

  const rows = records.map((r) => ({
    organization_id: r.orgId as string,
    agent_id: (r.agentId as string) ?? null,
    hermes_profile: r.hermesProfile as string,
    session_id: (r.sessionId as string) ?? null,
    task_id: (r.taskId as string) ?? null,
    model: r.model as string,
    input_tokens: (r.inputTokens as number) ?? 0,
    output_tokens: (r.outputTokens as number) ?? 0,
    cache_read_tokens: (r.cacheReadTokens as number) ?? 0,
    estimated_cost: (r.estimatedCost as number) ?? 0,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }));

  // Validate required fields
  for (const row of rows) {
    if (!row.organization_id || !row.hermes_profile || !row.model) {
      return NextResponse.json(
        { error: "Each record requires orgId, hermesProfile, and model" },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.from("agent_token_usage").insert(rows);

  if (error) {
    return NextResponse.json(
      { error: "Failed to record token usage", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, recorded: rows.length });
}
