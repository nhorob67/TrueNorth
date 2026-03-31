import { execFile } from "child_process";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const HERMES_BIN =
  process.env.HERMES_BIN ??
  join(process.env.HOME ?? "/home/nick", ".local/bin/hermes");

const PROFILES_BASE =
  process.env.HERMES_PROFILES_BASE ??
  join(process.env.HOME ?? "/home/nick", ".hermes/profiles");

/**
 * Resolve the profile directory path.
 */
export function profileHome(profile: string): string {
  const safe = profile.replace(/[^a-zA-Z0-9_-]/g, "");
  return join(PROFILES_BASE, safe);
}

/**
 * Run a one-shot hermes chat query using the -p flag.
 * Returns the agent's text response.
 */
export function runOneShot(
  profile: string,
  prompt: string,
  timeoutMs = 300_000
): Promise<{ output: string; sessionId: string | null }> {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      HERMES_BIN,
      ["-p", profile, "chat", "-q", prompt],
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 5, // 5MB
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Hermes exited with error: ${err.message}\n${stderr}`));
          return;
        }

        const sessionMatch = stdout.match(/Session:\s+(\S+)/);
        const sessionId = sessionMatch?.[1] ?? null;

        resolve({ output: stdout, sessionId });
      }
    );

    proc.on("error", reject);
  });
}

/**
 * Read token usage from the profile's state.db for the most recent session.
 */
export async function getLatestSessionTokens(
  profile: string
): Promise<Record<string, unknown> | null> {
  const home = profileHome(profile);
  const dbPath = join(home, "state.db");

  return new Promise((resolve) => {
    execFile(
      "sqlite3",
      [
        dbPath,
        "-json",
        "SELECT id, model, input_tokens, output_tokens, cache_read_tokens, reasoning_tokens, estimated_cost_usd, cost_status, started_at, ended_at FROM sessions ORDER BY started_at DESC LIMIT 1;",
      ],
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        try {
          const rows = JSON.parse(stdout);
          resolve(rows[0] ?? null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

/**
 * Write SOUL.md for a profile.
 */
export async function writeSoul(
  profile: string,
  content: string
): Promise<void> {
  const home = profileHome(profile);
  await writeFile(join(home, "SOUL.md"), content, "utf-8");
}

/**
 * Write a memory entry to the profile's memories/MEMORY.md.
 */
export async function writeMemory(
  profile: string,
  content: string
): Promise<void> {
  const home = profileHome(profile);
  const memDir = join(home, "memories");
  await mkdir(memDir, { recursive: true });
  await writeFile(join(memDir, "MEMORY.md"), content, "utf-8");
}

/**
 * Read SOUL.md for a profile.
 */
export async function readSoul(profile: string): Promise<string> {
  const home = profileHome(profile);
  return readFile(join(home, "SOUL.md"), "utf-8");
}

/**
 * Check if a profile exists.
 */
export async function profileExists(profile: string): Promise<boolean> {
  const home = profileHome(profile);
  try {
    await readFile(join(home, "config.yaml"), "utf-8");
    return true;
  } catch {
    return false;
  }
}
