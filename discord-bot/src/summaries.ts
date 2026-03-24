// ============================================================
// Automated Summary Formatters (PRD Section 3.19)
//
// Builds Discord embed objects for cockpit summaries and
// weekly sync prep digests used by the agent channel cron.
// ============================================================

import { MOSS, BRICK, APP_URL, severityEmoji } from "./helpers.js";

/**
 * Format a daily cockpit summary as a Discord embed object.
 */
export function formatCockpitSummary(data: {
  redKpis: number;
  yellowKpis: number;
  openBlockers: number;
  overdueCommitments: number;
  pulseRate: string;
  topAlert: string;
}): object {
  const hasCritical = data.redKpis > 0 || data.openBlockers > 0;

  return {
    title: "Daily Cockpit Summary",
    color: hasCritical ? BRICK : MOSS,
    fields: [
      {
        name: "Drifting KPIs",
        value: `\u{1F534} ${data.redKpis} red \u{00B7} \u{1F7E1} ${data.yellowKpis} yellow`,
        inline: true,
      },
      {
        name: "Open Blockers",
        value: `${data.openBlockers}`,
        inline: true,
      },
      {
        name: "Overdue Commitments",
        value: `${data.overdueCommitments}`,
        inline: true,
      },
      {
        name: "Pulse Rate",
        value: data.pulseRate,
        inline: true,
      },
      ...(data.topAlert
        ? [{ name: "Top Alert", value: data.topAlert, inline: false }]
        : []),
    ],
    footer: { text: `View: ${APP_URL}/cockpit` },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a weekly sync prep digest as a Discord embed object.
 */
export function formatWeeklySyncPrep(data: {
  redKpis: Array<{ name: string; value: string }>;
  openBlockers: Array<{ desc: string; severity: string }>;
  pendingDecisions: number;
  commitmentsDue: number;
}): object {
  const kpiLines =
    data.redKpis.length > 0
      ? data.redKpis
          .slice(0, 10)
          .map((k) => `\u{1F534} **${k.name}**: ${k.value}`)
          .join("\n")
      : "None \u{2014} all KPIs on track";

  const blockerLines =
    data.openBlockers.length > 0
      ? data.openBlockers
          .slice(0, 10)
          .map((b) => `${severityEmoji(b.severity)} ${b.desc}`)
          .join("\n")
      : "None open";

  return {
    title: "Weekly Sync Prep",
    color: MOSS,
    fields: [
      {
        name: `Red KPIs (${data.redKpis.length})`,
        value: kpiLines,
        inline: false,
      },
      {
        name: `Open Blockers (${data.openBlockers.length})`,
        value: blockerLines,
        inline: false,
      },
      {
        name: "Pending Decisions",
        value: `${data.pendingDecisions}`,
        inline: true,
      },
      {
        name: "Commitments Due",
        value: `${data.commitmentsDue}`,
        inline: true,
      },
    ],
    footer: { text: `View: ${APP_URL}/cockpit` },
    timestamp: new Date().toISOString(),
  };
}
