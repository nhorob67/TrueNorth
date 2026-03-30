import type { FastifyRequest, FastifyReply } from "fastify";
/**
 * Fastify hook: verify Bearer token matches HERMES_API_SECRET.
 */
export declare function verifySecret(request: FastifyRequest, reply: FastifyReply): Promise<void>;
