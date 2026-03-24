-- Phase 2.10: Process Library
-- Migration 00007

-- ============================================================
-- Processes table
-- ============================================================

CREATE TABLE processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  content jsonb NOT NULL DEFAULT '{}',
  trigger_conditions text,
  linked_kpi_ids uuid[] DEFAULT '{}',
  linked_bet_ids uuid[] DEFAULT '{}',
  automation_level integer NOT NULL DEFAULT 0 CHECK (automation_level >= 0 AND automation_level <= 4),
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_processes_org ON processes(organization_id);
CREATE INDEX idx_processes_venture ON processes(venture_id);
CREATE INDEX idx_processes_owner ON processes(owner_id);
CREATE INDEX idx_processes_lifecycle ON processes(organization_id, lifecycle_status);

ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes FORCE ROW LEVEL SECURITY;

-- Org-scoped select: any org member can read
CREATE POLICY "processes_select" ON processes FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Org-scoped insert: any org member can create
CREATE POLICY "processes_insert" ON processes FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Org-scoped update: any org member can update
CREATE POLICY "processes_update" ON processes FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Delete: admin or manager only
CREATE POLICY "processes_delete" ON processes FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  )
);

CREATE TRIGGER processes_updated_at BEFORE UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Process Versions table (every edit = new version)
-- ============================================================

CREATE TABLE process_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL,
  name text NOT NULL,
  description text,
  trigger_conditions text,
  changed_by uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_process_versions_process ON process_versions(process_id);
CREATE INDEX idx_process_versions_version ON process_versions(process_id, version DESC);

ALTER TABLE process_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_versions FORCE ROW LEVEL SECURITY;

-- Org-scoped via parent process
CREATE POLICY "process_versions_select" ON process_versions FOR SELECT USING (
  process_id IN (
    SELECT id FROM processes WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "process_versions_insert" ON process_versions FOR INSERT WITH CHECK (
  process_id IN (
    SELECT id FROM processes WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);
