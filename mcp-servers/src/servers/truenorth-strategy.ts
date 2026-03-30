import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSupabase } from "../shared/supabase.js";

const server = new McpServer({
  name: "truenorth-strategy",
  version: "0.1.0",
});

// ── get_vision ───────────────────────────────────────────────────────
server.tool(
  "get_vision",
  "Get the venture's vision: BHAG, strategic filters, annual outcomes, and not-doing list",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().describe("Venture UUID"),
    year: z.number().optional().describe("Vision year (default: current year)"),
  },
  async ({ org_id, venture_id, year }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("visions")
      .select("*")
      .eq("organization_id", org_id)
      .eq("venture_id", venture_id)
      .order("year", { ascending: false })
      .limit(1);

    if (year) query = query.eq("year", year);

    const { data, error } = await query.single();
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── list_bets ────────────────────────────────────────────────────────
server.tool(
  "list_bets",
  "List bets for an organization, optionally filtered by venture or lifecycle status",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().optional().describe("Filter by venture UUID"),
    lifecycle_status: z
      .enum(["active", "paused", "completed", "killed"])
      .optional()
      .describe("Filter by lifecycle status (default: active)"),
    limit: z.number().optional().describe("Max results (default: 20)"),
  },
  async ({ org_id, venture_id, lifecycle_status, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("bets")
      .select("id, outcome, mechanism, health_status, lifecycle_status, quarter, created_at, updated_at")
      .eq("organization_id", org_id)
      .eq("lifecycle_status", lifecycle_status ?? "active")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (venture_id) query = query.eq("venture_id", venture_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── get_bet_context ──────────────────────────────────────────────────
// Mirrors gatherBetContext() from lib/ai/kill-switch.ts
server.tool(
  "get_bet_context",
  "Get enriched context for a single bet: linked KPIs, move velocity, blocker density, rhythm compliance. Essential for kill-switch assessments.",
  {
    org_id: z.string().describe("Organization UUID"),
    bet_id: z.string().describe("Bet UUID"),
  },
  async ({ org_id, bet_id }) => {
    const supabase = getSupabase();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch bet
    const { data: bet, error: betErr } = await supabase
      .from("bets")
      .select("id, outcome, mechanism, health_status, lifecycle_status, quarter, kill_criteria, proof_by_week6, created_at")
      .eq("id", bet_id)
      .eq("organization_id", org_id)
      .single();

    if (betErr) {
      return { content: [{ type: "text" as const, text: `Error: ${betErr.message}` }], isError: true };
    }

    // Parallel fetch: moves, blockers, KPI links
    const [{ data: moves }, { data: blockers }, { data: kpiLinks }] = await Promise.all([
      supabase
        .from("moves")
        .select("id, type, title, lifecycle_status, health_status, due_date, updated_at")
        .eq("bet_id", bet_id)
        .eq("organization_id", org_id),
      supabase
        .from("blockers")
        .select("id, description, severity, linked_entity_id, resolution_state")
        .eq("organization_id", org_id)
        .eq("resolution_state", "open")
        .eq("linked_entity_type", "move"),
      supabase
        .from("bet_indicator_links")
        .select("kpi_id")
        .eq("bet_id", bet_id),
    ]);

    // Fetch linked KPIs
    const kpiIds = (kpiLinks ?? []).map((l) => l.kpi_id);
    const { data: kpis } = kpiIds.length > 0
      ? await supabase
          .from("kpis")
          .select("id, name, health_status, current_value, target, unit")
          .in("id", kpiIds)
      : { data: [] };

    const allMoves = moves ?? [];
    const allBlockers = blockers ?? [];
    const moveIds = new Set(allMoves.map((m) => m.id));

    // Moves with active blockers
    const moveBlockerIds = new Set(
      allBlockers.filter((b) => b.linked_entity_id && moveIds.has(b.linked_entity_id)).map((b) => b.linked_entity_id)
    );

    // Milestones
    const milestones = allMoves.filter((m) => m.type === "milestone");
    const completedMilestones = milestones.filter((m) => m.lifecycle_status === "shipped");
    const recentShipped = milestones.filter(
      (m) => m.lifecycle_status === "shipped" && m.updated_at && m.updated_at >= fourteenDaysAgo
    );

    // Recurring moves
    const recurring = allMoves.filter((m) => m.type === "recurring");
    const recurringCompleted = recurring.filter((m) => m.lifecycle_status === "shipped");
    const rhythmRate = recurring.length > 0
      ? Math.round((recurringCompleted.length / recurring.length) * 100)
      : null;

    // Blocker density
    const blockerDensity = allMoves.length > 0
      ? Math.round((moveBlockerIds.size / allMoves.length) * 100)
      : 0;

    // KPI trend vs move execution
    const linkedKpis = kpis ?? [];
    const redKpis = linkedKpis.filter((k) => k.health_status === "red").length;
    const greenKpis = linkedKpis.filter((k) => k.health_status === "green").length;
    const movesExecuting = recentShipped.length > 0;

    let kpiTrendVsMoveExecution: "aligned" | "diverging" | "insufficient_data" = "insufficient_data";
    if (linkedKpis.length > 0 && allMoves.length > 0) {
      if (redKpis > greenKpis && movesExecuting) {
        kpiTrendVsMoveExecution = "diverging";
      } else if (greenKpis >= redKpis) {
        kpiTrendVsMoveExecution = "aligned";
      } else {
        kpiTrendVsMoveExecution = "diverging";
      }
    }

    // Bet age in days
    const ageDays = Math.floor((Date.now() - new Date(bet.created_at).getTime()) / (1000 * 60 * 60 * 24));

    const context = {
      bet: {
        ...bet,
        age_days: ageDays,
      },
      linked_kpis: linkedKpis,
      kpi_summary: {
        total: linkedKpis.length,
        green: greenKpis,
        yellow: linkedKpis.length - greenKpis - redKpis,
        red: redKpis,
      },
      moves: {
        total: allMoves.length,
        milestones: milestones.length,
        milestones_completed: completedMilestones.length,
        recurring: recurring.length,
        recurring_completed: recurringCompleted.length,
        shipped_last_14d: recentShipped.length,
        items: allMoves,
      },
      blockers: {
        active_on_moves: moveBlockerIds.size,
        density_pct: blockerDensity,
        items: allBlockers.filter((b) => b.linked_entity_id && moveIds.has(b.linked_entity_id)),
      },
      signals: {
        move_velocity_14d: { shipped: recentShipped.length, total: milestones.length },
        rhythm_compliance: { completed: recurringCompleted.length, total: recurring.length, rate_pct: rhythmRate },
        blocker_density_pct: blockerDensity,
        kpi_trend_vs_execution: kpiTrendVsMoveExecution,
      },
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(context, null, 2) }] };
  }
);

// ── list_moves ───────────────────────────────────────────────────────
server.tool(
  "list_moves",
  "List moves, optionally filtered by venture, bet, type, or lifecycle status",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().optional().describe("Filter by venture UUID"),
    bet_id: z.string().optional().describe("Filter by bet UUID"),
    type: z.enum(["milestone", "recurring"]).optional().describe("Filter by move type"),
    lifecycle_status: z
      .enum(["not_started", "in_progress", "shipped", "cut"])
      .optional()
      .describe("Filter by lifecycle status"),
    limit: z.number().optional().describe("Max results (default: 50)"),
  },
  async ({ org_id, venture_id, bet_id, type, lifecycle_status, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("moves")
      .select("id, bet_id, type, title, description, lifecycle_status, health_status, due_date, cadence, position, created_at, updated_at")
      .eq("organization_id", org_id)
      .order("position", { ascending: true })
      .limit(limit ?? 50);

    if (venture_id) query = query.eq("venture_id", venture_id);
    if (bet_id) query = query.eq("bet_id", bet_id);
    if (type) query = query.eq("type", type);
    if (lifecycle_status) query = query.eq("lifecycle_status", lifecycle_status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ── list_blockers ────────────────────────────────────────────────────
server.tool(
  "list_blockers",
  "List blockers, optionally filtered by resolution state or severity",
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
      .select("id, description, severity, linked_entity_id, linked_entity_type, resolution_state, created_at, updated_at")
      .eq("organization_id", org_id)
      .eq("resolution_state", resolution_state ?? "open")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);

    if (severity) query = query.eq("severity", severity);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }

    // Compute age_days for each blocker
    const enriched = (data ?? []).map((b) => ({
      ...b,
      age_days: Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
  }
);

// ── list_ideas ───────────────────────────────────────────────────────
server.tool(
  "list_ideas",
  "List ideas with their filter results, optionally filtered by venture or lifecycle status",
  {
    org_id: z.string().describe("Organization UUID"),
    venture_id: z.string().optional().describe("Filter by venture UUID"),
    lifecycle_status: z
      .string()
      .optional()
      .describe("Filter by lifecycle status (e.g. cooling, filtered, promoted, archived)"),
    limit: z.number().optional().describe("Max results (default: 30)"),
  },
  async ({ org_id, venture_id, lifecycle_status, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("ideas")
      .select("id, name, description, classification, lifecycle_status, filter_results, score_alignment, score_revenue, score_effort, score_total, cooling_expires_at, created_at")
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

// ── Start server ─────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("truenorth-strategy MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
