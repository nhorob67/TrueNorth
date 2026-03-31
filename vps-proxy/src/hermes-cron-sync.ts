/**
 * Syncs Hermes's native cron jobs (~/.hermes/cron/jobs.json) to TrueNorth.
 *
 * Hermes manages its own scheduler independently — jobs are created via Discord
 * or the CLI. This module reads that file and pushes configs to TrueNorth's
 * /api/hermes/cron/sync so they appear in the admin UI.
 */

import { readFile } from "fs/promises";
import { join } from "path";

const HERMES_CRON_PATH =
  process.env.HERMES_CRON_PATH ??
  join(process.env.HOME ?? "/home/nick", ".hermes/cron/jobs.json");

const TRUENORTH_URL = process.env.TRUENORTH_URL ?? "";
const HERMES_API_SECRET = process.env.HERMES_API_SECRET ?? "";
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID ?? "";

// How often to re-sync (ms). Hermes can add/edit jobs at any time via Discord.
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface HermesNativeJob {
  id: string;
  name: string;
  prompt: string;
  skills: string[];
  skill: string;
  schedule: { kind: string; expr: string; display: string };
  schedule_display: string;
  enabled: boolean;
  state: string;
  created_at: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  deliver: string;
  origin: {
    platform: string;
    chat_id: string;
    chat_name: string;
    thread_id: string | null;
  };
}

interface HermesNativeCronFile {
  jobs: HermesNativeJob[];
  updated_at: string;
}

async function readHermesNativeJobs(): Promise<HermesNativeJob[]> {
  try {
    const raw = await readFile(HERMES_CRON_PATH, "utf-8");
    const data: HermesNativeCronFile = JSON.parse(raw);
    return data.jobs ?? [];
  } catch {
    return [];
  }
}

export async function syncHermesNativeCrons(): Promise<number> {
  if (!TRUENORTH_URL || !HERMES_API_SECRET || !DEFAULT_ORG_ID) {
    if (!DEFAULT_ORG_ID) {
      console.warn("[hermes-sync] DEFAULT_ORG_ID not set — skipping native cron sync");
    }
    return 0;
  }

  const nativeJobs = await readHermesNativeJobs();
  if (nativeJobs.length === 0) return 0;

  const mapped = nativeJobs.map((job) => ({
    id: job.id,
    agent_profile: job.skill || job.skills?.[0] || "unknown",
    name: job.name,
    prompt: job.prompt || null,
    schedule: job.schedule?.expr ?? job.schedule_display,
    delivery_target: job.deliver === "origin" ? "discord" : job.deliver,
    enabled: job.enabled && job.state !== "paused",
  }));

  try {
    const res = await fetch(`${TRUENORTH_URL}/api/hermes/cron/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HERMES_API_SECRET}`,
      },
      body: JSON.stringify({
        type: "config",
        orgId: DEFAULT_ORG_ID,
        data: { jobs: mapped },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[hermes-sync] Sync failed (${res.status}): ${body}`);
      return 0;
    }

    const result = await res.json() as { synced?: number };
    console.log(`[hermes-sync] Synced ${result.synced ?? mapped.length} native Hermes cron job(s) to TrueNorth`);
    return result.synced ?? mapped.length;
  } catch (err) {
    console.error("[hermes-sync] Sync error:", err instanceof Error ? err.message : err);
    return 0;
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(): void {
  // Sync immediately on startup
  syncHermesNativeCrons().catch((err) =>
    console.error("[hermes-sync] Initial sync failed:", err instanceof Error ? err.message : err)
  );

  // Re-sync periodically to pick up changes made via Discord/CLI
  intervalHandle = setInterval(() => {
    syncHermesNativeCrons().catch((err) =>
      console.error("[hermes-sync] Periodic sync failed:", err instanceof Error ? err.message : err)
    );
  }, SYNC_INTERVAL_MS);
}

export function stopPeriodicSync(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
