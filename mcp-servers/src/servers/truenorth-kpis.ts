import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSupabase } from "../shared/supabase.js";

const server = new McpServer({
  name: "truenorth-kpis",
  version: "0.1.0",
});

// ── list_kpis ────────────────────────────────────────────────────────
server.tool(
  "list_kpis",
  "List KPIs for an organization, optionally filtered by venture, health status, or lifecycle status",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().optional().describe("Filter by venture UUID"),
    health_status: z
      .enum(["green", "yellow", "red"])
      .optional()
      .describe("Filter by health status"),
    lifecycle_status: z
      .enum(["active", "paused", "archived", "completed"])
      .optional()
      .describe("Filter by lifecycle status (default: active)"),
    limit: z.number().optional().describe("Max results (default: 50)"),
  },
  async ({ org_id, venture_id, health_status, lifecycle_status, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("kpis")
      .select(
        "id, name, description, unit, frequency, tier, directionality, owner_id, target, current_value, health_status, lifecycle_status, threshold_logic, action_playbook, formula_description, icon, created_at, updated_at"
      )
      .eq("organization_id", org_id)
      .eq("lifecycle_status", lifecycle_status ?? "active")
      .order("display_order", { ascending: true })
      .limit(limit ?? 50);

    if (venture_id) query = query.eq("venture_id", venture_id);
    if (health_status) query = query.eq("health_status", health_status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── get_kpi ──────────────────────────────────────────────────────────
server.tool(
  "get_kpi",
  "Get a single KPI with its thresholds, action playbook, and linked driver KPIs",
  {
    org_id: z.string().describe("Organization UUID"),
    kpi_id: z.string().describe("KPI UUID"),
  },
  async ({ org_id, kpi_id }) => {
    const supabase = getSupabase();

    const [{ data: kpi, error: kpiErr }, { data: drivers }] =
      await Promise.all([
        supabase
          .from("kpis")
          .select("*")
          .eq("id", kpi_id)
          .eq("organization_id", org_id)
          .single(),
        supabase
          .from("kpi_driver_links")
          .select("driver_kpi_id, kpis!kpi_driver_links_driver_kpi_id_fkey(id, name, health_status, current_value, target)")
          .eq("lead_kpi_id", kpi_id),
      ]);

    if (kpiErr) {
      return { content: [{ type: "text" as const, text: `Error: ${kpiErr.message}` }], isError: true };
    }

    const result = {
      ...kpi,
      drivers: (drivers ?? []).map((d: Record<string, unknown>) => d.kpis),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ── list_kpi_entries ─────────────────────────────────────────────────
server.tool(
  "list_kpi_entries",
  "List time-series entries for a KPI, ordered by most recent first",
  {
    kpi_id: z.string().describe("KPI UUID"),
    limit: z.number().optional().describe("Max results (default: 20)"),
    since: z
      .string()
      .optional()
      .describe("ISO date — only entries after this date"),
  },
  async ({ kpi_id, limit, since }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("kpi_entries")
      .select("id, value, recorded_at, source, created_at")
      .eq("kpi_id", kpi_id)
      .order("recorded_at", { ascending: false })
      .limit(limit ?? 20);

    if (since) query = query.gte("recorded_at", since);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── get_kpi_health_summary ───────────────────────────────────────────
server.tool(
  "get_kpi_health_summary",
  "Get an aggregated health summary: counts by status, plus the KPIs that changed health most recently",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z
      .string()
      .optional()
      .describe("Filter by venture UUID"),
  },
  async ({ org_id, venture_id }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, updated_at")
      .eq("organization_id", org_id)
      .eq("lifecycle_status", "active")
      .order("updated_at", { ascending: false });

    if (venture_id) query = query.eq("venture_id", venture_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }

    const kpis = data ?? [];
    const summary = {
      total: kpis.length,
      green: kpis.filter((k) => k.health_status === "green").length,
      yellow: kpis.filter((k) => k.health_status === "yellow").length,
      red: kpis.filter((k) => k.health_status === "red").length,
      recently_changed: kpis.slice(0, 5).map((k) => ({
        id: k.id,
        name: k.name,
        health_status: k.health_status,
        current_value: k.current_value,
        target: k.target,
        updated_at: k.updated_at,
      })),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
  }
);

// ── get_bet_kpi_context ──────────────────────────────────────────────
// Convenience tool for kill-switch: gets all KPIs linked to active bets
server.tool(
  "get_bet_kpi_context",
  "Get KPI health data for all active bets in a venture — used by kill-switch for bet assessments",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().describe("Venture UUID"),
  },
  async ({ org_id, venture_id }) => {
    const supabase = getSupabase();

    // Get active bets
    const { data: bets, error: betsErr } = await supabase
      .from("bets")
      .select("id, outcome, health_status, lifecycle_status, created_at")
      .eq("organization_id", org_id)
      .eq("venture_id", venture_id)
      .eq("lifecycle_status", "active");

    if (betsErr) {
      return { content: [{ type: "text" as const, text: `Error: ${betsErr.message}` }], isError: true };
    }
    if (!bets || bets.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ bets: [], message: "No active bets found" }) }] };
    }

    const betIds = bets.map((b) => b.id);

    // Get bet-to-KPI links
    const { data: links } = await supabase
      .from("bet_indicator_links")
      .select("bet_id, kpi_id")
      .in("bet_id", betIds);

    const kpiIds = [...new Set((links ?? []).map((l) => l.kpi_id))];

    // Get KPI details
    const { data: kpis } = kpiIds.length > 0
      ? await supabase
          .from("kpis")
          .select("id, name, health_status, current_value, target, unit, frequency, updated_at")
          .in("id", kpiIds)
      : { data: [] };

    const kpiMap = new Map((kpis ?? []).map((k) => [k.id, k]));

    // Build per-bet KPI context
    const result = bets.map((bet) => {
      const betLinks = (links ?? []).filter((l) => l.bet_id === bet.id);
      const linkedKpis = betLinks
        .map((l) => kpiMap.get(l.kpi_id))
        .filter(Boolean);

      const redCount = linkedKpis.filter((k) => k!.health_status === "red").length;
      const greenCount = linkedKpis.filter((k) => k!.health_status === "green").length;

      return {
        bet_id: bet.id,
        outcome: bet.outcome,
        bet_health: bet.health_status,
        created_at: bet.created_at,
        linked_kpis: linkedKpis,
        kpi_summary: {
          total: linkedKpis.length,
          green: greenCount,
          yellow: linkedKpis.length - greenCount - redCount,
          red: redCount,
        },
      };
    });

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Start server ─────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("truenorth-kpis MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
