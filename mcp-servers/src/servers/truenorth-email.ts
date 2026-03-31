import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "truenorth-email",
  version: "0.1.0",
});

// ── Kit API helpers ────────────────────────────────────────────────

function getKitConfig() {
  const apiKey = process.env.CONVERTKIT_API_KEY;
  if (!apiKey) throw new Error("Missing CONVERTKIT_API_KEY env var");
  return { apiKey };
}

async function kitGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { apiKey } = getKitConfig();
  const url = new URL(`https://api.kit.com/v4${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { "X-Kit-Api-Key": apiKey, "Accept": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kit API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ── Tools ──────────────────────────────────────────────────────────

server.tool(
  "get_subscriber_overview",
  "Get high-level subscriber stats: total, active, cancelled, recent growth",
  {},
  async () => {
    try {
      const [total, active, cancelled, new7d, new30d] = await Promise.all([
        kitGet<{ pagination: { total_count: number } }>("/subscribers", { per_page: "1" }),
        kitGet<{ pagination: { total_count: number } }>("/subscribers", { per_page: "1", status: "active" }),
        kitGet<{ pagination: { total_count: number } }>("/subscribers", { per_page: "1", status: "cancelled" }),
        kitGet<{ pagination: { total_count: number } }>("/subscribers", { per_page: "1", created_after: daysAgoISO(7) }),
        kitGet<{ pagination: { total_count: number } }>("/subscribers", { per_page: "1", created_after: daysAgoISO(30) }),
      ]);

      const totalCount = total.pagination.total_count;
      const new7 = new7d.pagination.total_count;
      const new30 = new30d.pagination.total_count;
      const growthRate7d = totalCount === 0 ? 0 : Math.round((new7 / totalCount) * 10000) / 100;

      const data = {
        total_subscribers: totalCount,
        active: active.pagination.total_count,
        cancelled: cancelled.pagination.total_count,
        new_last_7d: new7,
        new_last_30d: new30,
        growth_rate_7d_pct: growthRate7d,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "list_subscribers_by_segment",
  "List subscribers filtered by tag, status, with pagination",
  {
    tag_id: z.string().optional().describe("Filter by tag ID"),
    status: z.enum(["active", "cancelled", "bounced"]).optional().describe("Filter by subscription status"),
    page: z.number().optional().describe("Page number"),
    per_page: z.number().optional().default(50).describe("Results per page (default 50)"),
  },
  async ({ tag_id, status, page, per_page }) => {
    try {
      const params: Record<string, string> = {};
      if (tag_id) params.tag_id = tag_id;
      if (status) params.status = status;
      if (page) params.page = String(page);
      params.per_page = String(per_page ?? 50);

      const data = await kitGet<{
        subscribers: Array<Record<string, unknown>>;
        pagination: Record<string, unknown>;
      }>("/subscribers", params);

      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_sequence_performance",
  "Get sequence stats. If no sequence_id, lists all sequences; otherwise returns detail for one.",
  {
    sequence_id: z.string().optional().describe("Specific sequence ID to get details for"),
  },
  async ({ sequence_id }) => {
    try {
      if (sequence_id) {
        const data = await kitGet<Record<string, unknown>>(`/sequences/${sequence_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }

      const data = await kitGet<{ sequences: Array<Record<string, unknown>> }>("/sequences");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "list_broadcasts",
  "List completed broadcasts with open/click/unsubscribe rates",
  {
    limit: z.number().optional().default(10).describe("Number of broadcasts to return (default 10)"),
  },
  async ({ limit }) => {
    try {
      const data = await kitGet<{
        broadcasts: Array<{
          id: number;
          subject: string;
          sent_at: string;
          stats: {
            recipients: number;
            open_rate: number;
            click_rate: number;
            unsubscribe_rate: number;
            open_tracking_disabled: boolean;
          };
          status: string;
        }>;
      }>("/broadcasts/stats");

      const completed = data.broadcasts
        .filter((b) => b.status === "completed" && !b.stats?.open_tracking_disabled)
        .slice(0, limit ?? 10)
        .map((b) => ({
          id: b.id,
          subject: b.subject,
          sent_at: b.sent_at,
          recipients: b.stats?.recipients,
          open_rate: b.stats?.open_rate,
          click_rate: b.stats?.click_rate,
          unsubscribe_rate: b.stats?.unsubscribe_rate,
        }));

      return { content: [{ type: "text" as const, text: JSON.stringify(completed, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_form_performance",
  "List all forms with subscriber counts",
  {},
  async () => {
    try {
      const data = await kitGet<{
        forms: Array<{
          id: number;
          name: string;
          type: string;
          total_subscribers: number;
          created_at: string;
        }>;
      }>("/forms");

      const forms = data.forms.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        subscriber_count: f.total_subscribers,
        created_at: f.created_at,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(forms, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_tag_health",
  "List all tags sorted by subscriber count descending",
  {},
  async () => {
    try {
      const data = await kitGet<{
        tags: Array<{
          id: number;
          name: string;
          total_subscriptions: number;
        }>;
      }>("/tags");

      const tags = data.tags
        .map((t) => ({
          id: t.id,
          name: t.name,
          subscriber_count: t.total_subscriptions,
        }))
        .sort((a, b) => b.subscriber_count - a.subscriber_count);

      return { content: [{ type: "text" as const, text: JSON.stringify(tags, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_subscriber_growth",
  "Get subscriber growth over a period, broken into weekly buckets",
  {
    days: z.number().optional().default(30).describe("Number of days to look back (default 30)"),
  },
  async ({ days }) => {
    try {
      const periodDays = days ?? 30;
      const periodStart = daysAgoISO(periodDays);

      // Get total new subscribers in the period
      const totalNew = await kitGet<{ pagination: { total_count: number } }>("/subscribers", {
        per_page: "1",
        created_after: periodStart,
      });

      // Break into weekly buckets
      const buckets: Array<{ start_date: string; end_date: string; new_subscribers: number }> = [];
      const numWeeks = Math.ceil(periodDays / 7);

      const bucketPromises = [];
      for (let i = 0; i < numWeeks; i++) {
        const bucketEnd = new Date();
        bucketEnd.setDate(bucketEnd.getDate() - i * 7);
        const bucketStart = new Date(bucketEnd);
        bucketStart.setDate(bucketStart.getDate() - 7);

        // Clamp bucket start to period start
        const clampedStart = new Date(Math.max(bucketStart.getTime(), new Date(periodStart).getTime()));

        bucketPromises.push(
          kitGet<{ pagination: { total_count: number } }>("/subscribers", {
            per_page: "1",
            created_after: clampedStart.toISOString(),
            created_before: bucketEnd.toISOString(),
          }).then((res) => ({
            start_date: clampedStart.toISOString().split("T")[0],
            end_date: bucketEnd.toISOString().split("T")[0],
            new_subscribers: res.pagination.total_count,
          }))
        );
      }

      const resolvedBuckets = await Promise.all(bucketPromises);
      // Sort buckets chronologically
      resolvedBuckets.sort((a, b) => a.start_date.localeCompare(b.start_date));

      const result = {
        period_days: periodDays,
        total_new: totalNew.pagination.total_count,
        buckets: resolvedBuckets,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// ── Start server ─────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("truenorth-email MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
