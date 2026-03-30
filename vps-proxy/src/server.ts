import Fastify from "fastify";
import { verifySecret } from "./auth.js";
import {
  runOneShot,
  getLatestSessionTokens,
  writeSoul,
  writeMemory,
  readSoul,
  profileExists,
} from "./hermes.js";

const PORT = parseInt(process.env.PROXY_PORT ?? "3100", 10);
const HOST = process.env.PROXY_HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

// ── Health check (no auth needed) ────────────────────────────────────
app.get("/health", async () => ({ status: "ok", service: "truenorth-vps-proxy" }));

// All subsequent routes require bearer token auth
app.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health") return;
  await verifySecret(request, reply);
});

// ── POST /api/trigger ────────────────────────────────────────────────
// Called by TrueNorth to trigger an agent.
// Body: { profile, orgId, ventureId?, mode: "one-shot"|"async" }
app.post<{
  Body: {
    profile: string;
    orgId: string;
    ventureId?: string | null;
    mode?: "one-shot" | "async";
  };
}>("/api/trigger", async (request, reply) => {
  const { profile, orgId, ventureId, mode = "one-shot" } = request.body;

  if (!profile || !orgId) {
    return reply.code(400).send({ error: "Missing profile or orgId" });
  }

  if (!(await profileExists(profile))) {
    return reply.code(404).send({ error: `Profile '${profile}' not found on VPS` });
  }

  // Build the prompt with org context
  const prompt = [
    `Organization ID: ${orgId}`,
    ventureId ? `Venture ID: ${ventureId}` : null,
    "",
    "Run your standard assessment using the available MCP tools. Return your analysis as structured JSON.",
  ]
    .filter(Boolean)
    .join("\n");

  if (mode === "async") {
    // Fire and forget — return immediately with acknowledgment
    // In production this would enqueue to the task queue
    runOneShot(profile, prompt).catch((err) => {
      request.log.error({ profile, err: err.message }, "Async agent run failed");
    });

    return { status: "accepted", profile, mode: "async" };
  }

  // One-shot: wait for completion
  try {
    const result = await runOneShot(profile, prompt);

    // Fetch token usage from the session
    const tokens = await getLatestSessionTokens(profile);

    return {
      status: "completed",
      profile,
      output: result.output,
      sessionId: result.sessionId,
      tokenUsage: tokens,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent execution failed";
    request.log.error({ profile, err: message }, "Agent trigger failed");
    return reply.code(500).send({ error: message });
  }
});

// ── POST /api/sync-soul ──────────────────────────────────────────────
// Called by TrueNorth when admin edits SOUL.md in the UI.
// Body: { profile_name, content }
app.post<{
  Body: { profile_name: string; content: string };
}>("/api/sync-soul", async (request, reply) => {
  const { profile_name, content } = request.body;

  if (!profile_name || content === undefined) {
    return reply.code(400).send({ error: "Missing profile_name or content" });
  }

  if (!(await profileExists(profile_name))) {
    return reply.code(404).send({ error: `Profile '${profile_name}' not found` });
  }

  await writeSoul(profile_name, content);
  return { success: true, profile: profile_name };
});

// ── POST /api/sync-memory ────────────────────────────────────────────
// Called by TrueNorth when admin edits memory in the UI.
// Body: { profile_name, content }
app.post<{
  Body: { profile_name: string; content: string };
}>("/api/sync-memory", async (request, reply) => {
  const { profile_name, content } = request.body;

  if (!profile_name || content === undefined) {
    return reply.code(400).send({ error: "Missing profile_name or content" });
  }

  if (!(await profileExists(profile_name))) {
    return reply.code(404).send({ error: `Profile '${profile_name}' not found` });
  }

  await writeMemory(profile_name, content);
  return { success: true, profile: profile_name };
});

// ── GET /api/profile/:name ───────────────────────────────────────────
// Returns profile status: exists, SOUL content, latest session tokens.
app.get<{
  Params: { name: string };
}>("/api/profile/:name", async (request, reply) => {
  const { name } = request.params;

  if (!(await profileExists(name))) {
    return reply.code(404).send({ error: `Profile '${name}' not found` });
  }

  const [soul, tokens] = await Promise.all([
    readSoul(name).catch(() => null),
    getLatestSessionTokens(name),
  ]);

  return {
    profile: name,
    exists: true,
    soul: soul ? soul.slice(0, 500) : null,
    latestSession: tokens,
  };
});

// ── Start ────────────────────────────────────────────────────────────
app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`VPS proxy listening on ${HOST}:${PORT}`);
});
