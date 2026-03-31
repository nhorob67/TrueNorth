import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "truenorth-community",
  version: "0.1.0",
});

// ── Discourse API helpers ───────────────────────────────────────────

function getDiscourseConfig() {
  const baseUrl = process.env.DISCOURSE_URL;
  const apiKey = process.env.DISCOURSE_API_KEY;
  const apiUsername = process.env.DISCOURSE_API_USERNAME ?? "system";

  if (!baseUrl || !apiKey) {
    throw new Error("Missing DISCOURSE_URL or DISCOURSE_API_KEY env vars");
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, apiUsername };
}

async function discourseGet<T>(path: string): Promise<T> {
  const config = getDiscourseConfig();
  const res = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      "Api-Key": config.apiKey,
      "Api-Username": config.apiUsername,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discourse API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Run SQL via Discourse Data Explorer plugin (create → execute → cleanup).
 */
async function runDataExplorerSQL<T>(sql: string): Promise<T> {
  const config = getDiscourseConfig();
  const headers = {
    "Api-Key": config.apiKey,
    "Api-Username": config.apiUsername,
    "Content-Type": "application/json",
  };

  // Create temporary query
  const createRes = await fetch(
    `${config.baseUrl}/admin/plugins/discourse-data-explorer/queries`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: {
          name: `TrueNorth MCP temp ${Date.now()}`,
          description: "Auto-created by truenorth-community MCP — safe to delete",
          sql,
        },
      }),
    }
  );

  if (!createRes.ok) {
    const body = await createRes.text().catch(() => "");
    throw new Error(`Data Explorer create error ${createRes.status}: ${body.slice(0, 200)}`);
  }

  const created = (await createRes.json()) as { query: { id: number } };
  const queryId = created.query.id;

  try {
    const runRes = await fetch(
      `${config.baseUrl}/admin/plugins/discourse-data-explorer/queries/${queryId}/run`,
      { method: "POST", headers }
    );

    if (!runRes.ok) {
      const body = await runRes.text().catch(() => "");
      throw new Error(`Data Explorer run error ${runRes.status}: ${body.slice(0, 200)}`);
    }

    return (await runRes.json()) as T;
  } finally {
    fetch(
      `${config.baseUrl}/admin/plugins/discourse-data-explorer/queries/${queryId}`,
      { method: "DELETE", headers }
    ).catch(() => {});
  }
}

// ── get_community_health ────────────────────────────────────────────
server.tool(
  "get_community_health",
  "Get aggregate community health metrics: member counts, activity levels, engagement rates, and trends",
  {},
  async () => {
    const about = await discourseGet<{
      about: {
        stats: {
          users_count: number;
          active_users_7_days: number;
          active_users_30_days: number;
          topics_count: number;
          posts_count: number;
          topics_7_days: number;
          posts_7_days: number;
          likes_7_days: number;
        };
      };
    }>("/about.json");

    const stats = about.about.stats;
    const wauOverMau =
      stats.active_users_30_days === 0
        ? 0
        : Math.round((stats.active_users_7_days / stats.active_users_30_days) * 10000) / 100;

    // Fetch DAU from admin dashboard
    let dau = 0;
    try {
      const dashboard = await discourseGet<{
        global_reports: Array<{ type: string; data: Array<{ x: string; y: number }> }>;
      }>("/admin/dashboard.json");
      const dauReport = dashboard.global_reports?.find(
        (r) => r.type === "daily_engaged_users"
      );
      if (dauReport && dauReport.data.length > 0) {
        dau = dauReport.data[dauReport.data.length - 1].y;
      }
    } catch {
      // DAU requires admin — continue without it
    }

    const health = {
      total_members: stats.users_count,
      active_7_days: stats.active_users_7_days,
      active_30_days: stats.active_users_30_days,
      wau_over_mau_pct: wauOverMau,
      daily_active_users: dau,
      topics_7_days: stats.topics_7_days,
      posts_7_days: stats.posts_7_days,
      likes_7_days: stats.likes_7_days,
      total_topics: stats.topics_count,
      total_posts: stats.posts_count,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(health, null, 2) }] };
  }
);

