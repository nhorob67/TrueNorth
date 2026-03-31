/**
 * Static registry of all Vercel cron jobs.
 * Mirrors vercel.json — used by the unified Cron & Schedules admin UI.
 */

export interface VercelCronDefinition {
  path: string;
  schedule: string;
  name: string;
  description: string;
  isAiAgent: boolean;
}

export const VERCEL_CRONS: VercelCronDefinition[] = [
  {
    path: "/api/cron/tick",
    schedule: "*/5 * * * *",
    name: "Tick (Cron Engine)",
    description: "Executes user-configured Discord broadcast cron jobs",
    isAiAgent: false,
  },
  {
    path: "/api/cron/escalations",
    schedule: "*/30 * * * *",
    name: "Escalations",
    description: "Checks KPI, blocker, pulse, and commitment escalation rules",
    isAiAgent: false,
  },
  {
    path: "/api/cron/recurring-moves",
    schedule: "0 1 * * *",
    name: "Recurring Moves",
    description: "Creates move instances for recurring cadences",
    isAiAgent: false,
  },
  {
    path: "/api/cron/staleness",
    schedule: "0 8 * * *",
    name: "Staleness Check",
    description: "Detects stale living artifacts (visions, processes, role cards)",
    isAiAgent: false,
  },
  {
    path: "/api/cron/filter-guardian",
    schedule: "0 */6 * * *",
    name: "Filter Guardian",
    description: "AI agent: evaluates ideas against strategic filters",
    isAiAgent: true,
  },
  {
    path: "/api/cron/digest",
    schedule: "0 * * * *",
    name: "Notification Digest",
    description: "Compiles hourly notification digests",
    isAiAgent: false,
  },
  {
    path: "/api/cron/signal-watch",
    schedule: "0 6 * * *",
    name: "Signal Watch",
    description: "AI agent: daily KPI anomaly detection",
    isAiAgent: true,
  },
  {
    path: "/api/cron/agenda-builder",
    schedule: "0 6 * * *",
    name: "Agenda Builder",
    description: "AI agent: drafts weekly sync meeting agenda",
    isAiAgent: true,
  },
  {
    path: "/api/cron/cockpit-advisor",
    schedule: "0 7 * * *",
    name: "Cockpit Advisor",
    description: "AI agent: generates daily operator recommendations",
    isAiAgent: true,
  },
  {
    path: "/api/cron/kill-switch",
    schedule: "0 8 1,15 * *",
    name: "Bet Tracker",
    description: "AI agent: weekly bet lifecycle tracking and kill criteria monitoring",
    isAiAgent: true,
  },
  {
    path: "/api/cron/kpi-sync",
    schedule: "0 */4 * * *",
    name: "KPI Sync",
    description: "Syncs external KPI data from Stripe, Discourse, ConvertKit",
    isAiAgent: false,
  },
  {
    path: "/api/cron/kpi-daily-snapshot",
    schedule: "0 0 * * *",
    name: "KPI Daily Snapshot",
    description: "Archives daily KPI value snapshots",
    isAiAgent: false,
  },
  {
    path: "/api/cron/cadence",
    schedule: "0 9 * * *",
    name: "Cadence Check",
    description: "Checks recurring move cadence compliance and sends alerts",
    isAiAgent: false,
  },
  {
    path: "/api/cron/agent-channel",
    schedule: "0 7,17 * * *",
    name: "Agent Channel",
    description: "Posts morning and evening agent updates to Discord",
    isAiAgent: false,
  },
  {
    path: "/api/cron/refresh-views",
    schedule: "*/15 * * * *",
    name: "Refresh Views",
    description: "Refreshes materialized views for performance",
    isAiAgent: false,
  },
  {
    path: "/api/cron/vault-archaeologist",
    schedule: "0 8 1 * *",
    name: "Vault Archaeologist",
    description: "AI agent: monthly stale idea resurfacing",
    isAiAgent: true,
  },
  {
    path: "/api/cron/agent-snapshots",
    schedule: "0 0 * * 0",
    name: "Agent Snapshots",
    description: "Weekly performance snapshot aggregation for drift detection",
    isAiAgent: false,
  },
  {
    path: "/api/cron/agent-drift",
    schedule: "0 9 * * 1",
    name: "Agent Drift Detection",
    description: "Weekly drift analysis comparing 7-day window to 4-week baseline",
    isAiAgent: false,
  },
  {
    path: "/api/cron/market-scout",
    schedule: "0 9 * * 1",
    name: "Market Scout",
    description: "AI agent: weekly competitor monitoring and market intelligence",
    isAiAgent: true,
  },
];

/**
 * Look up a cron definition by its API path.
 */
export function getCronByPath(path: string): VercelCronDefinition | undefined {
  return VERCEL_CRONS.find((c) => c.path === path);
}
