-- 00031_cron_visibility.sql
-- Unified cron visibility: Vercel system crons, Hermes agent crons,
-- and execution history for both.

-- ============================================================
-- Vercel Cron Execution Tracking
-- System-level, not org-scoped (Vercel crons process all orgs)
-- ============================================================

CREATE TABLE vercel_cron_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_path text NOT NULL,
  schedule text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  result_summary jsonb NOT NULL DEFAULT '{}',
  error_message text,
  organizations_processed integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_vercel_cron_path ON vercel_cron_executions(cron_path, started_at DESC);

-- No RLS — queried via service client in admin-only server components

-- ============================================================
-- Hermes Agent Cron Jobs
-- Per-org, tracks Hermes-side scheduled tasks
-- ============================================================

CREATE TABLE hermes_cron_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_profile text NOT NULL,
  name text NOT NULL,
  description text,
  prompt text,
  schedule text NOT NULL,
  delivery_target text NOT NULL DEFAULT 'supabase',
  delivery_config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  last_run_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hermes_cron_org ON hermes_cron_jobs(organization_id);
CREATE INDEX idx_hermes_cron_profile ON hermes_cron_jobs(agent_profile);

ALTER TABLE hermes_cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hermes_cron_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY "hermes_cron_org_read" ON hermes_cron_jobs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "hermes_cron_admin_write" ON hermes_cron_jobs
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin')
    )
  );

CREATE TRIGGER hermes_cron_jobs_updated_at
  BEFORE UPDATE ON hermes_cron_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Hermes Cron Execution History
-- ============================================================

CREATE TABLE hermes_cron_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hermes_cron_job_id uuid NOT NULL REFERENCES hermes_cron_jobs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'skipped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  result jsonb NOT NULL DEFAULT '{}',
  error_message text,
  token_usage jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_hermes_cron_exec_job ON hermes_cron_executions(hermes_cron_job_id, started_at DESC);
