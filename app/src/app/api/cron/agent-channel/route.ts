import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runSignalWatch } from "@/lib/signal-watch";
import {
  sendDiscordNotification,
  getOrgDiscordWebhook,
} from "@/lib/discord-notify";
import { checkAndAlertRhythms } from "@/lib/cron/rhythm-alerts";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ============================================================
// Helpers
// ============================================================

const MOSS = 0x5f6f52;
const BRICK = 0xa04230;
const OCHRE = 0xc49b2d;

function severityEmoji(s: string): string {
  if (s === "critical") return "\u{1F534}";
  if (s === "high") return "\u{1F7E0}";
  if (s === "medium") return "\u{1F7E1}";
  return "\u26AA";
}

async function postEmbed(
  webhookUrl: string,
  embed: Record<string, unknown>
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Discord webhook failed (${res.status}): ${text}`);
  }
}

// ============================================================
// Cockpit Summary Builder
// ============================================================

async function buildAndPostCockpitSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  webhookUrl: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.truenorth.so";

  const [redKpis, yellowKpis, openBlockers, overdueCommitments, todayPulses, totalMembers] =
    await Promise.all([
      supabase
        .from("kpis")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("lifecycle_status", "active")
        .eq("health_status", "red"),
      supabase
        .from("kpis")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("lifecycle_status", "active")
        .eq("health_status", "yellow"),
      supabase
        .from("blockers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("resolution_state", "open"),
      supabase
        .from("commitments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .lt("due_date", today),
      supabase
        .from("pulses")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("date", today),
      supabase
        .from("organization_memberships")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
    ]);

  const redCount = redKpis.count ?? 0;
  const yellowCount = yellowKpis.count ?? 0;
  const blockerCount = openBlockers.count ?? 0;
  const overdueCount = overdueCommitments.count ?? 0;
  const pulseCount = todayPulses.count ?? 0;
  const memberCount = totalMembers.count ?? 0;
  const hasCritical = redCount > 0 || blockerCount > 0;

  const embed: Record<string, unknown> = {
    title: "Daily Cockpit Summary",
    color: hasCritical ? BRICK : MOSS,
    fields: [
      {
        name: "Drifting KPIs",
        value: `\u{1F534} ${redCount} red \u{00B7} \u{1F7E1} ${yellowCount} yellow`,
        inline: true,
      },
      { name: "Open Blockers", value: `${blockerCount}`, inline: true },
      { name: "Overdue Commitments", value: `${overdueCount}`, inline: true },
      { name: "Pulse Rate", value: `${pulseCount} / ${memberCount} today`, inline: true },
    ],
    footer: { text: `View: ${appUrl}/cockpit` },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(webhookUrl, embed);
}

// ============================================================
// Stalled Bets Check
// ============================================================

async function checkStalledBets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  webhookUrl: string
): Promise<number> {
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Active bets with no moves updated recently
  const { data: bets } = await supabase
    .from("bets")
    .select("id, outcome")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .lt("updated_at", fourteenDaysAgo);

  let posted = 0;
  for (const bet of bets ?? []) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.truenorth.so";
    await postEmbed(webhookUrl, {
      title: "Stalled Bet Warning",
      description: `**${bet.outcome}** has had no updates in 14+ days. Consider reviewing or archiving.`,
      color: OCHRE,
      author: { name: "Signal Watch AI Agent" },
      footer: { text: `View: ${appUrl}/bets/${bet.id}` },
      timestamp: new Date().toISOString(),
    });
    posted++;
  }
  return posted;
}

// ============================================================
// Missed Pulse Streak Check
// ============================================================

async function checkMissedPulseStreaks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  webhookUrl: string
): Promise<number> {
  // Find org members
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id, profiles(display_name)")
    .eq("organization_id", orgId);

  let posted = 0;
  const threeDaysAgo = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000
  ).toISOString();

  for (const member of members ?? []) {
    // Check if user has any pulse in last 3 days
    const { count } = await supabase
      .from("pulses")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("user_id", member.user_id)
      .gte("date", threeDaysAgo.slice(0, 10));

    if ((count ?? 0) === 0) {
      const displayName = Array.isArray(member.profiles)
        ? (member.profiles[0] as { display_name: string })?.display_name ??
          "A team member"
        : (member.profiles as { display_name: string } | null)?.display_name ??
          "A team member";

      await postEmbed(webhookUrl, {
        title: "Pulse Streak Missed",
        description: `**${displayName}** hasn't submitted a pulse in 3+ days. A gentle check-in may help.`,
        color: OCHRE,
        author: { name: "Cadence AI Agent" },
        timestamp: new Date().toISOString(),
      });
      posted++;
    }
  }
  return posted;
}

// ============================================================
// Weekly Sync Prep (posts 48h before sync day)
// ============================================================

