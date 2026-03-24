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
  total_subscribers: number;
}

interface ConvertKitBroadcast {
  id: number;
  stats?: {
    recipients: number;
    open_rate: number;
    click_rate: number;
  };
}

interface ConvertKitBroadcastsResponse {
  broadcasts: ConvertKitBroadcast[];
}

export async function fetchConvertKitMetric(config: ConvertKitConfig): Promise<number> {
  const { apiKey, metric } = config;

  if (metric === "subscriber_count") {
    const res = await fetch(
      `https://api.convertkit.com/v3/subscribers?api_secret=${apiKey}`
    );
    if (!res.ok) {
      throw new Error(`ConvertKit API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as ConvertKitSubscribersResponse;
    return data.total_subscribers;
  }

  // For open_rate and click_rate, fetch recent broadcasts and average
  const res = await fetch(
    `https://api.convertkit.com/v3/broadcasts?api_secret=${apiKey}`
  );
  if (!res.ok) {
    throw new Error(`ConvertKit API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as ConvertKitBroadcastsResponse;

  const withStats = data.broadcasts.filter((b) => b.stats);
  if (withStats.length === 0) return 0;

  const recentBroadcasts = withStats.slice(0, 10); // last 10
  if (metric === "open_rate") {
    const total = recentBroadcasts.reduce(
      (sum, b) => sum + (b.stats?.open_rate ?? 0),
      0
    );
    return total / recentBroadcasts.length;
  }

  // click_rate
  const total = recentBroadcasts.reduce(
    (sum, b) => sum + (b.stats?.click_rate ?? 0),
    0
  );
  return total / recentBroadcasts.length;
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
