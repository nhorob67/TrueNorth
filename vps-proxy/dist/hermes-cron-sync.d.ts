/**
 * Syncs Hermes's native cron jobs (~/.hermes/cron/jobs.json) to TrueNorth.
 *
 * Hermes manages its own scheduler independently — jobs are created via Discord
 * or the CLI. This module reads that file and pushes configs to TrueNorth's
 * /api/hermes/cron/sync so they appear in the admin UI.
 */
export declare function syncHermesNativeCrons(): Promise<number>;
export declare function startPeriodicSync(): void;
export declare function stopPeriodicSync(): void;