async function maybeSendWeeklySyncPrep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  webhookUrl: string
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.truenorth.so";

  // Check venture settings for sync_day
  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, settings")
    .eq("organization_id", orgId)
    .limit(1);

  const venture = ventures?.[0];
  if (!venture?.settings) return false;

  const settings = venture.settings as Record<string, unknown>;
  const syncDay = settings.sync_day as number | undefined; // 0=Sun, 1=Mon...
  if (syncDay === undefined) return false;

  // Check if today is 2 days before sync day
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const prepDay = (syncDay - 2 + 7) % 7;
  if (dayOfWeek !== prepDay) return false;

  // Build sync prep data
  const [redKpisResult, blockersResult, decisionsResult, commitmentsResult] =
    await Promise.all([
      supabase
        .from("kpis")
        .select("name, current_value, unit")
        .eq("organization_id", orgId)
        .eq("lifecycle_status", "active")
        .eq("health_status", "red"),
      supabase
        .from("blockers")
        .select("description, severity")
        .eq("organization_id", orgId)
        .eq("resolution_state", "open"),
      supabase
        .from("decisions")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("decided_at", null),
      supabase
        .from("commitments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending"),
    ]);

  const redKpis = (redKpisResult.data ?? []) as Array<{
    name: string;
    current_value: number | null;
    unit: string | null;
  }>;
  const blockers = (blockersResult.data ?? []) as Array<{
    description: string;
    severity: string;
  }>;

  const kpiLines =
    redKpis.length > 0
      ? redKpis
          .slice(0, 10)
          .map(
            (k) =>
              `\u{1F534} **${k.name}**: ${k.current_value ?? "N/A"}${k.unit ? " " + k.unit : ""}`
          )
          .join("\n")
      : "None \u{2014} all KPIs on track";

  const blockerLines =
    blockers.length > 0
      ? blockers
          .slice(0, 10)
          .map(
            (b) =>
              `${severityEmoji(b.severity)} ${b.description.slice(0, 80)}`
          )
          .join("\n")
      : "None open";

  await postEmbed(webhookUrl, {
    title: "Weekly Sync Prep",
    color: MOSS,
    fields: [
      {
        name: `Red KPIs (${redKpis.length})`,
        value: kpiLines,
        inline: false,
      },
      {
        name: `Open Blockers (${blockers.length})`,
        value: blockerLines,
        inline: false,
      },
      {
        name: "Pending Decisions",
        value: `${decisionsResult.count ?? 0}`,
        inline: true,
      },
      {
        name: "Commitments Due",
        value: `${commitmentsResult.count ?? 0}`,
        inline: true,
      },
    ],
    footer: { text: `View: ${appUrl}/cockpit` },
    timestamp: new Date().toISOString(),
  });

  return true;
}

// ============================================================
// Main Route Handler
// ============================================================

/**
 * GET /api/cron/agent-channel
 *
 * Twice daily (7am + 5pm) agent channel posts:
 * - Daily cockpit summary (morning only)
 * - Signal watch high-severity alerts
 * - Stalled bet warnings
 * - Missed pulse streak nudges
 * - Weekly sync prep (48h before, morning only)
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id, name");

    if (orgError) {
      return NextResponse.json(
        { error: "Failed to fetch organizations", details: orgError.message },
        { status: 500 }
      );
    }

    const results = [];

    for (const org of orgs ?? []) {
      try {
        const webhookUrl = await getOrgDiscordWebhook(supabase, org.id);
        if (!webhookUrl) {
          results.push({
            orgId: org.id,
            orgName: org.name,
            status: "skipped",
            reason: "no_webhook",
          });
          continue;
        }

        let cockpitPosted = false;
        let signalAlerts = 0;
        let stalledBets = 0;
        let missedPulses = 0;
        let syncPrepPosted = false;
        let rhythmAlerts = 0;

        // Determine if this is the morning run (roughly)
        const hour = new Date().getUTCHours();
        const isMorning = hour < 12;

        // Daily cockpit summary (morning only)
        if (isMorning) {
          try {
            await buildAndPostCockpitSummary(supabase, org.id, webhookUrl);
            cockpitPosted = true;
          } catch (err) {
            console.error(
              `Cockpit summary failed for org ${org.id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }

        // Signal watch alerts
        try {
          const alerts = await runSignalWatch(supabase, org.id, {
            enableAI: false,
          });
          const highSeverity = alerts.filter((a) => a.severity === "high");
          for (const alert of highSeverity) {
            try {
              await sendDiscordNotification(webhookUrl, {
                title: alert.title,
                body: alert.body,
                entityType: "kpi",
                entityId: alert.kpi_id,
                tier: "urgent",
              });
              signalAlerts++;
            } catch (err) {
              console.error(
                `Signal alert failed for org ${org.id}:`,
                err instanceof Error ? err.message : err
              );
            }
          }
        } catch (err) {
          console.error(
            `Signal watch failed for org ${org.id}:`,
            err instanceof Error ? err.message : err
          );
        }

        // Stalled bets
        try {
          stalledBets = await checkStalledBets(supabase, org.id, webhookUrl);
        } catch (err) {
          console.error(
            `Stalled bets check failed for org ${org.id}:`,
            err instanceof Error ? err.message : err
          );
        }

        // Missed pulse streaks
        try {
          missedPulses = await checkMissedPulseStreaks(
            supabase,
            org.id,
            webhookUrl
          );
        } catch (err) {
          console.error(
            `Missed pulse check failed for org ${org.id}:`,
            err instanceof Error ? err.message : err
          );
        }

        // Rhythm alerts (recurring moves turned red)
        try {
          rhythmAlerts = await checkAndAlertRhythms(supabase, org.id);
        } catch (err) {
          console.error(
            `Rhythm alerts failed for org ${org.id}:`,
            err instanceof Error ? err.message : err
          );
        }

        // Weekly sync prep (morning only)
        if (isMorning) {
          try {
            syncPrepPosted = await maybeSendWeeklySyncPrep(
              supabase,
              org.id,
              webhookUrl
            );
          } catch (err) {
            console.error(
              `Sync prep failed for org ${org.id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }

        results.push({
          orgId: org.id,
          orgName: org.name,
          status: "success",
          cockpitPosted,
          signalAlerts,
          stalledBets,
          missedPulses,
          rhythmAlerts,
          syncPrepPosted,
        });
      } catch (err) {
        results.push({
          orgId: org.id,
          orgName: org.name,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      organizations: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
