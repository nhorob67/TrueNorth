/**
 * Client for communicating with the Hermes VPS.
 * All calls authenticated via HERMES_API_SECRET bearer token.
 */

export class VpsClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "VpsClientError";
  }
}

/**
 * POST to the Hermes VPS API.
 * Throws VpsClientError on non-2xx responses.
 */
export async function callVps(
  path: string,
  body: unknown,
  options?: { timeout?: number }
): Promise<unknown> {
  const vpsUrl = process.env.HERMES_VPS_URL;
  const secret = process.env.HERMES_API_SECRET;

  if (!vpsUrl) throw new Error("HERMES_VPS_URL is not configured");
  if (!secret) throw new Error("HERMES_API_SECRET is not configured");

  const controller = new AbortController();
  const timeoutMs = options?.timeout ?? 55_000; // Under Vercel's 60s limit
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${vpsUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new VpsClientError(
        `VPS ${path} returned ${res.status}`,
        res.status,
        data
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check if VPS is configured and reachable.
 */
export function isVpsConfigured(): boolean {
  return !!(process.env.HERMES_VPS_URL && process.env.HERMES_API_SECRET);
}
