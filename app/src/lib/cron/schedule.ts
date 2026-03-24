// ============================================================
// Simple Cron Expression Parser
// ============================================================
// Supports standard 5-field cron: minute hour day-of-month month day-of-week
// Does NOT support seconds or year fields.
// Special values: * (any), */N (every N), comma-separated lists, ranges (N-M)

interface CronFields {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseField(field: string, min: number, max: number): number[] {
  const values: number[] = [];

  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.push(i);
    } else if (part.startsWith("*/")) {
      const step = parseInt(part.slice(2), 10);
      if (isNaN(step) || step <= 0) continue;
      for (let i = min; i <= max; i += step) values.push(i);
    } else if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) continue;
      for (let i = start; i <= end; i++) values.push(i);
    } else {
      const val = parseInt(part, 10);
      if (!isNaN(val)) values.push(val);
    }
  }

  return values;
}

function parseCronExpression(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6), // 0 = Sunday
  };
}

function matchesCron(cron: CronFields, date: Date): boolean {
  return (
    cron.minute.includes(date.getUTCMinutes()) &&
    cron.hour.includes(date.getUTCHours()) &&
    cron.dayOfMonth.includes(date.getUTCDate()) &&
    cron.month.includes(date.getUTCMonth() + 1) &&
    cron.dayOfWeek.includes(date.getUTCDay())
  );
}

/**
 * Determines whether a cron job should run now given its schedule and last run time.
 * Uses a 90-second tolerance window so that jobs triggered by a periodic tick
 * (e.g., every 5 minutes) don't miss their window.
 */
export function shouldRunNow(
  schedule: string,
  lastRunAt: string | null
): boolean {
  const cron = parseCronExpression(schedule);
  if (!cron) return false;

  const now = new Date();

  // If it ran in the last 60 seconds, skip (prevent double-fire)
  if (lastRunAt) {
    const lastRun = new Date(lastRunAt);
    if (now.getTime() - lastRun.getTime() < 60_000) return false;
  }

  // Check current minute
  if (matchesCron(cron, now)) return true;

  // Also check within a 5-minute lookback window for tick-based execution
  // (the tick endpoint may run every 5 minutes, so we check recent minutes)
  for (let offset = 1; offset <= 4; offset++) {
    const past = new Date(now.getTime() - offset * 60_000);
    if (matchesCron(cron, past)) {
      // Only fire if it hasn't run since that minute
      if (!lastRunAt) return true;
      const lastRun = new Date(lastRunAt);
      if (past.getTime() > lastRun.getTime()) return true;
    }
  }

  return false;
}

// ============================================================
// Human-readable schedule descriptions
// ============================================================

export const SCHEDULE_PRESETS = [
  { label: "Every morning at 7am UTC", value: "0 7 * * *" },
  { label: "Every morning at 9am UTC", value: "0 9 * * *" },
  { label: "Every day at 5pm UTC", value: "0 17 * * *" },
  { label: "Every Monday at 8am UTC", value: "0 8 * * 1" },
  { label: "Every Monday at 9am UTC", value: "0 9 * * 1" },
  { label: "Every Friday at 4pm UTC", value: "0 16 * * 5" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
] as const;

export function describeSchedule(schedule: string): string {
  const preset = SCHEDULE_PRESETS.find((p) => p.value === schedule);
  if (preset) return preset.label;

  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;

  const [min, hour, dom, mon, dow] = parts;
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let desc = "";

  if (min.startsWith("*/")) {
    desc = `Every ${min.slice(2)} minutes`;
  } else if (hour.startsWith("*/")) {
    desc = `Every ${hour.slice(2)} hours at :${min.padStart(2, "0")}`;
  } else if (dow !== "*") {
    const days = dow
      .split(",")
      .map((d) => dowNames[parseInt(d, 10)] ?? d)
      .join(", ");
    desc = `${days} at ${hour}:${min.padStart(2, "0")} UTC`;
  } else if (dom !== "*") {
    desc = `Day ${dom} of month at ${hour}:${min.padStart(2, "0")} UTC`;
  } else if (mon !== "*") {
    desc = `Month ${mon}, daily at ${hour}:${min.padStart(2, "0")} UTC`;
  } else if (hour !== "*" && min !== "*") {
    desc = `Daily at ${hour}:${min.padStart(2, "0")} UTC`;
  } else {
    desc = schedule;
  }

  return desc;
}
