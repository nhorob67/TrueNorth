import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSupabase } from "../shared/supabase.js";

const server = new McpServer({
  name: "truenorth-operations",
  version: "0.1.0",
});

// ── list_blockers ───────────────────────────────────────────────────
server.tool(
  "list_blockers",
  "List blockers for an organization, optionally filtered by resolution state or severity",
  {
    org_id: z.string().describe("Organization UUID"),
    resolution_state: z
      .enum(["open", "resolved", "wont_fix"])
      .optional()
      .describe("Filter by resolution state (default: open)"),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .describe("Filter by severity"),
    limit: z.number().optional().describe("Max results (default: 50)"),
  },
  async ({ org_id, resolution_state, severity, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("blockers")
      .select(
        "id, description, severity, linked_entity_id, linked_entity_type, resolution_state, owner_id, resolved_at, resolution_notes, created_at, updated_at"
      )
      .eq("organization_id", org_id)
      .eq("resolution_state", resolution_state ?? "open")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);

    if (severity) query = query.eq("severity", severity);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }

    const enriched = (data ?? []).map((b) => ({
      ...b,
      age_days: Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
  }
);

// ── list_decisions ──────────────────────────────────────────────────
server.tool(
  "list_decisions",
  "List decisions for an organization, optionally filtered to pending-only or since a date",
  {
    org_id: z.string().describe("Organization UUID"),
    pending_only: z.boolean().optional().describe("If true, only return decisions without a decided_at date"),
    since: z.string().optional().describe("ISO date — only decisions created after this date"),
    limit: z.number().optional().describe("Max results (default: 30)"),
  },
  async ({ org_id, pending_only, since, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("decisions")
      .select(
        "id, title, context, options_considered, final_decision, owner_id, linked_entity_id, linked_entity_type, decided_at, created_at"
      )
      .eq("organization_id", org_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 30);

    if (pending_only) query = query.is("decided_at", null);
    if (since) query = query.gte("created_at", since);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── list_commitments ────────────────────────────────────────────────
server.tool(
  "list_commitments",
  "List commitments for an organization, optionally filtered by status or overdue-only",
  {
    org_id: z.string().describe("Organization UUID"),
    status: z
      .enum(["pending", "completed", "missed", "cancelled"])
      .optional()
      .describe("Filter by commitment status"),
    overdue_only: z.boolean().optional().describe("If true, only return pending commitments past their due date"),
    limit: z.number().optional().describe("Max results (default: 30)"),
  },
  async ({ org_id, status, overdue_only, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("commitments")
      .select(
        "id, description, owner_id, due_date, linked_entity_id, linked_entity_type, status, created_in, created_at, updated_at"
      )
      .eq("organization_id", org_id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit ?? 30);

    if (overdue_only) {
      const today = new Date().toISOString().split("T")[0];
      query = query.eq("status", "pending").lt("due_date", today);
    } else if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── list_pulses ─────────────────────────────────────────────────────
server.tool(
  "list_pulses",
  "List pulse check-ins for an organization, optionally filtered by date or user",
  {
    org_id: z.string().describe("Organization UUID"),
    since: z.string().optional().describe("ISO date — only pulses on or after this date"),
    user_id: z.string().optional().describe("Filter by user UUID"),
    limit: z.number().optional().describe("Max results (default: 30)"),
  },
  async ({ org_id, since, user_id, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("pulses")
      .select("id, user_id, date, items, venture_id, created_at")
      .eq("organization_id", org_id)
      .order("date", { ascending: false })
      .limit(limit ?? 30);

    if (since) query = query.gte("date", since);
    if (user_id) query = query.eq("user_id", user_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── get_pulse_summary ───────────────────────────────────────────────
server.tool(
  "get_pulse_summary",
  "Aggregate pulse data over a date range — total pulses, unique contributors, items by type, top shipped, and recurring blocker themes",
  {
    org_id: z.string().describe("Organization UUID"),
    since: z.string().describe("ISO date — start of range (inclusive)"),
    until: z.string().describe("ISO date — end of range (inclusive)"),
  },
  async ({ org_id, since, until }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("pulses")
      .select("id, user_id, date, items")
      .eq("organization_id", org_id)
      .gte("date", since)
      .lte("date", until);

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }

    const pulses = data ?? [];
    const uniqueUsers = new Set(pulses.map((p) => p.user_id));

    const itemsByType: Record<string, number> = { shipped: 0, blocker: 0, signal: 0 };
    const shippedTexts: string[] = [];
    const blockerTexts: string[] = [];

    for (const pulse of pulses) {
      const items = (pulse.items as Array<{ type: string; text: string }>) ?? [];
      for (const item of items) {
        if (item.type in itemsByType) {
          itemsByType[item.type]++;
        }
        if (item.type === "shipped") shippedTexts.push(item.text);
        if (item.type === "blocker") blockerTexts.push(item.text);
      }
    }

    const summary = {
      total_pulses: pulses.length,
      unique_contributors: uniqueUsers.size,
      items_by_type: itemsByType,
      top_shipped: shippedTexts.slice(0, 10),
      recurring_blocker_themes: blockerTexts.slice(0, 10),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
  }
);

// ── get_operating_health ────────────────────────────────────────────
server.tool(
  "get_operating_health",
  "Get the latest operating health snapshot for a venture",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().describe("Venture UUID"),
  },
  async ({ org_id, venture_id }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("operating_health_snapshots")
      .select("id, composite_score, composite_status, metrics, ai_interpretation, created_at")
      .eq("organization_id", org_id)
      .eq("venture_id", venture_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data?.[0] ?? null, null, 2) }] };
  }
);

// ── list_meeting_logs ───────────────────────────────────────────────
server.tool(
  "list_meeting_logs",
  "List meeting logs for an organization, optionally filtered by venture",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().optional().describe("Filter by venture UUID"),
    limit: z.number().optional().describe("Max results (default: 10)"),
  },
  async ({ org_id, venture_id, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("meeting_logs")
      .select(
        "id, meeting_type, started_at, completed_at, duration_seconds, output, facilitator_id, created_at"
      )
      .eq("organization_id", org_id)
      .order("started_at", { ascending: false })
      .limit(limit ?? 10);

    if (venture_id) query = query.eq("venture_id", venture_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Start server ─────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("truenorth-operations MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
