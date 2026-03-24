-- TrueNorth Migration 00011: KPI Integrations
-- Adds kpi_integrations table for automated data syncing from external sources

CREATE TABLE kpi_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'stripe', 'convertkit', 'beehiiv', 'webhook', 'csv'
  config jsonb NOT NULL DEFAULT '{}', -- type-specific config (API keys, metric names, etc.)
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text, -- 'success', 'error', 'no_data'
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_integrations_kpi ON kpi_integrations(kpi_id);
CREATE INDEX idx_kpi_integrations_enabled ON kpi_integrations(enabled) WHERE enabled = true;

ALTER TABLE kpi_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_integrations FORCE ROW LEVEL SECURITY;

-- RLS: scoped through kpis table → organization_memberships
CREATE POLICY "kpi_integrations_select" ON kpi_integrations FOR SELECT TO authenticated USING (
  kpi_id IN (
    SELECT k.id FROM kpis k
    WHERE k.organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

CREATE POLICY "kpi_integrations_insert" ON kpi_integrations FOR INSERT TO authenticated WITH CHECK (
  kpi_id IN (
    SELECT k.id FROM kpis k
    WHERE k.organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

CREATE POLICY "kpi_integrations_update" ON kpi_integrations FOR UPDATE TO authenticated USING (
  kpi_id IN (
    SELECT k.id FROM kpis k
    WHERE k.organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

CREATE POLICY "kpi_integrations_delete" ON kpi_integrations FOR DELETE TO authenticated USING (
  kpi_id IN (
    SELECT k.id FROM kpis k
    WHERE k.organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
      AND role IN ('admin', 'manager')
    )
  )
);

CREATE TRIGGER kpi_integrations_updated_at BEFORE UPDATE ON kpi_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
