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
import {
  loadFromDisk,
  registerJob,
  updateJob,
  removeJob,
  listJobs,
  type CronJobConfig,
} from "./cron-manager.js";
import { startPeriodicSync } from "./hermes-cron-sync.js";

const PORT = parseInt(process.env.PROXY_PORT ?? "3100", 10);
const HOST = process.env.PROXY_HOST ?? "0.0.0.0";
const TRUENORTH_URL = process.env.TRUENORTH_URL ?? "";

/**
 * Fire-and-forget POST to TrueNorth's /api/hermes/token-usage.
 * Failures are logged but never block the trigger response.
 */
async function syncTokenUsage(
  profile: string,
  orgId: string,
  sessionId: string | null,
  tokens: Record<string, unknown> | null
): Promise<void> {
  if (!TRUENORTH_URL || !tokens) return;

  const secret = process.env.HERMES_API_SECRET;
  if (!secret) return;

  try {
    const res = await fetch(`${TRUENORTH_URL}/api/hermes/token-usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        orgId,
        hermesProfile: profile,
        sessionId: sessionId ?? (tokens.id as string) ?? null,
        model: (tokens.model as string) ?? "unknown",
        inputTokens: (tokens.input_tokens as number) ?? 0,
        outputTokens: (tokens.output_tokens as number) ?? 0,
        cacheReadTokens: (tokens.cache_read_tokens as number) ?? 0,
        estimatedCost: (tokens.estimated_cost_usd as number) ?? 0,
        metadata: {
          reasoning_tokens: tokens.reasoning_tokens,
          cost_status: tokens.cost_status,
          started_at: tokens.started_at,
          ended_at: tokens.ended_at,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Token usage sync failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error("Token usage sync error:", err instanceof Error ? err.message : err);
  }
}

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

    // Fire-and-forget: sync token usage to TrueNorth
    syncTokenUsage(profile, orgId, result.sessionId, tokens).catch(() => {});

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

// ── POST /api/cron/register ──────────────────────────────────────────
// Called by TrueNorth to register a new cron job on the VPS.
app.post<{ Body: CronJobConfig }>("/api/cron/register", async (request, reply) => {
  const config = request.body;

  if (!config.id || !config.profile || !config.schedule || !config.orgId) {
    return reply.code(400).send({ error: "Missing required fields: id, profile, schedule, orgId" });
  }

  try {
    registerJob(config);
    return { success: true, jobId: config.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register job";
    return reply.code(400).send({ error: message });
  }
});

// ── PUT /api/cron/update ────────────────────────────────────────────
// Called by TrueNorth to update an existing cron job.
app.put<{ Body: Partial<CronJobConfig> & { id: string } }>("/api/cron/update", async (request, reply) => {
  const { id, ...updates } = request.body;

  if (!id) {
    return reply.code(400).send({ error: "Missing job id" });
  }

  try {
    updateJob(id, updates);
    return { success: true, jobId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update job";
    return reply.code(400).send({ error: message });
  }
});

// ── DELETE /api/cron/delete ─────────────────────────────────────────
// Called by TrueNorth to remove a cron job from the VPS.
app.delete<{ Body: { id: string } }>("/api/cron/delete", async (request, reply) => {
  const { id } = request.body;

  if (!id) {
    return reply.code(400).send({ error: "Missing job id" });
  }

  removeJob(id);
  return { success: true };
});

// ── GET /api/cron/list ──────────────────────────────────────────────
// Diagnostic: list all registered cron jobs.
app.get("/api/cron/list", async () => {
  return { jobs: listJobs() };
});

// ── Start ────────────────────────────────────────────────────────────
async function start() {
  // Restore cron jobs from disk before accepting requests
  const restored = await loadFromDisk();
  if (restored > 0) {
    app.log.info(`Restored ${restored} cron job(s) from disk`);
  }

  // Sync Hermes native cron jobs to TrueNorth on startup + every 5 min
  startPeriodicSync();

  app.listen({ port: PORT, host: HOST }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    app.log.info(`VPS proxy listening on ${HOST}:${PORT}`);
  });
}

start();
