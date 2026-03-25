/**
 * Core sync dispatcher for KPI integrations.
 * Routes each integration to its type-specific handler.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KpiIntegration } from "@/types/database";
import { fetchStripeMetric } from "./stripe";
import { fetchConvertKitMetric, fetchBeehiivMetric } from "./email";
import { fetchDiscourseMetric } from "./discourse";

export interface SyncResult {
  value: number | null;
  error?: string;
}

/**
 * Sync a single KPI integration by dispatching to the appropriate handler.
 * Returns the fetched value or an error message.
 */
export async function syncKpiIntegration(
  _supabase: SupabaseClient,
  integration: KpiIntegration
): Promise<SyncResult> {
  try {
    const config = integration.config;

    switch (integration.integration_type) {
      case "stripe": {
        const value = await fetchStripeMetric({
          apiKey: config.apiKey as string,
          metric: config.metric as "mrr" | "active_customers" | "churn_rate" | "revenue",
        });
        return { value };
      }

      case "convertkit": {
        const value = await fetchConvertKitMetric({
          apiKey: config.apiKey as string,
          metric: config.metric as "subscriber_count" | "open_rate" | "click_rate",
        });
        return { value };
      }

      case "beehiiv": {
        const value = await fetchBeehiivMetric({
          apiKey: config.apiKey as string,
          publicationId: config.publicationId as string,
          metric: config.metric as "subscriber_count" | "open_rate" | "click_rate",
        });
        return { value };
      }

      case "discourse": {
        const value = await fetchDiscourseMetric({
          apiKey: config.apiKey as string,
          apiUsername: (config.apiUsername as string) || "system",
          baseUrl: config.baseUrl as string,
          metric: config.metric as "user_count" | "wau_over_mau" | "active_users_7_days" | "active_users_30_days" | "topics_7_days" | "posts_7_days" | "likes_7_days" | "dau" | "posts_with_2_replies_24h" | "median_ttfr_hours",
        });
        return { value };
      }

      case "webhook":
        // Webhooks are push-based; nothing to pull.
        return { value: null };

      case "csv":
        // CSV is one-time import, not a sync source.
        return { value: null };

      default:
        return { value: null, error: `Unknown integration type: ${integration.integration_type}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    return { value: null, error: message };
  }
}
