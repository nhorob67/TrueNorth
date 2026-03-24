// ============================================================
// Agent Channel Notifications (PRD Section 3.19)
//
// Posts AI agent alerts to Discord via webhooks with
// severity-colored embeds and deep links.
// ============================================================

import { BRICK, OCHRE, APP_URL } from "./helpers.js";

const SAGE = 0x8b9e82;

const SEVERITY_COLORS = {
  info: SAGE,
  warning: OCHRE,
  critical: BRICK,
} as const;

const ENTITY_LINK_MAP: Record<string, (id: string) => string> = {
  bet: (id) => `/bets/${id}`,
  kpi: (id) => `/scoreboard/${id}`,
  move: () => `/bets`,
  blocker: () => `/ops`,
  idea: () => `/ideas`,
  decision: () => `/decisions`,
  commitment: () => `/ops`,
};

export async function postAgentAlert(
  webhookUrl: string,
  alert: {
    agentName: string;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    severity: "info" | "warning" | "critical";
  }
): Promise<void> {
  const color = SEVERITY_COLORS[alert.severity];

  // Build deep link
  let footerText = `Severity: ${alert.severity}`;
  if (alert.entityType) {
    const builder = ENTITY_LINK_MAP[alert.entityType];
    if (builder) {
      const path = builder(alert.entityId ?? "");
      footerText += ` | View: ${APP_URL}${path}`;
    }
  }

  const embed = {
    title: alert.title,
    description: alert.body,
    color,
    author: {
      name: `${alert.agentName} AI Agent`,
    },
    footer: { text: footerText },
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Agent alert webhook failed (${res.status}): ${text}`);
  }
}
