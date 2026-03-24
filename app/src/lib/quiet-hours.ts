// ============================================================
// Quiet Hours (PRD Section 4.7)
//
// Users configure personal quiet hours (default: 9pm–7am).
// During quiet hours, all notifications except Immediate tier
// are held for the next active window.
// ============================================================

export interface QuietHoursConfig {
  enabled: boolean;
  start_hour: number; // 0-23, default 21 (9pm)
  end_hour: number;   // 0-23, default 7 (7am)
  timezone: string;   // e.g., "America/Chicago"
}

export const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  start_hour: 21,
  end_hour: 7,
  timezone: "America/Chicago",
};

/**
 * Check if the current time falls within quiet hours for the user.
 */
export function isInQuietHours(config: QuietHoursConfig): boolean {
  if (!config.enabled) return false;

  const now = new Date();

  // Get current hour in user's timezone
  let currentHour: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: config.timezone,
    });
    currentHour = parseInt(formatter.format(now));
  } catch {
    // Fallback to local hour if timezone invalid
    currentHour = now.getHours();
  }

  const { start_hour, end_hour } = config;

  if (start_hour > end_hour) {
    // Wraps midnight: e.g., 21-7 means 21,22,23,0,1,2,3,4,5,6
    return currentHour >= start_hour || currentHour < end_hour;
  } else {
    // Same day: e.g., 13-17
    return currentHour >= start_hour && currentHour < end_hour;
  }
}

/**
 * Determine if a notification should be delivered now or held.
 * Immediate tier always delivers. Other tiers respect quiet hours.
 */
export function shouldDeliver(
  tier: string,
  quietHoursConfig: QuietHoursConfig
): boolean {
  if (tier === "immediate") return true;
  return !isInQuietHours(quietHoursConfig);
}

/**
 * Parse quiet hours config from user settings.
 */
export function getQuietHoursConfig(
  userSettings: Record<string, unknown>
): QuietHoursConfig {
  const qh = userSettings.quiet_hours as Record<string, unknown> | undefined;
  if (!qh) return DEFAULT_QUIET_HOURS;

  return {
    enabled: (qh.enabled as boolean) ?? DEFAULT_QUIET_HOURS.enabled,
    start_hour: (qh.start_hour as number) ?? DEFAULT_QUIET_HOURS.start_hour,
    end_hour: (qh.end_hour as number) ?? DEFAULT_QUIET_HOURS.end_hour,
    timezone: (qh.timezone as string) ?? DEFAULT_QUIET_HOURS.timezone,
  };
}
