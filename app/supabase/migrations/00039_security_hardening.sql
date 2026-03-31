-- 00039_security_hardening.sql
-- Tighten RLS around secret-bearing integration records.

DROP POLICY IF EXISTS "kpi_integrations_select" ON kpi_integrations;
CREATE POLICY "kpi_integrations_select" ON kpi_integrations
  FOR SELECT TO authenticated
  USING (
    kpi_id IN (
      SELECT k.id FROM kpis k
      WHERE k.organization_id IN (
        SELECT organization_id FROM organization_memberships
        WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "kpi_integrations_insert" ON kpi_integrations;
CREATE POLICY "kpi_integrations_insert" ON kpi_integrations
  FOR INSERT TO authenticated
  WITH CHECK (
    kpi_id IN (
      SELECT k.id FROM kpis k
      WHERE k.organization_id IN (
        SELECT organization_id FROM organization_memberships
        WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "kpi_integrations_update" ON kpi_integrations;
CREATE POLICY "kpi_integrations_update" ON kpi_integrations
  FOR UPDATE TO authenticated
  USING (
    kpi_id IN (
      SELECT k.id FROM kpis k
      WHERE k.organization_id IN (
        SELECT organization_id FROM organization_memberships
        WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    kpi_id IN (
      SELECT k.id FROM kpis k
      WHERE k.organization_id IN (
        SELECT organization_id FROM organization_memberships
        WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "kpi_integrations_delete" ON kpi_integrations;
CREATE POLICY "kpi_integrations_delete" ON kpi_integrations
  FOR DELETE TO authenticated
  USING (
    kpi_id IN (
      SELECT k.id FROM kpis k
      WHERE k.organization_id IN (
        SELECT organization_id FROM organization_memberships
        WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
      )
    )
  );
