import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSupabase } from "../shared/supabase.js";

const server = new McpServer({
  name: "truenorth-actions",
  version: "0.1.0",
});

// ── log_action ──────────────────────────────────────────────────────
server.tool(
  "log_action",
  "Log an AI action into the ai_actions table",
  {
    org_id: z.string().describe("Organization UUID"),
    agent_category: z.string().describe("Agent category identifier"),
    action_type: z.string().describe("Type of action performed"),
    entity_id: z.string().optional().describe("Related entity UUID"),
    entity_type: z.string().optional().describe("Type of related entity"),
    input_summary: z.string().describe("Summary of the input"),
    output_summary: z.string().describe("Summary of the output"),
    confidence: z.enum(["high", "medium", "low"]).optional().describe("Confidence level"),
    processing_time_ms: z.number().optional().describe("Processing time in milliseconds"),
  },
  async ({ org_id, agent_category, action_type, entity_id, entity_type, input_summary, output_summary, confidence, processing_time_ms }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ai_actions")
      .insert({
        organization_id: org_id,
        agent_category,
        action_type,
        entity_id,
        entity_type,
        input_summary,
        output_summary,
        confidence,
        processing_time_ms,
      })
      .select("id")
      .single();

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify({ action_id: data.id }, null, 2) }] };
  }
);

// ── record_outcome ──────────────────────────────────────────────────
server.tool(
  "record_outcome",
  "Update an existing ai_action's outcome",
  {
    action_id: z.string().describe("Action UUID"),
    outcome: z.enum(["accepted", "overridden", "ignored"]).describe("Outcome of the action"),
    override_reason: z.string().optional().describe("Reason for override"),
  },
  async ({ action_id, outcome, override_reason }) => {
    const supabase = getSupabase();
    const update: Record<string, string> = { outcome };
    if (override_reason) update.override_reason = override_reason;

    const { error } = await supabase
      .from("ai_actions")
      .update(update)
      .eq("id", action_id);

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, action_id }, null, 2) }] };
  }
);

// ── list_pending_reviews ────────────────────────────────────────────
server.tool(
  "list_pending_reviews",
  "List ai_actions where outcome is pending",
  {
    org_id: z.string().describe("Organization UUID"),
    agent_category: z.string().optional().describe("Filter by agent category"),
    limit: z.number().optional().describe("Max results (default: 20)"),
  },
  async ({ org_id, agent_category, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("ai_actions")
      .select("id, agent_category, action_type, entity_id, entity_type, input_summary, output_summary, confidence, created_at")
      .eq("organization_id", org_id)
      .eq("outcome", "pending")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (agent_category) query = query.eq("agent_category", agent_category);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── get_trust_metrics ───────────────────────────────────────────────
server.tool(
  "get_trust_metrics",
  "Aggregate ai_actions to compute acceptance/override rates",
  {
    org_id: z.string().describe("Organization UUID"),
    agent_category: z.string().optional().describe("Filter by agent category"),
    days: z.number().optional().describe("Lookback window in days (default: 30)"),
  },
  async ({ org_id, agent_category, days }) => {
    const supabase = getSupabase();
    const since = new Date();
    since.setDate(since.getDate() - (days ?? 30));

    let query = supabase
      .from("ai_actions")
      .select("outcome")
      .eq("organization_id", org_id)
      .gte("created_at", since.toISOString());

    if (agent_category) query = query.eq("agent_category", agent_category);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }

    const rows = data ?? [];
    const total = rows.length;
    const accepted = rows.filter((r) => r.outcome === "accepted").length;
    const overridden = rows.filter((r) => r.outcome === "overridden").length;
    const ignored = rows.filter((r) => r.outcome === "ignored").length;
    const pending = rows.filter((r) => r.outcome === "pending").length;

    const metrics = {
      total,
      accepted: { count: accepted, rate: total > 0 ? accepted / total : 0 },
      overridden: { count: overridden, rate: total > 0 ? overridden / total : 0 },
      ignored: { count: ignored, rate: total > 0 ? ignored / total : 0 },
      pending: { count: pending },
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(metrics, null, 2) }] };
  }
);