// ── list_at_risk_members ────────────────────────────────────────────
server.tool(
  "list_at_risk_members",
  "Find members with declining activity — those who were active in prior weeks but have gone quiet recently. Useful for churn prevention outreach.",
  {
    active_before_days: z
      .number()
      .optional()
      .describe("Were active within this many days ago (default: 30)"),
    inactive_since_days: z
      .number()
      .optional()
      .describe("Have not posted/visited since this many days ago (default: 14)"),
    limit: z.number().optional().describe("Max results (default: 25)"),
  },
  async ({ active_before_days, inactive_since_days, limit }) => {
    const activeBefore = active_before_days ?? 30;
    const inactiveSince = inactive_since_days ?? 14;
    const maxResults = limit ?? 25;

    const sql = `
      SELECT
        u.id,
        u.username,
        u.name,
        u.created_at,
        u.last_seen_at,
        u.last_posted_at,
        us.topics_entered,
        us.posts_read_count,
        us.likes_given,
        us.likes_received,
        us.topic_count,
        us.post_count,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - u.last_seen_at)::int AS days_since_seen,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - u.last_posted_at)::int AS days_since_posted
      FROM users u
      JOIN user_stats us ON us.user_id = u.id
      WHERE u.active = true
        AND u.silenced_till IS NULL
        AND u.suspended_till IS NULL
        AND u.admin = false
        AND u.moderator = false
        AND u.last_seen_at IS NOT NULL
        AND u.last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '${activeBefore} days'
        AND (u.last_posted_at IS NULL OR u.last_posted_at < CURRENT_TIMESTAMP - INTERVAL '${inactiveSince} days')
        AND u.last_seen_at < CURRENT_TIMESTAMP - INTERVAL '${inactiveSince} days'
      ORDER BY u.last_seen_at DESC
      LIMIT ${maxResults}
    `;

    const result = await runDataExplorerSQL<{
      columns: string[];
      rows: unknown[][];
    }>(sql);

    const columns = result.columns ?? [];
    const members = (result.rows ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    return { content: [{ type: "text" as const, text: JSON.stringify(members, null, 2) }] };
  }
);

// ── list_churn_events ───────────────────────────────────────────────
server.tool(
  "list_churn_events",
  "List members who were recently active but have not visited in a long time — likely churned. Shows their last activity for pattern detection.",
  {
    min_days_absent: z
      .number()
      .optional()
      .describe("Minimum days since last seen to count as churned (default: 30)"),
    had_activity_before_days: z
      .number()
      .optional()
      .describe("Were active within this many days before going silent (default: 90)"),
    limit: z.number().optional().describe("Max results (default: 25)"),
  },
  async ({ min_days_absent, had_activity_before_days, limit }) => {
    const absentDays = min_days_absent ?? 30;
    const activeBefore = had_activity_before_days ?? 90;
    const maxResults = limit ?? 25;

    const sql = `
      SELECT
        u.id,
        u.username,
        u.name,
        u.created_at,
        u.last_seen_at,
        u.last_posted_at,
        us.post_count,
        us.topic_count,
        us.likes_given,
        us.days_visited,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - u.last_seen_at)::int AS days_since_seen
      FROM users u
      JOIN user_stats us ON us.user_id = u.id
      WHERE u.active = true
        AND u.admin = false
        AND u.moderator = false
        AND u.last_seen_at IS NOT NULL
        AND u.last_seen_at < CURRENT_TIMESTAMP - INTERVAL '${absentDays} days'
        AND u.last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '${activeBefore} days'
        AND us.post_count > 0
      ORDER BY u.last_seen_at DESC
      LIMIT ${maxResults}
    `;

    const result = await runDataExplorerSQL<{
      columns: string[];
      rows: unknown[][];
    }>(sql);

    const columns = result.columns ?? [];
    const members = (result.rows ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    return { content: [{ type: "text" as const, text: JSON.stringify(members, null, 2) }] };
  }
);

// ── get_member_activity ─────────────────────────────────────────────
server.tool(
  "get_member_activity",
  "Get detailed activity metrics for a specific member by username",
  {
    username: z.string().describe("Discourse username"),
  },
  async ({ username }) => {
    // Fetch user summary (public endpoint)
    const summary = await discourseGet<{
      user_summary: {
        likes_given: number;
        likes_received: number;
        topics_entered: number;
        posts_read_count: number;
        days_visited: number;
        topic_count: number;
        post_count: number;
        time_read: number;
      };
    }>(`/u/${encodeURIComponent(username)}/summary.json`);

    // Fetch user profile for dates
    const profile = await discourseGet<{
      user: {
        id: number;
        username: string;
        name: string;
        created_at: string;
        last_seen_at: string;
        last_posted_at: string;
        trust_level: number;
        badge_count: number;
        title: string | null;
        groups: Array<{ id: number; name: string }>;
      };
    }>(`/u/${encodeURIComponent(username)}.json`);

    const u = profile.user;
    const s = summary.user_summary;

    const activity = {
      id: u.id,
      username: u.username,
      name: u.name,
      created_at: u.created_at,
      last_seen_at: u.last_seen_at,
      last_posted_at: u.last_posted_at,
      trust_level: u.trust_level,
      badge_count: u.badge_count,
      title: u.title,
      groups: u.groups?.map((g) => g.name) ?? [],
      stats: {
        topics_entered: s.topics_entered,
        posts_read_count: s.posts_read_count,
        days_visited: s.days_visited,
        topic_count: s.topic_count,
        post_count: s.post_count,
        likes_given: s.likes_given,
        likes_received: s.likes_received,
        time_read_minutes: Math.round(s.time_read / 60),
      },
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(activity, null, 2) }] };
  }
);

