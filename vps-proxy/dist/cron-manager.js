import { schedule, validate } from "node-cron";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { runOneShot, getLatestSessionTokens, profileExists } from "./hermes.js";
const CRON_JOBS_PATH = process.env.CRON_JOBS_PATH ??
    join(process.env.HOME ?? "/home/nick", ".hermes/cron-jobs.json");
const TRUENORTH_URL = process.env.TRUENORTH_URL ?? "";
const HERMES_API_SECRET = process.env.HERMES_API_SECRET ?? "";
const jobs = new Map();
// ── Persistence ─────────────────────────────────────────────────────
async function saveToDisk() {
    const configs = Array.from(jobs.values()).map((j) => j.config);
    const dir = join(CRON_JOBS_PATH, "..");
    await mkdir(dir, { recursive: true });
    await writeFile(CRON_JOBS_PATH, JSON.stringify(configs, null, 2), "utf-8");
}
export async function loadFromDisk() {
    try {
        const raw = await readFile(CRON_JOBS_PATH, "utf-8");
        const configs = JSON.parse(raw);
        for (const config of configs) {
            scheduleJob(config);
        }
        // Sync all loaded configs to TrueNorth so admin UI is up to date
        if (configs.length > 0) {
            syncConfigsToTrueNorth().catch((err) => console.error("[cron] Startup config sync failed:", err instanceof Error ? err.message : err));
        }
        return configs.length;
    }
    catch {
        // File doesn't exist yet — that's fine
        return 0;
    }
}
// ── Scheduling ──────────────────────────────────────────────────────
function scheduleJob(config) {
    let task = null;
    if (config.enabled && validate(config.schedule)) {
        task = schedule(config.schedule, () => {
            executeCronJob(config).catch((err) => {
                console.error(`[cron] Job ${config.id} (${config.name}) failed:`, err);
            });
        });
    }
    jobs.set(config.id, { config, task });
}
async function executeCronJob(config) {
    const startedAt = new Date().toISOString();
    console.log(`[cron] Executing job ${config.id} (${config.name}) for profile ${config.profile}`);
    if (!(await profileExists(config.profile))) {
        console.error(`[cron] Profile '${config.profile}' not found, skipping job ${config.id}`);
        await syncExecution(config, {
            status: "error",
            startedAt,
            errorMessage: `Profile '${config.profile}' not found on VPS`,
        });
        return;
    }
    const prompt = [
        `Organization ID: ${config.orgId}`,
        config.prompt ? `\n${config.prompt}` : null,
        "",
        "Run your standard assessment using the available MCP tools. Return your analysis as structured JSON.",
    ]
        .filter(Boolean)
        .join("\n");
    try {
        const result = await runOneShot(config.profile, prompt);
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - new Date(startedAt).getTime();
        const tokens = await getLatestSessionTokens(config.profile);
        console.log(`[cron] Job ${config.id} completed in ${durationMs}ms`);
        await syncExecution(config, {
            status: "success",
            startedAt,
            completedAt,
            durationMs,
            result: { output: result.output, sessionId: result.sessionId },
            tokenUsage: tokens ?? {},
        });
    }
    catch (err) {
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - new Date(startedAt).getTime();
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[cron] Job ${config.id} failed after ${durationMs}ms:`, errorMessage);
        await syncExecution(config, {
            status: "error",
            startedAt,
            completedAt,
            durationMs,
            errorMessage,
        });
    }
}
async function syncExecution(config, exec) {
    if (!TRUENORTH_URL)
        return;
    const secret = process.env.HERMES_API_SECRET;
    if (!secret)
        return;
    try {
        const res = await fetch(`${TRUENORTH_URL}/api/hermes/cron/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({
                type: "execution",
                orgId: config.orgId,
                data: {
                    hermes_cron_job_id: config.id,
                    status: exec.status,
                    started_at: exec.startedAt,
                    completed_at: exec.completedAt ?? null,
                    duration_ms: exec.durationMs ?? null,
                    result: exec.result ?? {},
                    error_message: exec.errorMessage ?? null,
                    token_usage: exec.tokenUsage ?? {},
                },
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error(`[cron] Execution sync failed (${res.status}): ${body}`);
        }
    }
    catch (err) {
        console.error("[cron] Execution sync error:", err instanceof Error ? err.message : err);
    }
}
// ── Config sync to TrueNorth ────────────────────────────────────────
/**
 * Push all job configs to TrueNorth so the admin UI stays in sync.
 * Groups jobs by orgId and sends one request per org.
 * Fire-and-forget — failures are logged but never block the caller.
 */
async function syncConfigsToTrueNorth() {
    if (!TRUENORTH_URL || !HERMES_API_SECRET)
        return;
    // Group jobs by org
    const byOrg = new Map();
    for (const { config } of jobs.values()) {
        const list = byOrg.get(config.orgId) ?? [];
        list.push(config);
        byOrg.set(config.orgId, list);
    }
    for (const [orgId, orgJobs] of byOrg) {
        try {
            const res = await fetch(`${TRUENORTH_URL}/api/hermes/cron/sync`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${HERMES_API_SECRET}`,
                },
                body: JSON.stringify({
                    type: "config",
                    orgId,
                    data: {
                        jobs: orgJobs.map((j) => ({
                            id: j.id,
                            agent_profile: j.profile,
                            name: j.name,
                            prompt: j.prompt,
                            schedule: j.schedule,
                            enabled: j.enabled,
                        })),
                    },
                }),
            });
            if (!res.ok) {
                const body = await res.text().catch(() => "");
                console.error(`[cron] Config sync failed for org ${orgId} (${res.status}): ${body}`);
            }
            else {
                console.log(`[cron] Synced ${orgJobs.length} job config(s) to TrueNorth for org ${orgId}`);
            }
        }
        catch (err) {
            console.error("[cron] Config sync error:", err instanceof Error ? err.message : err);
        }
    }
}
// ── Public API ──────────────────────────────────────────────────────
export function registerJob(config) {
    // Stop existing job with same ID if any
    const existing = jobs.get(config.id);
    if (existing?.task) {
        existing.task.stop();
    }
    if (!validate(config.schedule)) {
        throw new Error(`Invalid cron expression: ${config.schedule}`);
    }
    scheduleJob(config);
    saveToDisk().catch((err) => console.error("[cron] saveToDisk failed:", err));
    syncConfigsToTrueNorth().catch((err) => console.error("[cron] config sync failed:", err));
}
export function updateJob(id, updates) {
    const existing = jobs.get(id);
    if (!existing) {
        throw new Error(`Job ${id} not found`);
    }
    // Stop old task
    if (existing.task) {
        existing.task.stop();
    }
    const updatedConfig = { ...existing.config, ...updates, id }; // never change ID
    if (!validate(updatedConfig.schedule)) {
        throw new Error(`Invalid cron expression: ${updatedConfig.schedule}`);
    }
    scheduleJob(updatedConfig);
    saveToDisk().catch((err) => console.error("[cron] saveToDisk failed:", err));
    syncConfigsToTrueNorth().catch((err) => console.error("[cron] config sync failed:", err));
}
export function removeJob(id) {
    const existing = jobs.get(id);
    if (existing?.task) {
        existing.task.stop();
    }
    jobs.delete(id);
    saveToDisk().catch((err) => console.error("[cron] saveToDisk failed:", err));
    syncConfigsToTrueNorth().catch((err) => console.error("[cron] config sync failed:", err));
}
export function listJobs() {
    return Array.from(jobs.values()).map((j) => j.config);
}
