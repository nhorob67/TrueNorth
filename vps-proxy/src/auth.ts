import { timingSafeEqual } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Fastify hook: verify Bearer token matches HERMES_API_SECRET.
 */
export async function verifySecret(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const secret = process.env.HERMES_API_SECRET;
  if (!secret) {
    reply.code(500).send({ error: "HERMES_API_SECRET not configured" });
    return;
  }

  const auth = request.headers.authorization ?? "";
  const expected = `Bearer ${secret}`;

  if (
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
