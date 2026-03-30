import { timingSafeEqual } from "crypto";

/**
 * Timing-safe verification of the HERMES_API_SECRET bearer token.
 * Used by /api/agents/* and /api/hermes/* routes to authenticate
 * requests from the Hermes VPS.
 */
export function verifyHermesSecret(request: Request): boolean {
  const secret = process.env.HERMES_API_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (!auth) return false;

  const expected = `Bearer ${secret}`;

  if (auth.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}
