import { SupabaseClient } from "@supabase/supabase-js";
import {
  sendDiscordNotification,
  getOrgDiscordWebhook,
} from "../discord-notify";

// ============================================================
// Rhythm Alerts: Detect recurring moves that just turned red
// and post alerts to Discord.
// ============================================================

export async function checkAndAlertRhythms(
  supabase: SupabaseClient,
  orgId: string
): Promise<number> {
  const webhookUrl = await getOrgDiscordWebhook(supabase, orgId);
  if (!webhookUrl) return 0;

  // Find recurring moves that are currently red
  const { data: redMoves } = await supabase
    .from("moves")
    .select("id, title, health_status, bet_id, owner_id")
    .eq("organization_id", orgId)
    .eq("type", "recurring")
    .eq("health_status", "red")
    .not("lifecycle_status", "eq", "cut");

  if (!redMoves || redMoves.length === 0) return 0;

  // Fetch bet names for context
  const betIds = [...new Set(redMoves.map((m) => m.bet_id).filter(Boolean))];
  const { data: bets } = betIds.length > 0
    ? await supabase
        .from("bets")
        .select("id, outcome")
        .in("id", betIds)
    : { data: [] as Array<{ id: string; outcome: string }> };

  const betMap = new Map(
    (bets ?? []).map((b) => [b.id, b.outcome])
  );

  // Fetch owner names
  const ownerIds = [...new Set(redMoves.map((m) => m.owner_id).filter(Boolean))];
  const { data: profiles } = ownerIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ownerIds)
    : { data: [] as Array<{ id: string; display_name: string }> };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name])
  );

  let alertsSent = 0;

  for (const move of redMoves) {
    const betName = move.bet_id ? betMap.get(move.bet_id) : "Unknown bet";
    const ownerName = move.owner_id
      ? profileMap.get(move.owner_id) ?? "Unassigned"
      : "Unassigned";

    try {
      await sendDiscordNotification(webhookUrl, {
        title: "Rhythm Alert: Move Turned Red",
        body: `**${move.title}** (owned by ${ownerName}) under bet "${betName}" has fallen behind its rhythm target. Review and take action.`,
        entityType: "move",
        entityId: move.id,
        tier: "urgent",
      });
      alertsSent++;
    } catch (err) {
      console.error(
        `Rhythm alert failed for move ${move.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return alertsSent;
}
