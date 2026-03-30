-- 00029_agent_tasks.sql
-- Agent task queue for Hermes integration.
-- TrueNorth owns queueing, review state, approvals, and retries.
-- Hermes owns execution, tools, memory, and subagent delegation.

CREATE TABLE agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,

  -- Which Hermes profile handles this task
  agent_profile text NOT NULL,

  -- Task description
  title text NOT NULL,
  description text,

  -- Status workflow: submitted → assigned → running → review → approved/rejected → done | failed
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'assigned', 'running', 'review', 'approved', 'rejected', 'done', 'failed')),

  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Optional link to a TrueNorth entity (bet, kpi, idea, etc.)
  entity_id uuid,
  entity_type text,

  -- Agent input/output payloads
  input_data jsonb NOT NULL DEFAULT '{}',
  output_data jsonb NOT NULL DEFAULT '{}',
  error_message text,

  -- Who submitted the task (null for cron-initiated)
  submitted_by uuid,

  -- Review fields
  reviewed_by uuid,
  review_notes text,

  -- Retry tracking
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,

  -- Human-in-the-loop control
  requires_human_review boolean NOT NULL DEFAULT true,
  automation_level_at_submission integer,

  -- Claim tracking: prevents duplicate pickup
  claimed_at timestamptz,
  claim_token text,

  -- Runtime metadata from Hermes (tokens, model, session_id, etc.)
  run_metadata jsonb NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_tasks_org ON agent_tasks(organization_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_profile ON agent_tasks(agent_profile);
CREATE INDEX idx_agent_tasks_org_status ON agent_tasks(organization_id, status);
CREATE INDEX idx_agent_tasks_submitted_by ON agent_tasks(submitted_by);
CREATE INDEX idx_agent_tasks_review ON agent_tasks(organization_id, status)
  WHERE status = 'review';

-- RLS
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks FORCE ROW LEVEL SECURITY;

-- All org members can read tasks
CREATE POLICY "agent_tasks_org_read" ON agent_tasks
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- All org members can create tasks
CREATE POLICY "agent_tasks_org_insert" ON agent_tasks
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Admin/manager can update (review, approve, reject)
CREATE POLICY "agent_tasks_admin_update" ON agent_tasks
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
