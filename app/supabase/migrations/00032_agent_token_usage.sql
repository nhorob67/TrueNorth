-- 00032_agent_token_usage.sql
-- Token cost tracking and budget policies for Hermes agent execution.
-- Hermes writes via service role (post_llm_call or on_session_end hook).
-- TrueNorth reads for cost dashboard and budget enforcement.

-- ============================================================
-- Token Usage Records
-- One row per LLM call or session (granularity depends on hook)
-- ============================================================

CREATE TABLE agent_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  hermes_profile text NOT NULL,
  session_id text,
  task_id uuid REFERENCES agent_tasks(id) ON DELETE SET NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric(10,6) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_usage_org ON agent_token_usage(organization_id);
CREATE INDEX idx_token_usage_org_created ON agent_token_usage(organization_id, created_at DESC);
CREATE INDEX idx_token_usage_profile ON agent_token_usage(hermes_profile);
CREATE INDEX idx_token_usage_agent ON agent_token_usage(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_token_usage_task ON agent_token_usage(task_id) WHERE task_id IS NOT NULL;
-- Composite index for cost dashboard aggregations by period
CREATE INDEX idx_token_usage_org_profile_created ON agent_token_usage(organization_id, hermes_profile, created_at DESC);

ALTER TABLE agent_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_token_usage FORCE ROW LEVEL SECURITY;

-- All org members can read cost data
CREATE POLICY "token_usage_org_read" ON agent_token_usage
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Insert via service role only (Hermes writes directly)

-- ============================================================
-- Budget Policies
-- Per-org or per-agent spending caps with configurable actions
-- ============================================================

CREATE TABLE agent_budget_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('org', 'agent')),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  budget_cap numeric(10,2) NOT NULL,
  alert_threshold_pct integer NOT NULL DEFAULT 80 CHECK (alert_threshold_pct > 0 AND alert_threshold_pct <= 100),
  action_on_exceed text NOT NULL DEFAULT 'alert' CHECK (action_on_exceed IN ('alert', 'pause', 'block')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_policies_org ON agent_budget_policies(organization_id);
CREATE INDEX idx_budget_policies_agent ON agent_budget_policies(agent_id) WHERE agent_id IS NOT NULL;

ALTER TABLE agent_budget_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_policies FORCE ROW LEVEL SECURITY;

-- All org members can read policies
CREATE POLICY "budget_policy_org_read" ON agent_budget_policies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Admin only for write operations
CREATE POLICY "budget_policy_admin_insert" ON agent_budget_policies
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "budget_policy_admin_update" ON agent_budget_policies
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "budget_policy_admin_delete" ON agent_budget_policies
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE TRIGGER budget_policies_updated_at
  BEFORE UPDATE ON agent_budget_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