// ── submit_reviewable_action ────────────────────────────────────────
server.tool(
  "submit_reviewable_action",
  "Insert an ai_action with outcome=pending — a central write primitive for agents proposing changes",
  {
    org_id: z.string().describe("Organization UUID"),
    agent_profile: z.string().describe("Agent profile identifier (stored as agent_category)"),
    title: z.string().describe("Action title (stored as action_type)"),
    description: z.string().optional().describe("Description of the proposed action"),
    entity_id: z.string().optional().describe("Related entity UUID"),
    entity_type: z.string().optional().describe("Type of related entity"),
    payload: z.any().optional().describe("Arbitrary payload (stored as JSON string in output_summary)"),
  },
  async ({ org_id, agent_profile, title, description, entity_id, entity_type, payload }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ai_actions")
      .insert({
        organization_id: org_id,
        agent_category: agent_profile,
        action_type: title,
        entity_id,
        entity_type,
        input_summary: description ?? "",
        output_summary: JSON.stringify(payload ?? {}),
        outcome: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify({ action_id: data.id }, null, 2) }] };
  }
);

// ── request_notification ────────────────────────────────────────────
server.tool(
  "request_notification",
  "Send a notification to a specific user or all org admins",
  {
    org_id: z.string().describe("Organization UUID"),
    user_id: z.string().optional().describe("Target user UUID (if not provided, sends to all org admins)"),
    type: z.string().describe("Notification type"),
    tier: z.enum(["immediate", "urgent", "daily_digest", "weekly_digest"]).describe("Notification tier"),
    title: z.string().describe("Notification title"),
    body: z.string().optional().describe("Notification body"),
    entity_id: z.string().optional().describe("Related entity UUID"),
    entity_type: z.string().optional().describe("Type of related entity"),
  },
  async ({ org_id, user_id, type, tier, title, body, entity_id, entity_type }) => {
    const supabase = getSupabase();

    let userIds: string[] = [];

    if (user_id) {
      userIds = [user_id];
    } else {
      const { data: members, error: membersErr } = await supabase
        .from("organization_memberships")
        .select("user_id")
        .eq("organization_id", org_id)
        .eq("role", "admin");

      if (membersErr) {
        return { content: [{ type: "text" as const, text: `Error: ${membersErr.message}` }], isError: true };
      }
      userIds = (members ?? []).map((m) => m.user_id);
    }

    const rows = userIds.map((uid) => ({
      organization_id: org_id,
      user_id: uid,
      type,
      tier,
      title,
      body,
      entity_id,
      entity_type,
    }));

    const { error } = await supabase.from("notifications").insert(rows);

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify({ sent: userIds.length }, null, 2) }] };
  }
);

// ── save_memory ─────────────────────────────────────────────────────
server.tool(
  "save_memory",
  "Upsert a memory entry into the agent_memory table",
  {
    org_id: z.string().describe("Organization UUID"),
    agent_id: z.string().describe("Agent UUID"),
    memory_type: z.enum(["core", "user", "session"]).describe("Type of memory"),
    key: z.string().describe("Memory key"),
    content: z.string().describe("Memory content"),
  },
  async ({ org_id, agent_id, memory_type, key, content }) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("agent_memory")
      .upsert(
        {
          organization_id: org_id,
          agent_id,
          memory_type,
          key,
          content,
        },
        { onConflict: "agent_id,memory_type,key" }
      );

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, key, memory_type }, null, 2) }] };
  }
);

// ── get_memory ──────────────────────────────────────────────────────
server.tool(
  "get_memory",
  "Query memory entries from the agent_memory table",
  {
    agent_id: z.string().describe("Agent UUID"),
    memory_type: z.enum(["core", "user", "session"]).optional().describe("Filter by memory type"),
    key: z.string().optional().describe("Filter by memory key"),
  },
  async ({ agent_id, memory_type, key }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("agent_memory")
      .select("id, memory_type, key, content, version, created_at, updated_at")
      .eq("agent_id", agent_id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (memory_type) query = query.eq("memory_type", memory_type);
    if (key) query = query.eq("key", key);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Start server ────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("truenorth-actions MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
