-- 00035_agent_performance.sql
-- Agent performance snapshots for drift detection and trend analysis.
-- Weekly snapshots aggregate from agent_token_usage, agent_tasks, and ai_actions.
-- Drift detection compares recent window to rolling baseline.

-- ============================================================
-- Performance Snapshots
-- One row per agent per period (daily/weekly/monthly)
-- ============================================================

CREATE TABLE agent_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_profile text NOT NULL,
  snapshot_date date NOT NULL,
  period text NOT NULL DEFAULT 'weekly' CHECK (period IN ('daily', 'weekly', 'monthly')),

  -- Aggregated metrics for this period
  metrics jsonb NOT NULL DEFAULT '{}',
  -- {
  --   tasks_completed: number,
  --   tasks_failed: number,
  --   tasks_total: number,
  --   avg_processing_time_ms: number,
  --   acceptance_rate: number (0-100),
  --   override_rate: number (0-100),
  --   total_cost: number,
  --   avg_cost_per_task: number,
  --   avg_confidence: string ("high"|"medium"|"low"),
  --   token_usage: { input: number, output: number, cache_read: number },
  --   models_used: string[]
  -- }

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(organization_id, agent_profile, snapshot_date, period)
);

CREATE INDEX idx_perf_snapshots_org ON agent_performance_snapshots(organization_id);
CREATE INDEX idx_perf_snapshots_profile_date ON agent_performance_snapshots(agent_profile, snapshot_date DESC);
CREATE INDEX idx_perf_snapshots_org_date ON agent_performance_snapshots(organization_id, snapshot_date DESC);

ALTER TABLE agent_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_snapshots FORCE ROW LEVEL SECURITY;

-- All org members can read
CREATE POLICY "perf_snapshots_org_read" ON agent_performance_snapshots
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Insert via service role only (cron writes)

-- ============================================================
-- Drift Alerts
-- Persisted drift detection results for dashboard display
-- ============================================================

CREATE TABLE agent_drift_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_profile text NOT NULL,
  drift_type text NOT NULL CHECK (drift_type IN ('acceptance_rate', 'cost', 'override_rate', 'latency')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),

  -- Current vs baseline values
  current_value numeric(10,4) NOT NULL,
  baseline_value numeric(10,4) NOT NULL,
  delta_pct numeric(10,2) NOT NULL,

  -- Time windows
  current_window_start date NOT NULL,
  current_window_end date NOT NULL,
  baseline_window_start date NOT NULL,
  baseline_window_end date NOT NULL,

  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drift_alerts_org ON agent_drift_alerts(organization_id);
CREATE INDEX idx_drift_alerts_unacked ON agent_drift_alerts(organization_id, acknowledged)
  WHERE acknowledged = false;

ALTER TABLE agent_drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_drift_alerts FORCE ROW LEVEL SECURITY;

CREATE POLICY "drift_alerts_org_read" ON agent_drift_alerts
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "drift_alerts_admin_update" ON agent_drift_alerts
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- MoA (Mixture of Agents) Configurations
-- High-stakes decisions routed to multiple agents for consensus
-- ============================================================

CREATE TABLE moa_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  decision_type text NOT NULL,
  proposer_profiles text[] NOT NULL,
  aggregator_profile text NOT NULL DEFAULT 'cockpit-advisor',
  min_proposals integer NOT NULL DEFAULT 2,
  consensus_threshold numeric(3,2) NOT NULL DEFAULT 0.70
    CHECK (consensus_threshold > 0 AND consensus_threshold <= 1),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moa_configs_org ON moa_configs(organization_id);

ALTER TABLE moa_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE moa_configs FORCE ROW LEVEL SECURITY;

CREATE POLICY "moa_configs_org_read" ON moa_configs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "moa_configs_admin_write" ON moa_configs
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE TRIGGER moa_configs_updated_at
  BEFORE UPDATE ON moa_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
