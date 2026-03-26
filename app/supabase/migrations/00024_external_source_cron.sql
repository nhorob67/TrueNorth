-- ============================================================
-- External Source Cron Jobs
-- ============================================================
-- Extends the cron engine to support jobs that fetch data from
-- external APIs (Kit, Discourse, etc.), compose messages via LLM,
-- and post to Discord channels.

-- ============================================================
-- Extend cron_jobs with job_type and external config
-- ============================================================

ALTER TABLE cron_jobs ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'template';
ALTER TABLE cron_jobs ADD COLUMN IF NOT EXISTS external_config jsonb;
ALTER TABLE cron_jobs ADD COLUMN IF NOT EXISTS system_prompt text;

COMMENT ON COLUMN cron_jobs.job_type IS 'template = existing DB query pipeline, external_source = external API + LLM composer';
COMMENT ON COLUMN cron_jobs.external_config IS 'Source-specific config (source_type, API env var names, base URLs, filters)';
COMMENT ON COLUMN cron_jobs.system_prompt IS 'LLM system prompt for composing Discord messages (external_source jobs only)';

-- ============================================================
-- Kit Subscriber History
-- ============================================================
-- Stores daily subscriber counts for day-over-day comparison.
-- The UNIQUE constraint ensures idempotency — multiple runs
-- in a day upsert the same row.

CREATE TABLE kit_subscriber_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cron_job_id uuid NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
  subscriber_count integer NOT NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cron_job_id, recorded_at)
);

CREATE INDEX idx_kit_sub_history_job ON kit_subscriber_history(cron_job_id, recorded_at DESC);
CREATE INDEX idx_kit_sub_history_org ON kit_subscriber_history(organization_id);

ALTER TABLE kit_subscriber_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_subscriber_history FORCE ROW LEVEL SECURITY;

-- Members can view history
CREATE POLICY "kit_sub_history_select" ON kit_subscriber_history FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Insert/update via service role only (cron engine runs as service role)
