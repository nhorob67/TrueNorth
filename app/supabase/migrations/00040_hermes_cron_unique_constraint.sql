-- 00040_hermes_cron_unique_constraint.sql
-- Add unique constraint on (organization_id, agent_profile, name) so VPS→TrueNorth
-- config sync can upsert by logical identity rather than requiring matching UUIDs.
-- Also add hermes_job_id to store Hermes's native short hex ID for cross-referencing.

ALTER TABLE hermes_cron_jobs
  ADD COLUMN IF NOT EXISTS hermes_job_id text,
  ADD CONSTRAINT hermes_cron_jobs_org_profile_name_key
  UNIQUE (organization_id, agent_profile, name);
