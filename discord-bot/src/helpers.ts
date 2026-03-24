export const MOSS = 0x5f6f52;
export const BRICK = 0xa04230;
export const OCHRE = 0xc49b2d;
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export function healthEmoji(status: string): string {
  if (status === "green") return "\u{1F7E2}";
  if (status === "yellow") return "\u{1F7E1}";
  if (status === "red") return "\u{1F534}";
  return "\u26AA";
}

export function severityEmoji(severity: string): string {
  if (severity === "critical") return "\u{1F534}";
  if (severity === "high") return "\u{1F7E0}";
  if (severity === "medium") return "\u{1F7E1}";
  return "\u26AA";
}

export function truncate(str: string, len = 60): string {
  return str.length > len ? str.slice(0, len) + "\u2026" : str;
}
