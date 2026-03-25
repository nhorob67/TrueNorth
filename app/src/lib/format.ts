import type { HealthStatus, TodoPriority } from "@/types/database";

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toISOString().split("T")[0]);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatKpiValue(value: number | null, unit: string | null): string {
  if (value == null) return "—";
  if (unit === "$" || unit === "USD") return `$${value.toLocaleString()}`;
  if (unit === "%") return `${value}%`;
  return value.toLocaleString();
}

export const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: "text-semantic-brick",
  medium: "text-semantic-ochre-text",
  low: "text-subtle",
};

export function healthBadgeStatus(status: HealthStatus | string): "green" | "yellow" | "red" | "neutral" {
  if (status === "green" || status === "yellow" || status === "red") return status;
  return "neutral";
}

export const ENTITY_ROUTE_MAP: Record<string, string> = {
  bet: "/execution/bets",
  kpi: "/strategy/scoreboard",
  move: "/execution/bets",
  idea: "/execution/ideas",
  process: "/library/processes",
  content_piece: "/execution/content",
  todo: "/todos",
};
