-- Phase 2: Personal To-Dos (full), Cron Broadcast Engine, Move Instances
-- Migration 00006

-- ============================================================
-- Move Instances (Recurring Move cycle tracking)
-- ============================================================
-- Note: The moves table already exists (00002) but move_instances
-- was only defined in TypeScript types — this creates the actual table.

CREATE TYPE move_instance_status AS ENUM ('pending', 'completed', 'missed', 'skipped');

CREATE TABLE move_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  status move_instance_status NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  linked_entity_id uuid,
  linked_entity_type entity_type,
  notes text,
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_move_instances_move ON move_instances(move_id);
CREATE INDEX idx_move_instances_status ON move_instances(move_id, status);
CREATE INDEX idx_move_instances_cycle ON move_instances(move_id, cycle_start, cycle_end);

ALTER TABLE move_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_instances FORCE ROW LEVEL SECURITY;

CREATE POLICY "move_instances_select" ON move_instances FOR SELECT USING (
  move_id IN (
    SELECT id FROM moves WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "move_instances_insert" ON move_instances FOR INSERT WITH CHECK (
  move_id IN (
    SELECT id FROM moves WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "move_instances_update" ON move_instances FOR UPDATE USING (
  move_id IN (
    SELECT id FROM moves WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);

CREATE TRIGGER move_instances_updated_at BEFORE UPDATE ON move_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Partial index for pending instances (used by cron missed-instance detection)
CREATE INDEX idx_move_instances_pending
  ON move_instances(move_id, cycle_end)
  WHERE status = 'pending';

-- ============================================================
-- Add paused_at to moves for pause/resume support
-- ============================================================

ALTER TABLE moves ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- ============================================================
-- Cron Jobs (Broadcast Engine)
-- ============================================================

CREATE TABLE cron_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  schedule text NOT NULL,               -- cron expression (e.g., '0 7 * * 1-5')
  query_template text NOT NULL,         -- template key (e.g., 'kpi_scoreboard')
  format_template text,                 -- optional Handlebars template for Discord embed
  discord_channel_id text,              -- target Discord channel
  discord_webhook_url text,             -- webhook URL for delivery
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,                 -- 'success' | 'error' | 'no_data'
  last_run_result jsonb,                -- summary of last execution
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cron_jobs_org ON cron_jobs(organization_id);
CREATE INDEX idx_cron_jobs_enabled ON cron_jobs(organization_id, enabled) WHERE enabled = true;

ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY "cron_jobs_select" ON cron_jobs FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);
CREATE POLICY "cron_jobs_insert" ON cron_jobs FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "cron_jobs_update" ON cron_jobs FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "cron_jobs_delete" ON cron_jobs FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE TRIGGER cron_jobs_updated_at BEFORE UPDATE ON cron_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Cron Execution Log (audit trail for cron runs)
-- ============================================================

CREATE TABLE cron_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_job_id uuid NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'error' | 'no_data'
  result jsonb,
  error_message text,
  records_processed integer DEFAULT 0
);

CREATE INDEX idx_cron_executions_job ON cron_executions(cron_job_id, started_at DESC);

ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_executions FORCE ROW LEVEL SECURITY;

CREATE POLICY "cron_executions_select" ON cron_executions FOR SELECT USING (
  cron_job_id IN (
    SELECT id FROM cron_jobs WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);
-- Insert via service role only (cron API routes)

-- ============================================================
-- Add held_until to notifications (if not already present)
-- ============================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS held_until timestamptz;

-- ============================================================
-- Enhance entity_type enum for 'todo' support in entity picker
-- ============================================================

-- Add 'todo' to entity_type enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'todo' AND enumtypid = 'entity_type'::regtype) THEN
    ALTER TYPE entity_type ADD VALUE 'todo';
  END IF;
END
$$;
