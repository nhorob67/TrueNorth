/**
 * Stripe integration for KPI data syncing.
 * Fetches MRR, active customers, churn rate, and revenue from the Stripe API.
 */

interface StripeConfig {
  apiKey: string;
  metric: "mrr" | "active_customers" | "churn_rate" | "revenue";
}

interface StripeListResponse<T> {
  data: T[];
  has_more: boolean;
  object: string;
}

interface StripeSubscription {
  id: string;
  status: string;
  items: {
    data: Array<{
      plan: { amount: number };
      quantity: number;
    }>;
  };
  canceled_at: number | null;
}

interface StripeBalance {
  available: Array<{ amount: number; currency: string }>;
}

async function stripeGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllSubscriptions(
  apiKey: string,
  status: string
): Promise<StripeSubscription[]> {
  const all: StripeSubscription[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      status,
      limit: "100",
    });
    if (startingAfter) params.set("starting_after", startingAfter);

    const res = await stripeGet<StripeListResponse<StripeSubscription>>(
      apiKey,
      `/subscriptions?${params.toString()}`
    );
    all.push(...res.data);

    if (!res.has_more || res.data.length === 0) break;
    startingAfter = res.data[res.data.length - 1].id;
  }

  return all;
}

async function fetchMrr(apiKey: string): Promise<number> {
  const subs = await fetchAllSubscriptions(apiKey, "active");
  let totalCents = 0;
  for (const sub of subs) {
    for (const item of sub.items.data) {
      totalCents += item.plan.amount * item.quantity;
    }
  }
  return totalCents / 100;
}

async function fetchActiveCustomers(apiKey: string): Promise<number> {
  // Use search to count customers — Stripe returns total_count in list endpoints
  const res = await fetch(
    `https://api.stripe.com/v1/customers?limit=1`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!res.ok) {
    throw new Error(`Stripe API error ${res.status}`);
  }
  // Stripe v1 list endpoints don't return total_count directly.
  // We use the subscriptions as a proxy: count unique customers with active subs.
  const subs = await fetchAllSubscriptions(apiKey, "active");
  const uniqueCustomers = new Set<string>();
  for (const sub of subs) {
    // subscription.customer is at top level in full response
    const fullSub = sub as StripeSubscription & { customer: string };
    if (fullSub.customer) uniqueCustomers.add(fullSub.customer);
  }
  return uniqueCustomers.size;
}

async function fetchChurnRate(apiKey: string): Promise<number> {
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  // Get canceled subs in the last 30 days
  const allCanceled = await fetchAllSubscriptions(apiKey, "canceled");
  const recentCanceled = allCanceled.filter(
    (s) => s.canceled_at && s.canceled_at >= thirtyDaysAgo
  );

  // Get active subscriptions count
  const activeSubs = await fetchAllSubscriptions(apiKey, "active");
  const totalAtStart = activeSubs.length + recentCanceled.length;

  if (totalAtStart === 0) return 0;
  return (recentCanceled.length / totalAtStart) * 100;
}

async function fetchRevenue(apiKey: string): Promise<number> {
  const balance = await stripeGet<StripeBalance>(apiKey, "/balance");
  let totalCents = 0;
  for (const entry of balance.available) {
    totalCents += entry.amount;
  }
  return totalCents / 100;
}

export async function fetchStripeMetric(config: StripeConfig): Promise<number> {
  const { apiKey, metric } = config;

  switch (metric) {
    case "mrr":
      return fetchMrr(apiKey);
    case "active_customers":
      return fetchActiveCustomers(apiKey);
    case "churn_rate":
      return fetchChurnRate(apiKey);
    case "revenue":
      return fetchRevenue(apiKey);
    default:
      throw new Error(`Unknown Stripe metric: ${metric}`);
  }
}
