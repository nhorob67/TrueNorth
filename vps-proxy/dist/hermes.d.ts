/**
 * Resolve the profile directory path.
 */
export declare function profileHome(profile: string): string;
/**
 * Run a one-shot hermes chat query using the -p flag.
 * Returns the agent's text response.
 */
export declare function runOneShot(profile: string, prompt: string, timeoutMs?: number): Promise<{
    output: string;
    sessionId: string | null;
}>;
/**
 * Read token usage from the profile's state.db for the most recent session.
 */
export declare function getLatestSessionTokens(profile: string): Promise<Record<string, unknown> | null>;
/**
 * Write SOUL.md for a profile.
 */
export declare function writeSoul(profile: string, content: string): Promise<void>;
/**
 * Write a memory entry to the profile's memories/MEMORY.md.
 */
export declare function writeMemory(profile: string, content: string): Promise<void>;
/**
 * Read SOUL.md for a profile.
 */
export declare function readSoul(profile: string): Promise<string>;
/**
 * Check if a profile exists.
 */
export declare function profileExists(profile: string): Promise<boolean>;