// ── get_engagement_report ───────────────────────────────────────────
server.tool(
  "get_engagement_report",
  "Get a weekly engagement breakdown: new members, top contributors, posts with high reply counts, and content gaps (unanswered topics)",
  {
    days: z.number().optional().describe("Lookback period in days (default: 7)"),
  },
  async ({ days }) => {
    const lookback = days ?? 7;

    // Top contributors by post count
    const topContribSql = `
      SELECT
        u.username,
        u.name,
        COUNT(p.id) AS posts,
        COUNT(DISTINCT p.topic_id) AS topics_participated,
        SUM(p.like_count) AS likes_received
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.created_at >= CURRENT_TIMESTAMP - INTERVAL '${lookback} days'
        AND p.deleted_at IS NULL
        AND u.admin = false
        AND u.moderator = false
      GROUP BY u.username, u.name
      ORDER BY posts DESC
      LIMIT 10
    `;

    // Unanswered topics (no replies)
    const unansweredSql = `
      SELECT
        t.id AS topic_id,
        t.title,
        t.created_at,
        u.username AS author,
        t.views AS view_count
      FROM topics t
      JOIN users u ON u.id = t.user_id
      WHERE t.archetype = 'regular'
        AND t.deleted_at IS NULL
        AND t.posts_count = 1
        AND t.created_at >= CURRENT_TIMESTAMP - INTERVAL '${lookback} days'
      ORDER BY t.created_at DESC
      LIMIT 10
    `;

    // New members
    const newMembersSql = `
      SELECT
        u.username,
        u.name,
        u.created_at,
        us.post_count,
        us.topics_entered
      FROM users u
      JOIN user_stats us ON us.user_id = u.id
      WHERE u.created_at >= CURRENT_TIMESTAMP - INTERVAL '${lookback} days'
        AND u.active = true
        AND u.admin = false
      ORDER BY u.created_at DESC
      LIMIT 20
    `;

    // Hot topics (most replies)
    const hotTopicsSql = `
      SELECT
        t.id AS topic_id,
        t.title,
        t.posts_count - 1 AS reply_count,
        t.like_count,
        t.views,
        u.username AS author,
        t.created_at
      FROM topics t
      JOIN users u ON u.id = t.user_id
      WHERE t.archetype = 'regular'
        AND t.deleted_at IS NULL
        AND t.created_at >= CURRENT_TIMESTAMP - INTERVAL '${lookback} days'
        AND t.posts_count > 1
      ORDER BY t.posts_count DESC
      LIMIT 10
    `;

    const [topContrib, unanswered, newMembers, hotTopics] = await Promise.all([
      runDataExplorerSQL<{ columns: string[]; rows: unknown[][] }>(topContribSql),
      runDataExplorerSQL<{ columns: string[]; rows: unknown[][] }>(unansweredSql),
      runDataExplorerSQL<{ columns: string[]; rows: unknown[][] }>(newMembersSql),
      runDataExplorerSQL<{ columns: string[]; rows: unknown[][] }>(hotTopicsSql),
    ]);

    const mapRows = (res: { columns: string[]; rows: unknown[][] }) =>
      (res.rows ?? []).map((row) => {
        const obj: Record<string, unknown> = {};
        (res.columns ?? []).forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });

    const report = {
      period_days: lookback,
      top_contributors: mapRows(topContrib),
      unanswered_topics: mapRows(unanswered),
      new_members: mapRows(newMembers),
      hot_topics: mapRows(hotTopics),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
  }
);

// ── get_cohort_metrics ──────────────────────────────────────────────
server.tool(
  "get_cohort_metrics",
  "Get member activity breakdown by trust level cohort — shows how members at each trust level engage differently",
  {},
  async () => {
    const sql = `
      SELECT
        u.trust_level,
        COUNT(*) AS member_count,
        ROUND(AVG(us.days_visited)) AS avg_days_visited,
        ROUND(AVG(us.post_count)) AS avg_posts,
        ROUND(AVG(us.topic_count)) AS avg_topics,
        ROUND(AVG(us.likes_given)) AS avg_likes_given,
        ROUND(AVG(us.likes_received)) AS avg_likes_received,
        COUNT(*) FILTER (WHERE u.last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') AS active_7d,
        COUNT(*) FILTER (WHERE u.last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS active_30d,
        COUNT(*) FILTER (WHERE u.last_seen_at < CURRENT_TIMESTAMP - INTERVAL '30 days') AS inactive_30d
      FROM users u
      JOIN user_stats us ON us.user_id = u.id
      WHERE u.active = true
        AND u.admin = false
        AND u.silenced_till IS NULL
        AND u.suspended_till IS NULL
      GROUP BY u.trust_level
      ORDER BY u.trust_level
    `;

    const result = await runDataExplorerSQL<{
      columns: string[];
      rows: unknown[][];
    }>(sql);

    const columns = result.columns ?? [];
    const cohorts = (result.rows ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    return { content: [{ type: "text" as const, text: JSON.stringify(cohorts, null, 2) }] };
  }
);

// ── get_new_member_activation ────────────────────────────────────────
server.tool(
  "get_new_member_activation",
  "Find new members and their activation status — highlights members who joined recently but haven't posted, for outreach within the critical first 7 days",
  {
    days: z.number().optional().describe("How far back to look for new members (default: 14)"),
    limit: z.number().optional().describe("Max results (default: 50)"),
  },
  async ({ days, limit }) => {
    const lookback = days ?? 14;
    const maxResults = limit ?? 50;

    const sql = `
      SELECT
        u.id,
        u.username,
        u.name,
        u.created_at,
        u.last_seen_at,
        us.topics_entered,
        us.post_count,
        us.time_read,
        CASE WHEN us.post_count > 0 THEN true ELSE false END AS has_posted,
        (SELECT MIN(p.created_at) FROM posts p WHERE p.user_id = u.id AND p.post_number > 0) AS first_post_date,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - u.created_at)::int AS days_since_joined,
        CASE
          WHEN us.post_count = 0 AND u.created_at <= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'needs_nudge'
          WHEN us.post_count = 0 AND u.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'watching'
          WHEN us.post_count > 0 THEN 'activated'
          ELSE 'unknown'
        END AS activation_status
      FROM users u
      JOIN user_stats us ON us.user_id = u.id
      WHERE u.created_at >= CURRENT_TIMESTAMP - INTERVAL '${lookback} days'
        AND u.active = true
        AND u.admin = false
        AND u.moderator = false
      ORDER BY u.created_at DESC
      LIMIT ${maxResults}
    `;

    const result = await runDataExplorerSQL<{
      columns: string[];
      rows: unknown[][];
    }>(sql);

    const columns = result.columns ?? [];
    const members = (result.rows ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    const summary = {
      total: members.length,
      activated: members.filter((m) => m.activation_status === "activated").length,
      watching: members.filter((m) => m.activation_status === "watching").length,
      needs_nudge: members.filter((m) => m.activation_status === "needs_nudge").length,
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ summary, members }, null, 2) },
      ],
    };
  }
);

