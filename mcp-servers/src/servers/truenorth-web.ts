import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "truenorth-web",
  version: "0.1.0",
});

// ── Tavily Search API helpers ─────────────────────────────────────

function getTavilyConfig() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Missing TAVILY_API_KEY env var");
  return { apiKey };
}

async function tavilyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { apiKey } = getTavilyConfig();
  const res = await fetch(`https://api.tavily.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, ...body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ── Tools ──────────────────────────────────────────────────────────

server.tool(
  "web_search",
  "Search the web using Tavily Search API — returns relevant results with optional content extraction",
  {
    query: z.string().describe("Search query"),
    max_results: z.number().optional().describe("Number of results (default 10)"),
    search_depth: z
      .enum(["basic", "advanced"])
      .optional()
      .describe("Search depth: basic (fast) or advanced (thorough, default basic)"),
    include_answer: z
      .boolean()
      .optional()
      .describe("Include an AI-generated answer summary (default false)"),
    days: z
      .number()
      .optional()
      .describe("Only return results from the last N days"),
  },
  async ({ query, max_results, search_depth, include_answer, days }) => {
    try {
      const body: Record<string, unknown> = {
        query,
        max_results: max_results ?? 10,
        search_depth: search_depth ?? "basic",
        include_answer: include_answer ?? false,
      };
      if (days) body.days = days;

      const data = await tavilyPost<{
        answer?: string;
        results: Array<{
          title: string;
          url: string;
          content: string;
          score: number;
          published_date?: string;
        }>;
      }>("/search", body);

      const output: Record<string, unknown> = {
        results: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          published_date: r.published_date ?? null,
        })),
      };
      if (data.answer) output.answer = data.answer;

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "fetch_page_content",
  "Fetch and extract text content from a web page using Tavily Extract API",
  {
    urls: z.string().describe("URL to extract content from (or comma-separated URLs)"),
  },
  async ({ urls }) => {
    try {
      const urlList = urls.split(",").map((u) => u.trim()).filter(Boolean);

      const data = await tavilyPost<{
        results: Array<{
          url: string;
          raw_content: string;
        }>;
        failed_results?: Array<{
          url: string;
          error: string;
        }>;
      }>("/extract", { urls: urlList });

      const results = data.results.map((r) => ({
        url: r.url,
        content: r.raw_content,
        word_count: r.raw_content.split(/\s+/).filter(Boolean).length,
      }));

      const output: Record<string, unknown> = { results };
      if (data.failed_results?.length) {
        output.failed = data.failed_results;
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "search_news",
  "Search for recent news articles using Tavily Search API with news topic focus",
  {
    query: z.string().describe("News search query"),
    max_results: z.number().optional().describe("Number of results (default 10)"),
    days: z.number().optional().describe("Only return results from the last N days (default 7)"),
  },
  async ({ query, max_results, days }) => {
    try {
      const data = await tavilyPost<{
        results: Array<{
          title: string;
          url: string;
          content: string;
          score: number;
          published_date?: string;
        }>;
      }>("/search", {
        query,
        max_results: max_results ?? 10,
        topic: "news",
        days: days ?? 7,
        search_depth: "basic",
      });

      const results = data.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        published_date: r.published_date ?? null,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("truenorth-web MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
