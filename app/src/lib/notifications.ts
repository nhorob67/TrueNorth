import { SupabaseClient } from "@supabase/supabase-js";
import { getQuietHoursConfig, shouldDeliver } from "./quiet-hours";
import { sendDiscordNotification, getOrgDiscordWebhook } from "./discord-notify";
import { validateUuid } from "./validation";
import type { EntityType } from "@/types/database";

export type NotificationType =
  | "blocker_created"
  | "mention"
  | "pulse_drift"
  | "commitment_due"
  | "commitment_overdue"
  | "kpi_alert"
  | "kpi_escalation"
  | "kpi_critical"
  | "move_overdue"
  | "comment_added"
  | "blocker_aging"
  | "staleness_alert"
  | "agenda_prepared"
  | "cockpit_advice"
  | "kill_switch_assessment"
  | "narrative_generated"
  | "health_threshold"
  | "agent_drift_detected"
  | "agent_budget_warning";

export type NotificationTier = "immediate" | "urgent" | "daily_digest" | "weekly_digest";

const VALID_ENTITY_TYPES = new Set<EntityType>([
  "bet",
  "kpi",
  "move",
  "move_instance",
  "idea",
  "funnel",
  "decision",
  "blocker",
  "commitment",
  "issue",
  "process",
  "content_piece",
  "todo",
]);

function normalizeEntityLink(
  entityId?: string,
  entityType?: string
): { entityId: string | null; entityType: EntityType | null } {
  if (!entityId || !entityType) {
    return { entityId: null, entityType: null };
  }

  if (!validateUuid(entityId) || !VALID_ENTITY_TYPES.has(entityType as EntityType)) {
    return { entityId: null, entityType: null };
  }

  return {
    entityId,
    entityType: entityType as EntityType,
  };
}

/**
 * Send a notification, respecting quiet hours.
 *
 * - Immediate tier: always delivered regardless of quiet hours.
 * - Urgent tier: held during quiet hours, delivered on next active window.
 * - Daily/Weekly digest: batched and delivered at configured times.
 *
 * Held notifications are still inserted into the DB with a `held_until`
 * timestamp so they can be delivered when quiet hours end.
 */
export async function sendNotification(
  supabase: SupabaseClient,
  notification: {
    userId: string;
    orgId: string;
    type: NotificationType;
    tier?: NotificationTier;
    title: string;
    body?: string;
    entityId?: string;
    entityType?: string;
  }
) {
  const tier = notification.tier ?? "daily_digest";
  const entityLink = normalizeEntityLink(
    notification.entityId,
    notification.entityType
  );

  // Check quiet hours for the user
  let heldUntil: string | null = null;
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("settings")
      .eq("id", notification.userId)
      .single();

    if (profile?.settings) {
      const config = getQuietHoursConfig(
        profile.settings as Record<string, unknown>
      );
      if (!shouldDeliver(tier, config)) {
        // Compute when quiet hours end
        const now = new Date();
        const endHour = config.end_hour;
        const held = new Date(now);
        held.setHours(endHour, 0, 0, 0);
        if (held <= now) {
          held.setDate(held.getDate() + 1);
        }
        heldUntil = held.toISOString();
      }
    }
  } catch {
    // If we can't check quiet hours, deliver immediately
  }

  const { error } = await supabase.from("notifications").insert({
    organization_id: notification.orgId,
    user_id: notification.userId,
    type: notification.type,
    tier,
    title: notification.title,
    body: notification.body ?? null,
    entity_id: entityLink.entityId,
    entity_type: entityLink.entityType,
    held_until: heldUntil,
  });

  if (error) console.error("Failed to send notification:", error);

  // Fire-and-forget Discord delivery for immediate/urgent tiers
  if (!error && (tier === "immediate" || tier === "urgent")) {
    getOrgDiscordWebhook(supabase, notification.orgId)
      .then((webhookUrl) => {
        if (webhookUrl) {
          return sendDiscordNotification(webhookUrl, {
            title: notification.title,
            body: notification.body,
            entityType: notification.entityType,
            entityId: notification.entityId,
            tier,
          });
        }
      })
      .catch((err) => {
        console.error("Discord notification delivery failed:", err);
      });
  }
}

export async function getUnreadCount(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)
    .or(`held_until.is.null,held_until.lte.${now}`);
  return count ?? 0;
}

export async function getRecentNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .or(`held_until.is.null,held_until.lte.${now}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function markAsRead(supabase: SupabaseClient, notificationId: string) {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
}

export async function markAllAsRead(supabase: SupabaseClient, userId: string) {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}
