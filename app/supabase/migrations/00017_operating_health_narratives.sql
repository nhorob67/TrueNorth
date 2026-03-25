-- ============================================================
-- Migration 00017: Operating Health Snapshots & Generated Narratives
-- Phase 4 — Behavioral Culture Metrics & AI Narrative Generator
-- ============================================================

-- Operating Health Snapshots
-- Stores periodic snapshots of the composite operating health score
-- and individual metrics for trend analysis over time.
CREATE TABLE IF NOT EXISTS operating_health_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  composite_score integer NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
  composite_status text NOT NULL CHECK (composite_status IN ('green', 'yellow', 'red')),
  metrics jsonb NOT NULL DEFAULT '{}',
  ai_interpretation text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_ohs_org ON operating_health_snapshots(organization_id);
CREATE INDEX idx_ohs_venture ON operating_health_snapshots(venture_id);
CREATE INDEX idx_ohs_created ON operating_health_snapshots(created_at DESC);

ALTER TABLE operating_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ohs_org_read" ON operating_health_snapshots
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ohs_org_insert" ON operating_health_snapshots
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Generated Narratives
-- Stores AI-generated narrative documents (weekly updates, board memos, etc.)
CREATE TYPE narrative_type AS ENUM (
  'weekly_team_update',
  'monthly_board_memo',
  'investor_update',
  'all_hands_talking_points',
  'quarterly_retrospective'
);

CREATE TABLE IF NOT EXISTS generated_narratives (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  narrative_type narrative_type NOT NULL,
  title text NOT NULL,
  body_json jsonb NOT NULL DEFAULT '{}',
  body_html text NOT NULL DEFAULT '',
  time_window_start date NOT NULL,
  time_window_end date NOT NULL,
  source_entity_ids uuid[] DEFAULT '{}',
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  generated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_gn_org ON generated_narratives(organization_id);
CREATE INDEX idx_gn_venture ON generated_narratives(venture_id);
CREATE INDEX idx_gn_type ON generated_narratives(narrative_type);
CREATE INDEX idx_gn_created ON generated_narratives(created_at DESC);

ALTER TABLE generated_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gn_org_read" ON generated_narratives
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "gn_org_insert" ON generated_narratives
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "gn_org_delete" ON generated_narratives
  FOR DELETE USING (
    generated_by = auth.uid()
  );
