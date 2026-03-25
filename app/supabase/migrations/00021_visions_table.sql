-- Vision Board tables (Pillar 1)
-- These were defined in types but never created in a migration.

-- ============================================================
-- Visions
-- ============================================================

CREATE TABLE visions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  bhag text NOT NULL DEFAULT '',
  strategic_filters jsonb NOT NULL DEFAULT '[]',
  annual_outcomes jsonb NOT NULL DEFAULT '[]',
  not_doing_list jsonb NOT NULL DEFAULT '[]',
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visions_venture ON visions(venture_id);
CREATE INDEX idx_visions_org ON visions(organization_id);

-- One active vision per venture per year
CREATE UNIQUE INDEX idx_visions_venture_year ON visions(venture_id, year);

ALTER TABLE visions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visions FORCE ROW LEVEL SECURITY;

CREATE POLICY "visions_select" ON visions FOR SELECT TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
  )
);
CREATE POLICY "visions_insert" ON visions FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
  )
);
CREATE POLICY "visions_update" ON visions FOR UPDATE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);
CREATE POLICY "visions_delete" ON visions FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role = 'admin'
  )
);

CREATE TRIGGER visions_updated_at BEFORE UPDATE ON visions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Vision Snapshots (version history)
-- ============================================================

CREATE TABLE vision_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id uuid NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vision_snapshots_vision ON vision_snapshots(vision_id);
CREATE INDEX idx_vision_snapshots_created ON vision_snapshots(vision_id, created_at DESC);

ALTER TABLE vision_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY "vision_snapshots_select" ON vision_snapshots FOR SELECT TO authenticated USING (
  vision_id IN (
    SELECT id FROM visions WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "vision_snapshots_insert" ON vision_snapshots FOR INSERT TO authenticated WITH CHECK (
  vision_id IN (
    SELECT id FROM visions WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
