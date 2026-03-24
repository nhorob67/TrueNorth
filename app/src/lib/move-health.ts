import type { HealthStatus } from "@/types/database";

interface MoveHealthInput {
  lifecycleStatus: string;
  dueDate: string | null;
  updatedAt: string;
  hasLinkedBlocker: boolean;
  blockerSeverity?: string;
}

export function calculateMoveHealth(input: MoveHealthInput): HealthStatus {
  const { lifecycleStatus, dueDate, updatedAt, hasLinkedBlocker, blockerSeverity } = input;

  if (lifecycleStatus === "shipped" || lifecycleStatus === "cut") return "green";

  const now = new Date();

  // Red conditions
  if (dueDate) {
    const due = new Date(dueDate);
    if (due < now) return "red";
    if (lifecycleStatus === "not_started") {
      const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue < 3) return "red";
    }
  }
  if (hasLinkedBlocker && (blockerSeverity === "critical" || blockerSeverity === "high")) {
    return "red";
  }

  // Yellow conditions
  if (dueDate) {
    const due = new Date(dueDate);
    const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= 5) return "yellow";
  }
  if (hasLinkedBlocker) return "yellow";
  if (lifecycleStatus === "in_progress") {
    const lastUpdate = new Date(updatedAt);
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 14) return "yellow";
  }

  return "green";
}
