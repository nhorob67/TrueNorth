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
  | "dau";

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

export async function fetchDiscourseMetric(config: DiscourseConfig): Promise<number> {
  const { metric } = config;

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
