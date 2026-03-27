/**
 * ConvertKit and Beehiiv email platform integrations for KPI data syncing.
 */

// ============================================================
// ConvertKit
// ============================================================

interface ConvertKitConfig {
  apiKey: string;
  metric: "subscriber_count" | "open_rate" | "click_rate";
}

interface ConvertKitSubscribersResponse {
  subscribers: unknown[];
  total_subscribers: number;
}

interface KitBroadcastStats {
  recipients: number;
  open_rate: number;
  click_rate: number;
  unsubscribe_rate: number;
  status: string;
  open_tracking_disabled: boolean;
  click_tracking_disabled: boolean;
}

interface KitBroadcastStatsEntry {
  id: number;
  stats: KitBroadcastStats;
}

interface KitBroadcastStatsResponse {
  broadcasts: KitBroadcastStatsEntry[];
  pagination: {
    has_previous_page: boolean;
    has_next_page: boolean;
    start_cursor: string;
    end_cursor: string;
    per_page: number;
  };
}

/**
 * Fetch broadcast stats from Kit v4 API.
 * Only includes completed broadcasts with open tracking enabled.
 */
async function fetchKitBroadcastStats(
  apiKey: string
): Promise<KitBroadcastStatsEntry[]> {
  const res = await fetch("https://api.kit.com/v4/broadcasts/stats", {
    headers: { "X-Kit-Api-Key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Kit API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as KitBroadcastStatsResponse;

  return data.broadcasts.filter(
    (b) =>
      b.stats.status === "completed" && !b.stats.open_tracking_disabled
  );
}

export async function fetchConvertKitMetric(config: ConvertKitConfig): Promise<number> {
  const { apiKey, metric } = config;

  if (metric === "subscriber_count") {
    const res = await fetch(
      `https://api.convertkit.com/v3/subscribers?api_secret=${apiKey}`
    );
    if (!res.ok) {
      throw new Error(`Kit API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as ConvertKitSubscribersResponse;
    return data.total_subscribers;
  }

  // Fetch broadcast-only stats from Kit v4 API (excludes sequences)
  const broadcasts = await fetchKitBroadcastStats(apiKey);
  if (broadcasts.length === 0) return 0;

  const recent = broadcasts.slice(0, 10);

  if (metric === "open_rate") {
    const total = recent.reduce((sum, b) => sum + b.stats.open_rate, 0);
    return total / recent.length;
  }

  // click_rate
  const total = recent.reduce((sum, b) => sum + b.stats.click_rate, 0);
  return total / recent.length;
}

// ============================================================
// Beehiiv
// ============================================================

interface BeehiivConfig {
  apiKey: string;
  publicationId: string;
  metric: "subscriber_count" | "open_rate" | "click_rate";
}

interface BeehiivSubscriptionsResponse {
  total_results: number;
}

interface BeehiivPost {
  id: string;
  stats?: {
    email_recipients: number;
    email_open_rate: number;
    email_click_rate: number;
  };
}

interface BeehiivPostsResponse {
  data: BeehiivPost[];
}

export async function fetchBeehiivMetric(config: BeehiivConfig): Promise<number> {
  const { apiKey, publicationId, metric } = config;
  const baseUrl = `https://api.beehiiv.com/v2/publications/${publicationId}`;
  const headers = { Authorization: `Bearer ${apiKey}` };

  if (metric === "subscriber_count") {
    const res = await fetch(`${baseUrl}/subscriptions?limit=1`, { headers });
    if (!res.ok) {
      throw new Error(`Beehiiv API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as BeehiivSubscriptionsResponse;
    return data.total_results;
  }

  // For open_rate and click_rate, fetch recent posts
  const res = await fetch(`${baseUrl}/posts?limit=10&status=confirmed`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`Beehiiv API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as BeehiivPostsResponse;

  const withStats = data.data.filter((p) => p.stats);
  if (withStats.length === 0) return 0;

  if (metric === "open_rate") {
    const total = withStats.reduce(
      (sum, p) => sum + (p.stats?.email_open_rate ?? 0),
      0
    );
    return total / withStats.length;
  }

  // click_rate
  const total = withStats.reduce(
    (sum, p) => sum + (p.stats?.email_click_rate ?? 0),
    0
  );
  return total / withStats.length;
}
