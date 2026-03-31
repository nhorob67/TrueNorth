export interface CronJobConfig {
    id: string;
    orgId: string;
    profile: string;
    name: string;
    prompt: string | null;
    schedule: string;
    enabled: boolean;
}
export declare function loadFromDisk(): Promise<number>;
export declare function registerJob(config: CronJobConfig): void;
export declare function updateJob(id: string, updates: Partial<CronJobConfig>): void;
export declare function removeJob(id: string): void;
export declare function listJobs(): CronJobConfig[];
