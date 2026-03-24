-- TrueNorth Migration 00010: Missing Tables
-- Adds tables referenced by app code but not yet created in migrations:
-- ideas, role_cards, funnels, content_pieces, content_versions

-- ============================================================
-- Ideas (Pillar 2 — Idea Vault)
-- ============================================================

CREATE TYPE idea_classification AS ENUM ('more', 'better', 'new');
CREATE TYPE idea_lifecycle AS ENUM ('quarantine', 'filter_review', 'scoring', 'candidate', 'archived', 'selected');

CREATE TABLE ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  classification idea_classification,
  submitter_id uuid NOT NULL REFERENCES user_profiles(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  cooling_expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  lifecycle_status idea_lifecycle NOT NULL DEFAULT 'quarantine',
  filter_results jsonb NOT NULL DEFAULT '[]',
  score_alignment numeric,
  score_revenue numeric,
  score_effort numeric,
  score_total numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ideas_org ON ideas(organization_id);
CREATE INDEX idx_ideas_venture ON ideas(venture_id);
CREATE INDEX idx_ideas_submitter ON ideas(submitter_id);
CREATE INDEX idx_ideas_lifecycle ON ideas(organization_id, lifecycle_status);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas FORCE ROW LEVEL SECURITY;

CREATE POLICY "ideas_select" ON ideas FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "ideas_insert" ON ideas FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "ideas_update" ON ideas FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "ideas_delete" ON ideas FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);

CREATE TRIGGER ideas_updated_at BEFORE UPDATE ON ideas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Role Cards (Pillar 6)
-- ============================================================

CREATE TYPE role_card_entity_type AS ENUM ('user', 'agent');

CREATE TABLE role_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL,
  entity_type role_card_entity_type NOT NULL DEFAULT 'user',
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_assignments jsonb NOT NULL DEFAULT '[]',
  outcomes_owned jsonb NOT NULL DEFAULT '[]',
  metrics_moved jsonb NOT NULL DEFAULT '[]',
  decision_authority text NOT NULL DEFAULT '',
  interfaces text NOT NULL DEFAULT '',
  commitments_standard text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, entity_type, organization_id)
);

CREATE INDEX idx_role_cards_org ON role_cards(organization_id);
CREATE INDEX idx_role_cards_entity ON role_cards(entity_id);

ALTER TABLE role_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_cards FORCE ROW LEVEL SECURITY;

CREATE POLICY "role_cards_select" ON role_cards FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "role_cards_insert" ON role_cards FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "role_cards_update" ON role_cards FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "role_cards_delete" ON role_cards FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);

CREATE TRIGGER role_cards_updated_at BEFORE UPDATE ON role_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Funnels (Pillar 7 — Funnel Registry)
-- ============================================================

CREATE TYPE funnel_health AS ENUM ('healthy', 'underperforming', 'stalled', 'orphaned');

CREATE TABLE funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  name text NOT NULL,
  entry_point text NOT NULL DEFAULT '',
  capture_mechanism text NOT NULL DEFAULT '',
  nurture_sequence text NOT NULL DEFAULT '',
  conversion_event text NOT NULL DEFAULT '',
  scoreboard_tie jsonb NOT NULL DEFAULT '[]',
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'active',
  health_status funnel_health NOT NULL DEFAULT 'healthy',
  last_result_at timestamptz,
  linked_idea_id uuid REFERENCES ideas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnels_org ON funnels(organization_id);
CREATE INDEX idx_funnels_venture ON funnels(venture_id);
CREATE INDEX idx_funnels_owner ON funnels(owner_id);
CREATE INDEX idx_funnels_linked_idea ON funnels(linked_idea_id);

ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels FORCE ROW LEVEL SECURITY;

CREATE POLICY "funnels_select" ON funnels FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "funnels_insert" ON funnels FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "funnels_update" ON funnels FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "funnels_delete" ON funnels FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);

CREATE TRIGGER funnels_updated_at BEFORE UPDATE ON funnels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Content Pieces (Pillar 7 — Content Machines)
-- ============================================================

CREATE TYPE content_machine_type AS ENUM ('newsletter', 'deep_content', 'short_form', 'live_event');
CREATE TYPE content_lifecycle AS ENUM ('ideation', 'drafting', 'review', 'scheduled', 'published');

CREATE TABLE content_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  title text NOT NULL,
  machine_type content_machine_type NOT NULL DEFAULT 'deep_content',
  lifecycle_status content_lifecycle NOT NULL DEFAULT 'ideation',
  body_json jsonb NOT NULL DEFAULT '{}',
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  scheduled_at timestamptz,
  linked_funnel_id uuid REFERENCES funnels(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_pieces_org ON content_pieces(organization_id);
CREATE INDEX idx_content_pieces_venture ON content_pieces(venture_id);
CREATE INDEX idx_content_pieces_owner ON content_pieces(owner_id);
CREATE INDEX idx_content_pieces_lifecycle ON content_pieces(organization_id, lifecycle_status);
CREATE INDEX idx_content_pieces_scheduled ON content_pieces(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_content_pieces_funnel ON content_pieces(linked_funnel_id);

ALTER TABLE content_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pieces FORCE ROW LEVEL SECURITY;

CREATE POLICY "content_pieces_select" ON content_pieces FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "content_pieces_insert" ON content_pieces FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "content_pieces_update" ON content_pieces FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);
CREATE POLICY "content_pieces_delete" ON content_pieces FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);

CREATE TRIGGER content_pieces_updated_at BEFORE UPDATE ON content_pieces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Content Versions (Version History for Content Pieces)
-- ============================================================

CREATE TABLE content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_piece_id uuid NOT NULL REFERENCES content_pieces(id) ON DELETE CASCADE,
  body_json jsonb NOT NULL DEFAULT '{}',
  body_html text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_versions_piece ON content_versions(content_piece_id, created_at DESC);
CREATE INDEX idx_content_versions_author ON content_versions(created_by);

ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY "content_versions_select" ON content_versions FOR SELECT TO authenticated USING (
  content_piece_id IN (
    SELECT id FROM content_pieces WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "content_versions_insert" ON content_versions FOR INSERT TO authenticated WITH CHECK (
  content_piece_id IN (
    SELECT id FROM content_pieces WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

-- ============================================================
-- Add 'todo' to entity_type enum (if not already present)
-- ============================================================

-- The entity_type enum from 00001 doesn't include 'todo'; add it for completeness
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'todo' AND enumtypid = 'entity_type'::regtype) THEN
    ALTER TYPE entity_type ADD VALUE 'todo';
  END IF;
END
$$;
