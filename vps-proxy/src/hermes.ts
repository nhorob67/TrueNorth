import { execFile } from "child_process";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const AGENTS_BASE = process.env.HERMES_AGENTS_BASE ?? "/opt/hermes-agents";
const HERMES_PYTHON =
  process.env.HERMES_PYTHON ??
  join(process.env.HOME ?? "/home/nick", ".hermes/hermes-agent/venv/bin/python");

/**
 * Resolve the HERMES_HOME for a given profile name.
 */
export function agentHome(profile: string): string {
  // Sanitize: only allow alphanumeric, dash, underscore
  const safe = profile.replace(/[^a-zA-Z0-9_-]/g, "");
  return join(AGENTS_BASE, safe);
}

/**
 * Run a one-shot hermes chat query for a profile.
 * Returns the agent's text response.
 */
export function runOneShot(
  profile: string,
  prompt: string,
  timeoutMs = 300_000
): Promise<{ output: string; sessionId: string | null }> {
  const home = agentHome(profile);

  return new Promise((resolve, reject) => {
    const proc = execFile(
      HERMES_PYTHON,
      ["-m", "hermes_cli.main", "chat", "-q", prompt],
      {
        env: { ...process.env, HERMES_HOME: home },
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 5, // 5MB
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Hermes exited with error: ${err.message}\n${stderr}`));
          return;
        }

        // Extract session ID from output (line: "Session: <id>")
        const sessionMatch = stdout.match(/Session:\s+(\S+)/);
        const sessionId = sessionMatch?.[1] ?? null;

        // Extract the agent response (between the hermes header and the session footer)
        // The actual response is the main content
        resolve({ output: stdout, sessionId });
      }
    );

    // If the process is killed by timeout, reject
    proc.on("error", reject);
  });
}

/**
 * Read token usage from the agent's state.db for the most recent session.
 */
export async function getLatestSessionTokens(
  profile: string
): Promise<Record<string, unknown> | null> {
  const home = agentHome(profile);
  const dbPath = join(home, "state.db");

  // Use sqlite3 CLI since we don't want to add a native module dependency
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
  const home = agentHome(profile);
  await writeFile(join(home, "SOUL.md"), content, "utf-8");
}

/**
 * Write a memory entry to the agent's memories/MEMORY.md.
 */
export async function writeMemory(
  profile: string,
  content: string
): Promise<void> {
  const home = agentHome(profile);
  const memDir = join(home, "memories");
  await mkdir(memDir, { recursive: true });
  await writeFile(join(memDir, "MEMORY.md"), content, "utf-8");
}

/**
 * Read SOUL.md for a profile.
 */
export async function readSoul(profile: string): Promise<string> {
  const home = agentHome(profile);
  return readFile(join(home, "SOUL.md"), "utf-8");
}

/**
 * Check if a profile home exists.
 */
export async function profileExists(profile: string): Promise<boolean> {
  const home = agentHome(profile);
  try {
    await readFile(join(home, "config.yaml"), "utf-8");
    return true;
  } catch {
    return false;
  }
}
