import { timingSafeEqual } from "crypto";

/**
 * Timing-safe verification of the CRON_SECRET bearer token.
 * Used by all /api/cron/* routes to authenticate Vercel Cron requests.
 */
export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (!auth) return false;

  const expected = `Bearer ${secret}`;

  // Ensure equal length before comparing to avoid leaking length info
  if (auth.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}
