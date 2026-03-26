import { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExternalSourceConfig,
  KitSubscribersConfig,
  DiscourseUnrepliedConfig,
} from "@/types/database";

// ============================================================
// External Source Cron Data Fetchers
// ============================================================
// Each source function fetches data from an external API and
// returns a structured result for LLM message composition.

export interface ExternalSourceResult {
  source_type: string;
  data: Record<string, unknown>;
  hasData: boolean;
  summary: string;
}

// ============================================================
// Dispatcher
// ============================================================

export async function executeExternalSource(
  config: ExternalSourceConfig,
  supabase: SupabaseClient,
  orgId: string,
  jobId: string
): Promise<ExternalSourceResult> {
  switch (config.source_type) {
    case "kit_subscribers":
      return fetchKitSubscribers(config, supabase, orgId, jobId);
    case "discourse_unreplied":
      return fetchDiscourseUnreplied(config);
    default:
      throw new Error(`Unknown source type: ${(config as ExternalSourceConfig).source_type}`);
  }
}

// ============================================================
// Kit Subscribers (API v4)
// ============================================================

interface KitV4SubscribersResponse {
  subscribers: Array<{ id: number }>;
  pagination: {
    has_previous_page: boolean;
    has_next_page: boolean;
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

async function fetchKitSubscriberCount(apiKey: string): Promise<number> {
  const res = await fetch("https://api.kit.com/v4/subscribers?per_page=1", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kit API v4 error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as KitV4SubscribersResponse;
  return data.pagination.total_count;
}

async function fetchKitSubscribers(
  config: KitSubscribersConfig,
  supabase: SupabaseClient,
  orgId: string,
  jobId: string
): Promise<ExternalSourceResult> {
  const apiKey = process.env[config.api_key_env];
  if (!apiKey) {
    throw new Error(
      `Environment variable ${config.api_key_env} is not set. Configure it in your deployment environment.`
    );
  }

  const subscriberCount = await fetchKitSubscriberCount(apiKey);

  // Get yesterday's count for comparison
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: previousEntry } = await supabase
    .from("kit_subscriber_history")
    .select("subscriber_count")
    .eq("cron_job_id", jobId)
    .eq("recorded_at", yesterdayStr)
    .single();

  const previousCount = previousEntry?.subscriber_count ?? null;
  const change = previousCount !== null ? subscriberCount - previousCount : null;
  const changePct =
    previousCount !== null && previousCount > 0
      ? Math.round((change! / previousCount) * 10000) / 100
      : null;

  // Upsert today's count (idempotent — UNIQUE on cron_job_id + recorded_at)
  const todayStr = new Date().toISOString().split("T")[0];
  await supabase.from("kit_subscriber_history").upsert(
    {
      organization_id: orgId,
      cron_job_id: jobId,
      subscriber_count: subscriberCount,
      recorded_at: todayStr,
    },
    { onConflict: "cron_job_id,recorded_at" }
  );

  return {
    source_type: "kit_subscribers",
    data: {
      subscriber_count: subscriberCount,
      previous_count: previousCount,
      change,
      change_pct: changePct,
      recorded_at: todayStr,
    },
    hasData: true,
    summary: `Kit subscribers: ${subscriberCount}${change !== null ? ` (${change >= 0 ? "+" : ""}${change})` : ""}`,
  };
}

// ============================================================
// Discourse Unreplied Posts
// ============================================================

interface DiscourseTopicPoster {
  user_id: number;
  extras?: string;
  description: string;
}

interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  reply_count: number;
  created_at: string;
  category_id: number;
  posters: DiscourseTopicPoster[];
}

interface DiscourseLatestResponse {
  topic_list: {
    topics: DiscourseTopic[];
  };
  users: Array<{
    id: number;
    username: string;
  }>;
}

async function fetchDiscourseUnreplied(
  config: DiscourseUnrepliedConfig
): Promise<ExternalSourceResult> {
  const apiKey = process.env[config.api_key_env];
  const apiUsername = process.env[config.api_username_env];

  if (!apiKey) {
    throw new Error(
      `Environment variable ${config.api_key_env} is not set. Configure it in your deployment environment.`
    );
  }
  if (!apiUsername) {
    throw new Error(
      `Environment variable ${config.api_username_env} is not set. Configure it in your deployment environment.`
    );
  }

  const baseUrl = config.base_url.replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/latest.json?no_definitions=true&order=created`, {
    headers: {
      "Api-Key": apiKey,
      "Api-Username": apiUsername,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discourse API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as DiscourseLatestResponse;

  // Build user ID → username map
  const userMap = new Map<number, string>();
  for (const user of data.users) {
    userMap.set(user.id, user.username);
  }

  // Filter for unreplied topics (posts_count === 1 means only the OP, no replies)
  const excludeSet = new Set(
    (config.exclude_usernames ?? []).map((u) => u.toLowerCase().trim())
  );

  const unrepliedTopics = data.topic_list.topics
    .filter((topic) => {
      if (topic.posts_count !== 1) return false;

      // Get the original poster's username
      const opPoster = topic.posters.find(
        (p) => p.extras === "latest single" || p.description?.includes("Original Poster")
      ) ?? topic.posters[0];
      const username = opPoster ? userMap.get(opPoster.user_id) ?? "" : "";

      // Exclude filtered usernames
      if (excludeSet.has(username.toLowerCase())) return false;

      return true;
    })
    .map((topic) => {
      const opPoster = topic.posters.find(
        (p) => p.extras === "latest single" || p.description?.includes("Original Poster")
      ) ?? topic.posters[0];
      const username = opPoster ? userMap.get(opPoster.user_id) ?? "unknown" : "unknown";
      const ageHours = Math.round(
        (Date.now() - new Date(topic.created_at).getTime()) / (1000 * 60 * 60)
      );

      return {
        title: topic.title,
        url: `${baseUrl}/t/${topic.slug}/${topic.id}`,
        author: username,
        age_hours: ageHours,
      };
    });

  return {
    source_type: "discourse_unreplied",
    data: {
      unreplied_topics: unrepliedTopics,
      total_count: unrepliedTopics.length,
    },
    hasData: unrepliedTopics.length > 0,
    summary: `${unrepliedTopics.length} unreplied Discourse post${unrepliedTopics.length !== 1 ? "s" : ""}`,
  };
}
