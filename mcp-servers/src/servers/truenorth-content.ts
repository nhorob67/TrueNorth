import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSupabase } from "../shared/supabase.js";

const server = new McpServer({
  name: "truenorth-content",
  version: "0.1.0",
});

// ── list_content_pieces ─────────────────────────────────────────────
server.tool(
  "list_content_pieces",
  "List content pieces for an organization, optionally filtered by venture, or lifecycle status",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().optional().describe("Filter by venture UUID"),
    lifecycle_status: z
      .enum(["ideation", "drafting", "review", "scheduled", "published"])
      .optional()
      .describe("Filter by lifecycle status"),
    limit: z.number().optional().describe("Max results (default: 30)"),
  },
  async ({ org_id, venture_id, lifecycle_status, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("content_pieces")
      .select(
        "id, title, machine_type, lifecycle_status, owner_id, scheduled_at, linked_funnel_id, created_at, updated_at"
      )
      .eq("organization_id", org_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 30);

    if (venture_id) query = query.eq("venture_id", venture_id);
    if (lifecycle_status) query = query.eq("lifecycle_status", lifecycle_status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── get_content_piece ───────────────────────────────────────────────
server.tool(
  "get_content_piece",
  "Get a single content piece by ID, including the full body_json",
  {
    content_id: z.string().describe("Content piece UUID"),
  },
  async ({ content_id }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("content_pieces")
      .select("*")
      .eq("id", content_id)
      .single();

    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── list_funnels ────────────────────────────────────────────────────
server.tool(
  "list_funnels",
  "List funnels for an organization, optionally filtered by venture or health status",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().optional().describe("Filter by venture UUID"),
    health_status: z
      .enum(["healthy", "underperforming", "stalled", "orphaned"])
      .optional()
      .describe("Filter by health status"),
    limit: z.number().optional().describe("Max results (default: 20)"),
  },
  async ({ org_id, venture_id, health_status, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("funnels")
      .select(
        "id, name, entry_point, capture_mechanism, nurture_sequence, conversion_event, scoreboard_tie, owner_id, lifecycle_status, health_status, last_result_at, linked_idea_id, created_at, updated_at"
      )
      .eq("organization_id", org_id)
      .eq("lifecycle_status", "active")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (venture_id) query = query.eq("venture_id", venture_id);
    if (health_status) query = query.eq("health_status", health_status);

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
  console.error("truenorth-content MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