// ── get_activation_funnel ───────────────────────────────────────────
server.tool(
  "get_activation_funnel",
  "Get the new member activation funnel: joined → viewed topics → first post → second post. Shows where new members drop off.",
  {
    days: z.number().optional().describe("Lookback period in days (default: 30)"),
  },
  async ({ days }) => {
    const lookback = days ?? 30;

    const sql = `
      SELECT
        COUNT(*) AS total_new_members,
        COUNT(*) FILTER (WHERE us.topics_entered > 0) AS viewed_topics,
        COUNT(*) FILTER (WHERE us.post_count > 0) AS made_first_post,
        COUNT(*) FILTER (WHERE us.post_count >= 2) AS made_second_post,
        COUNT(*) FILTER (WHERE us.post_count >= 5) AS made_five_posts,
        COUNT(*) FILTER (WHERE us.likes_given > 0) AS gave_a_like,
        ROUND(AVG(us.time_read) / 60) AS avg_time_read_minutes
      FROM users u
      JOIN user_stats us ON us.user_id = u.id
      WHERE u.created_at >= CURRENT_TIMESTAMP - INTERVAL '${lookback} days'
        AND u.active = true
        AND u.admin = false
        AND u.moderator = false
    `;

    const result = await runDataExplorerSQL<{
      columns: string[];
      rows: unknown[][];
    }>(sql);

    const columns = result.columns ?? [];
    const row = result.rows?.[0];
    if (!row) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ period_days: lookback, total_new_members: 0 }, null, 2) },
        ],
      };
    }

    const data: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      data[col] = row[i];
    });

    const total = (data.total_new_members as number) || 1;
    const funnel = {
      period_days: lookback,
      ...data,
      funnel_rates: {
        view_rate_pct: Math.round(((data.viewed_topics as number) / total) * 100),
        first_post_pct: Math.round(((data.made_first_post as number) / total) * 100),
        second_post_pct: Math.round(((data.made_second_post as number) / total) * 100),
        five_posts_pct: Math.round(((data.made_five_posts as number) / total) * 100),
        liked_pct: Math.round(((data.gave_a_like as number) / total) * 100),
      },
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(funnel, null, 2) }] };
  }
);

// ── Start server ─────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("truenorth-community MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
