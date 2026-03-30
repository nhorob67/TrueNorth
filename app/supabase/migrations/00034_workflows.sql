-- 00034_workflows.sql
-- Multi-agent delegation workflows.
-- TrueNorth owns workflow state transitions and dependencies.
-- Hermes executes individual steps as agent_tasks.

-- ============================================================
-- Workflow Templates
-- Define reusable multi-step agent orchestration patterns
-- ============================================================

CREATE TABLE workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,

  -- Trigger configuration
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'event', 'schedule', 'threshold')),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  -- event: { entity_type, event_name }
  -- schedule: { cron_expression }
  -- threshold: { kpi_id, condition, value }

  -- Ordered pipeline steps
  -- Each step: { order, agent_profile, action, prompt_template, input_mapping, output_key, depends_on[], parallel_group? }
  steps jsonb NOT NULL DEFAULT '[]',

  enabled boolean NOT NULL DEFAULT true,
  is_preset boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_templates_org ON workflow_templates(organization_id);
CREATE INDEX idx_workflow_templates_enabled ON workflow_templates(organization_id, enabled)
  WHERE enabled = true;
CREATE INDEX idx_workflow_templates_trigger ON workflow_templates(trigger_type);

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates FORCE ROW LEVEL SECURITY;

-- All org members can read
CREATE POLICY "workflow_templates_org_read" ON workflow_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Admin can write
CREATE POLICY "workflow_templates_admin_insert" ON workflow_templates
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "workflow_templates_admin_update" ON workflow_templates
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "workflow_templates_admin_delete" ON workflow_templates
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE TRIGGER workflow_templates_updated_at
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Workflow Executions
-- Track each run of a workflow template
-- ============================================================

CREATE TABLE workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_template_id uuid NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Context that triggered this execution
  trigger_context jsonb NOT NULL DEFAULT '{}',

  -- Per-step results as they complete
  -- Array of { step_order, agent_profile, status, task_id, output, started_at, completed_at }
  step_results jsonb NOT NULL DEFAULT '[]',

  -- Current step being executed (for progress display)
  current_step integer,
  total_steps integer,

  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

CREATE INDEX idx_workflow_executions_org ON workflow_executions(organization_id);
CREATE INDEX idx_workflow_executions_template ON workflow_executions(workflow_template_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_org_status ON workflow_executions(organization_id, status)
  WHERE status IN ('pending', 'running');

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions FORCE ROW LEVEL SECURITY;

-- All org members can read
CREATE POLICY "workflow_executions_org_read" ON workflow_executions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Admin/manager can insert (trigger workflows)
CREATE POLICY "workflow_executions_admin_insert" ON workflow_executions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Admin can update (cancel)
CREATE POLICY "workflow_executions_admin_update" ON workflow_executions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
