-- 00041_hermes_cron_native_id.sql
-- Store Hermes's native short hex job ID for cross-referencing.

ALTER TABLE hermes_cron_jobs
  ADD COLUMN IF NOT EXISTS hermes_job_id text;
