/**
 * Discourse forum integration for KPI data syncing.
 * Fetches community engagement metrics from a Discourse instance.
 */

export type DiscourseMetric =
  | "user_count"
  | "wau_over_mau"
  | "active_users_7_days"
  | "active_users_30_days"
  | "topics_7_days"
  | "posts_7_days"
  | "likes_7_days"
  | "dau"
  | "posts_with_2_replies_24h"
  | "median_ttfr_hours";

interface DiscourseConfig {
  apiKey: string;
  apiUsername: string;
  baseUrl: string;
  metric: DiscourseMetric;
}

interface DiscourseAboutResponse {
  about: {
    stats: {
      user_count: number;
      active_users_7_days: number;
      active_users_30_days: number;
      topic_count: number;
      post_count: number;
      topics_7_days: number;
      posts_7_days: number;
      likes_7_days: number;
    };
  };
}

interface DiscourseDashboardResponse {
  global_reports: Array<{
    type: string;
    data: Array<{ x: string; y: number }>;
  }>;
}

async function discourseGet<T>(config: DiscourseConfig, path: string): Promise<T> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    headers: {
      "Api-Key": config.apiKey,
      "Api-Username": config.apiUsername,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discourse API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Runs a Data Explorer query via the Discourse API.
 * Requires the Data Explorer plugin to be installed (bundled with Discourse core).
 *
 * The query calculates: % of topics created in the last 7 days that received
 * ≥2 replies within 24 hours of creation.
 */
async function fetchPostsWith2Replies24h(config: DiscourseConfig): Promise<number> {
  const queryId = (config as DiscourseConfig & { dataExplorerQueryId?: number }).dataExplorerQueryId;

  if (queryId) {
    // Use a pre-created Data Explorer query
    const result = await discourseGet<{
      rows: Array<[number, number, number]>;
    }>(config, `/admin/plugins/explorer/queries/${queryId}/run.json`);

    if (result.rows && result.rows.length > 0) {
      // Expect row: [total_topics, topics_with_2_replies, percentage]
      return result.rows[0][2] ?? 0;
    }
    return 0;
  }

  // Fallback: run inline SQL via Data Explorer
  // This calculates the % of topics from the last 7 days with ≥2 replies within 24h
  const sql = `
    WITH recent_topics AS (
      SELECT t.id AS topic_id, t.created_at AS topic_created_at
      FROM topics t
      WHERE t.archetype = 'regular'
        AND t.deleted_at IS NULL
        AND t.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    ),
    reply_counts AS (
      SELECT
        rt.topic_id,
        COUNT(p.id) AS replies_within_24h
      FROM recent_topics rt
      LEFT JOIN posts p
        ON p.topic_id = rt.topic_id
        AND p.post_number > 1
        AND p.deleted_at IS NULL
        AND p.created_at <= rt.topic_created_at + INTERVAL '24 hours'
      GROUP BY rt.topic_id
    )
    SELECT
      COUNT(*) AS total_topics,
      COUNT(*) FILTER (WHERE replies_within_24h >= 2) AS topics_with_2_replies,
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(COUNT(*) FILTER (WHERE replies_within_24h >= 2) * 100.0 / COUNT(*), 1)
      END AS percentage
    FROM reply_counts
  `;

  const res = await fetch(
    `${config.baseUrl.replace(/\/+$/, "")}/admin/plugins/explorer/queries/-1/run.json`,
    {
      method: "POST",
      headers: {
        "Api-Key": config.apiKey,
        "Api-Username": config.apiUsername,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discourse Data Explorer error ${res.status}: ${body}`);
  }

  const result = (await res.json()) as { rows: Array<[number, number, number]> };
  if (result.rows && result.rows.length > 0) {
    return result.rows[0][2] ?? 0;
  }
  return 0;
}

/**
 * Median Time to First Reply (in hours) for topics created in the last 7 days.
 * Uses Data Explorer to run SQL against the Discourse database.
 * Excludes staff/system replies and deleted posts for accuracy.
 */
async function fetchMedianTtfrHours(config: DiscourseConfig): Promise<number> {
  const queryId = (config as DiscourseConfig & { dataExplorerQueryId?: number }).dataExplorerQueryId;

  if (queryId) {
    const result = await discourseGet<{
      rows: Array<[number]>;
    }>(config, `/admin/plugins/explorer/queries/${queryId}/run.json`);

    if (result.rows && result.rows.length > 0) {
      return result.rows[0][0] ?? 0;
    }
    return 0;
  }

  // Inline SQL: median hours from topic creation to first non-staff reply
  const sql = `
    WITH topic_first_reply AS (
      SELECT
        t.id AS topic_id,
        t.created_at AS topic_created_at,
        MIN(p.created_at) AS first_reply_at
      FROM topics t
      JOIN posts p
        ON p.topic_id = t.id
        AND p.post_number > 1
        AND p.deleted_at IS NULL
        AND p.user_id NOT IN (SELECT id FROM users WHERE admin = true OR moderator = true)
      WHERE t.archetype = 'regular'
        AND t.deleted_at IS NULL
        AND t.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY t.id, t.created_at
    )
    SELECT
      ROUND(
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (first_reply_at - topic_created_at)) / 3600.0
        )::numeric,
        1
      ) AS median_hours
    FROM topic_first_reply
  `;

  const res = await fetch(
    `${config.baseUrl.replace(/\/+$/, "")}/admin/plugins/explorer/queries/-1/run.json`,
    {
      method: "POST",
      headers: {
        "Api-Key": config.apiKey,
        "Api-Username": config.apiUsername,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discourse Data Explorer error ${res.status}: ${body}`);
  }

  const result = (await res.json()) as { rows: Array<[number]> };
  if (result.rows && result.rows.length > 0) {
    return result.rows[0][0] ?? 0;
  }
  return 0;
}

export async function fetchDiscourseMetric(config: DiscourseConfig): Promise<number> {
  const { metric } = config;

  if (metric === "median_ttfr_hours") {
    return fetchMedianTtfrHours(config);
  }

  if (metric === "posts_with_2_replies_24h") {
    return fetchPostsWith2Replies24h(config);
  }

  if (metric === "dau") {
    const data = await discourseGet<DiscourseDashboardResponse>(
      config,
      "/admin/dashboard.json"
    );
    const dauReport = data.global_reports?.find((r) => r.type === "daily_engaged_users");
    if (!dauReport || dauReport.data.length === 0) return 0;
    return dauReport.data[dauReport.data.length - 1].y;
  }

  const data = await discourseGet<DiscourseAboutResponse>(config, "/about.json");
  const stats = data.about.stats;

  switch (metric) {
    case "user_count":
      return stats.user_count;
    case "active_users_7_days":
      return stats.active_users_7_days;
    case "active_users_30_days":
      return stats.active_users_30_days;
    case "wau_over_mau":
      return stats.active_users_30_days === 0
        ? 0
        : Math.round((stats.active_users_7_days / stats.active_users_30_days) * 10000) / 100;
    case "topics_7_days":
      return stats.topics_7_days;
    case "posts_7_days":
      return stats.posts_7_days;
    case "likes_7_days":
      return stats.likes_7_days;
    default:
      throw new Error(`Unknown Discourse metric: ${metric}`);
  }
}
