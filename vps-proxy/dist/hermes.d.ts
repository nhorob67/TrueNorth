/**
 * Resolve the HERMES_HOME for a given profile name.
 */
export declare function agentHome(profile: string): string;
/**
 * Run a one-shot hermes chat query for a profile.
 * Returns the agent's text response.
 */
export declare function runOneShot(profile: string, prompt: string, timeoutMs?: number): Promise<{
    output: string;
    sessionId: string | null;
}>;
/**
 * Read token usage from the agent's state.db for the most recent session.
 */
export declare function getLatestSessionTokens(profile: string): Promise<Record<string, unknown> | null>;
/**
 * Write SOUL.md for a profile.
 */
export declare function writeSoul(profile: string, content: string): Promise<void>;
/**
 * Write a memory entry to the agent's memories/MEMORY.md.
 */
export declare function writeMemory(profile: string, content: string): Promise<void>;
/**
 * Read SOUL.md for a profile.
 */
export declare function readSoul(profile: string): Promise<string>;
/**
 * Check if a profile home exists.
 */
export declare function profileExists(profile: string): Promise<boolean>;
