-- TrueNorth Phase 1: The Heartbeat
-- KPIs, Pulses, Bets, Moves, Operational Objects

-- ============================================================
-- KPIs (Pillar 4)
-- ============================================================

CREATE TYPE kpi_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
CREATE TYPE kpi_tier AS ENUM ('tier1', 'tier2');
CREATE TYPE kpi_directionality AS ENUM ('up_is_good', 'down_is_good', 'target_is_good');

CREATE TABLE kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  unit text,
  frequency kpi_frequency NOT NULL DEFAULT 'weekly',
  tier kpi_tier NOT NULL DEFAULT 'tier2',
  directionality kpi_directionality NOT NULL DEFAULT 'up_is_good',
  aggregation_window text DEFAULT 'trailing_4',
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  target numeric,
  current_value numeric,
  health_status health_status NOT NULL DEFAULT 'green',
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'active',
  threshold_logic jsonb NOT NULL DEFAULT '{}',
  linked_driver_kpis uuid[] DEFAULT '{}',
  action_playbook jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpis_org ON kpis(organization_id);
CREATE INDEX idx_kpis_venture ON kpis(venture_id);
CREATE INDEX idx_kpis_owner ON kpis(owner_id);

ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpis_select" ON kpis FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "kpis_insert" ON kpis FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "kpis_update" ON kpis FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "kpis_delete" ON kpis FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- ============================================================
-- KPI Entries
-- ============================================================

CREATE TABLE kpi_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_entries_kpi ON kpi_entries(kpi_id);
CREATE INDEX idx_kpi_entries_recorded ON kpi_entries(kpi_id, recorded_at DESC);

ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_entries_select" ON kpi_entries FOR SELECT USING (
  kpi_id IN (
    SELECT id FROM kpis WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "kpi_entries_insert" ON kpi_entries FOR INSERT WITH CHECK (
  kpi_id IN (
    SELECT id FROM kpis WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================
-- Pulses (Pillar 5)
-- ============================================================

CREATE TABLE pulses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_pulses_org ON pulses(organization_id);
CREATE INDEX idx_pulses_user ON pulses(user_id);
CREATE INDEX idx_pulses_date ON pulses(organization_id, date DESC);

ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pulses_select" ON pulses FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "pulses_insert" ON pulses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pulses_update" ON pulses FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- Bets (Pillar 3)
-- ============================================================

CREATE TYPE bet_lifecycle AS ENUM ('active', 'paused', 'completed', 'killed');

CREATE TABLE bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  outcome text NOT NULL,
  mechanism text,
  lead_indicators uuid[] DEFAULT '{}',
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  proof_by_week6 text,
  kill_criteria text,
  resource_cap jsonb DEFAULT '{}',
  lifecycle_status bet_lifecycle NOT NULL DEFAULT 'active',
  health_status health_status NOT NULL DEFAULT 'green',
  quarter text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bets_org ON bets(organization_id);
CREATE INDEX idx_bets_venture ON bets(venture_id);
CREATE INDEX idx_bets_owner ON bets(owner_id);

ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bets_select" ON bets FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "bets_insert" ON bets FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "bets_update" ON bets FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "bets_delete" ON bets FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- ============================================================
-- Moves (Bet Execution Layer)
-- ============================================================

CREATE TYPE move_type AS ENUM ('milestone', 'recurring');
CREATE TYPE move_lifecycle AS ENUM ('not_started', 'in_progress', 'shipped', 'cut');

CREATE TABLE moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  bet_id uuid NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  type move_type NOT NULL DEFAULT 'milestone',
  title text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  lifecycle_status move_lifecycle NOT NULL DEFAULT 'not_started',
  health_status health_status NOT NULL DEFAULT 'green',
  due_date date,
  effort_estimate jsonb DEFAULT '{}',
  kpi_link_ids uuid[] DEFAULT '{}',
  content_machine_id uuid,
  cadence text,
  target_per_cycle integer,
  external_source jsonb,
  cut_reason text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moves_org ON moves(organization_id);
CREATE INDEX idx_moves_venture ON moves(venture_id);
CREATE INDEX idx_moves_bet ON moves(bet_id);
CREATE INDEX idx_moves_owner ON moves(owner_id);

ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moves_select" ON moves FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "moves_insert" ON moves FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "moves_update" ON moves FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "moves_delete" ON moves FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- ============================================================
-- Operational Objects: Decisions, Blockers, Commitments, Issues
-- ============================================================

-- Decisions (append-only after creation)
CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  title text NOT NULL,
  context text,
  options_considered jsonb DEFAULT '[]',
  final_decision text,
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  linked_entity_id uuid,
  linked_entity_type entity_type,
  decided_at timestamptz,
  supersedes_decision_id uuid REFERENCES decisions(id),
  audit_trail jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decisions_org ON decisions(organization_id);
CREATE INDEX idx_decisions_venture ON decisions(venture_id);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decisions_select" ON decisions FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "decisions_insert" ON decisions FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- Blockers
CREATE TYPE blocker_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE resolution_state AS ENUM ('open', 'resolved', 'wont_fix');

CREATE TABLE blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  description text NOT NULL,
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  severity blocker_severity NOT NULL DEFAULT 'medium',
  linked_entity_id uuid,
  linked_entity_type entity_type,
  resolution_state resolution_state NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blockers_org ON blockers(organization_id);
CREATE INDEX idx_blockers_venture ON blockers(venture_id);

ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blockers_select" ON blockers FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "blockers_insert" ON blockers FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "blockers_update" ON blockers FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- Commitments
CREATE TYPE commitment_status AS ENUM ('pending', 'completed', 'missed', 'cancelled');

CREATE TABLE commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  description text NOT NULL,
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  due_date date,
  linked_entity_id uuid,
  linked_entity_type entity_type,
  status commitment_status NOT NULL DEFAULT 'pending',
  created_in text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commitments_org ON commitments(organization_id);
CREATE INDEX idx_commitments_venture ON commitments(venture_id);

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commitments_select" ON commitments FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "commitments_insert" ON commitments FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "commitments_update" ON commitments FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- Issues
CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE issue_status AS ENUM ('open', 'investigating', 'resolved', 'closed');

CREATE TABLE issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  description text NOT NULL,
  owner_id uuid NOT NULL REFERENCES user_profiles(id),
  severity issue_severity NOT NULL DEFAULT 'medium',
  category text,
  linked_entity_id uuid,
  linked_entity_type entity_type,
  status issue_status NOT NULL DEFAULT 'open',
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_org ON issues(organization_id);
CREATE INDEX idx_issues_venture ON issues(venture_id);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issues_select" ON issues FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "issues_insert" ON issues FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "issues_update" ON issues FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- ============================================================
-- Updated At Trigger Function
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kpis_updated_at BEFORE UPDATE ON kpis FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pulses_updated_at BEFORE UPDATE ON pulses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bets_updated_at BEFORE UPDATE ON bets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER moves_updated_at BEFORE UPDATE ON moves FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER blockers_updated_at BEFORE UPDATE ON blockers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER commitments_updated_at BEFORE UPDATE ON commitments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER issues_updated_at BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
