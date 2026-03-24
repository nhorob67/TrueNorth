-- TrueNorth Migration 00005: Postgres Best Practices Fixes
-- Addresses: RLS performance, missing FK indexes, policy scoping,
-- partial indexes, FORCE RLS, uuid[] → junction tables, search_path

-- ============================================================
-- 1. FORCE ROW LEVEL SECURITY on all tables
-- ============================================================

ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE ventures FORCE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE venture_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE policy_overrides FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE kpis FORCE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE pulses FORCE ROW LEVEL SECURITY;
ALTER TABLE bets FORCE ROW LEVEL SECURITY;
ALTER TABLE moves FORCE ROW LEVEL SECURITY;
ALTER TABLE decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE blockers FORCE ROW LEVEL SECURITY;
ALTER TABLE commitments FORCE ROW LEVEL SECURITY;
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
ALTER TABLE comments FORCE ROW LEVEL SECURITY;
ALTER TABLE todos FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Missing Foreign Key Indexes
-- ============================================================

CREATE INDEX idx_decisions_owner ON decisions(owner_id);
CREATE INDEX idx_decisions_supersedes ON decisions(supersedes_decision_id);
CREATE INDEX idx_blockers_owner ON blockers(owner_id);
CREATE INDEX idx_commitments_owner ON commitments(owner_id);
CREATE INDEX idx_issues_owner ON issues(owner_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_invites_invited_by ON invites(invited_by);
CREATE INDEX idx_invites_venture ON invites(venture_id);
CREATE INDEX idx_policy_overrides_overridden_by ON policy_overrides(overridden_by);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);

-- ============================================================
-- 3. Partial Indexes for Common Status Filters
-- ============================================================

CREATE INDEX idx_blockers_open ON blockers(organization_id) WHERE resolution_state = 'open';
CREATE INDEX idx_commitments_pending ON commitments(organization_id) WHERE status = 'pending';
CREATE INDEX idx_issues_open ON issues(organization_id) WHERE status IN ('open', 'investigating');
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE read = false;
CREATE INDEX idx_bets_active ON bets(organization_id) WHERE lifecycle_status = 'active';
CREATE INDEX idx_moves_active ON moves(organization_id, bet_id) WHERE lifecycle_status IN ('not_started', 'in_progress');

-- ============================================================
-- 4. Junction Tables to Replace uuid[] Columns
-- ============================================================

-- KPI driver links (replaces kpis.linked_driver_kpis)
CREATE TABLE kpi_driver_links (
  kpi_id uuid NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  driver_kpi_id uuid NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kpi_id, driver_kpi_id),
  CHECK (kpi_id <> driver_kpi_id)
);

CREATE INDEX idx_kpi_driver_links_driver ON kpi_driver_links(driver_kpi_id);

ALTER TABLE kpi_driver_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_driver_links FORCE ROW LEVEL SECURITY;

CREATE POLICY "kpi_driver_links_select" ON kpi_driver_links FOR SELECT TO authenticated USING (
  kpi_id IN (
    SELECT id FROM kpis WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "kpi_driver_links_insert" ON kpi_driver_links FOR INSERT TO authenticated WITH CHECK (
  kpi_id IN (
    SELECT id FROM kpis WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "kpi_driver_links_delete" ON kpi_driver_links FOR DELETE TO authenticated USING (
  kpi_id IN (
    SELECT id FROM kpis WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

-- Migrate existing data from array column
INSERT INTO kpi_driver_links (kpi_id, driver_kpi_id)
SELECT k.id, unnest(k.linked_driver_kpis)
FROM kpis k
WHERE k.linked_driver_kpis IS NOT NULL AND array_length(k.linked_driver_kpis, 1) > 0
ON CONFLICT DO NOTHING;

ALTER TABLE kpis DROP COLUMN linked_driver_kpis;

-- Bet lead indicator links (replaces bets.lead_indicators)
CREATE TABLE bet_indicator_links (
  bet_id uuid NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bet_id, kpi_id)
);

CREATE INDEX idx_bet_indicator_links_kpi ON bet_indicator_links(kpi_id);

ALTER TABLE bet_indicator_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_indicator_links FORCE ROW LEVEL SECURITY;

CREATE POLICY "bet_indicator_links_select" ON bet_indicator_links FOR SELECT TO authenticated USING (
  bet_id IN (
    SELECT id FROM bets WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "bet_indicator_links_insert" ON bet_indicator_links FOR INSERT TO authenticated WITH CHECK (
  bet_id IN (
    SELECT id FROM bets WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "bet_indicator_links_delete" ON bet_indicator_links FOR DELETE TO authenticated USING (
  bet_id IN (
    SELECT id FROM bets WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

-- Migrate existing data
INSERT INTO bet_indicator_links (bet_id, kpi_id)
SELECT b.id, unnest(b.lead_indicators)
FROM bets b
WHERE b.lead_indicators IS NOT NULL AND array_length(b.lead_indicators, 1) > 0
ON CONFLICT DO NOTHING;

ALTER TABLE bets DROP COLUMN lead_indicators;

-- Move KPI links (replaces moves.kpi_link_ids)
CREATE TABLE move_kpi_links (
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (move_id, kpi_id)
);

CREATE INDEX idx_move_kpi_links_kpi ON move_kpi_links(kpi_id);

ALTER TABLE move_kpi_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_kpi_links FORCE ROW LEVEL SECURITY;

CREATE POLICY "move_kpi_links_select" ON move_kpi_links FOR SELECT TO authenticated USING (
  move_id IN (
    SELECT id FROM moves WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "move_kpi_links_insert" ON move_kpi_links FOR INSERT TO authenticated WITH CHECK (
  move_id IN (
    SELECT id FROM moves WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);
CREATE POLICY "move_kpi_links_delete" ON move_kpi_links FOR DELETE TO authenticated USING (
  move_id IN (
    SELECT id FROM moves WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

-- Migrate existing data
INSERT INTO move_kpi_links (move_id, kpi_id)
SELECT m.id, unnest(m.kpi_link_ids)
FROM moves m
WHERE m.kpi_link_ids IS NOT NULL AND array_length(m.kpi_link_ids, 1) > 0
ON CONFLICT DO NOTHING;

ALTER TABLE moves DROP COLUMN kpi_link_ids;

-- ============================================================
-- 5. Recreate ALL RLS Policies with (select auth.uid()) + TO authenticated
-- ============================================================

-- ---- organizations ----
DROP POLICY "org_select" ON organizations;
CREATE POLICY "org_select" ON organizations FOR SELECT TO authenticated USING (
  id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- ventures ----
DROP POLICY "venture_select" ON ventures;
CREATE POLICY "venture_select" ON ventures FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- user_profiles ----
DROP POLICY "profile_select" ON user_profiles;
CREATE POLICY "profile_select" ON user_profiles FOR SELECT TO authenticated USING (
  id IN (
    SELECT om2.user_id FROM organization_memberships om1
    JOIN organization_memberships om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = (select auth.uid())
  )
);

DROP POLICY "profile_update" ON user_profiles;
CREATE POLICY "profile_update" ON user_profiles FOR UPDATE TO authenticated USING (id = (select auth.uid()));

DROP POLICY "profile_insert" ON user_profiles;
CREATE POLICY "profile_insert" ON user_profiles FOR INSERT TO authenticated WITH CHECK (id = (select auth.uid()));

-- ---- organization_memberships ----
DROP POLICY "org_membership_select" ON organization_memberships;
CREATE POLICY "org_membership_select" ON organization_memberships FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "org_membership_manage" ON organization_memberships;
CREATE POLICY "org_membership_manage" ON organization_memberships FOR ALL TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships
    WHERE user_id = (select auth.uid()) AND role = 'admin'
  )
);

-- ---- venture_memberships ----
DROP POLICY "venture_membership_select" ON venture_memberships;
CREATE POLICY "venture_membership_select" ON venture_memberships FOR SELECT TO authenticated USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = (select auth.uid())
  )
);

DROP POLICY "venture_membership_manage" ON venture_memberships;
CREATE POLICY "venture_membership_manage" ON venture_memberships FOR ALL TO authenticated USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = (select auth.uid()) AND om.role = 'admin'
  )
);

-- ---- policy_overrides ----
DROP POLICY "policy_override_select" ON policy_overrides;
CREATE POLICY "policy_override_select" ON policy_overrides FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- audit_log ----
DROP POLICY "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- kpis ----
DROP POLICY "kpis_select" ON kpis;
CREATE POLICY "kpis_select" ON kpis FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "kpis_insert" ON kpis;
CREATE POLICY "kpis_insert" ON kpis FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "kpis_update" ON kpis;
CREATE POLICY "kpis_update" ON kpis FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "kpis_delete" ON kpis;
CREATE POLICY "kpis_delete" ON kpis FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);

-- ---- kpi_entries ----
DROP POLICY "kpi_entries_select" ON kpi_entries;
CREATE POLICY "kpi_entries_select" ON kpi_entries FOR SELECT TO authenticated USING (
  kpi_id IN (
    SELECT id FROM kpis WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

DROP POLICY "kpi_entries_insert" ON kpi_entries;
CREATE POLICY "kpi_entries_insert" ON kpi_entries FOR INSERT TO authenticated WITH CHECK (
  kpi_id IN (
    SELECT id FROM kpis WHERE organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
    )
  )
);

-- ---- pulses ----
DROP POLICY "pulses_select" ON pulses;
CREATE POLICY "pulses_select" ON pulses FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "pulses_insert" ON pulses;
CREATE POLICY "pulses_insert" ON pulses FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY "pulses_update" ON pulses;
CREATE POLICY "pulses_update" ON pulses FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));

-- ---- bets ----
DROP POLICY "bets_select" ON bets;
CREATE POLICY "bets_select" ON bets FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "bets_insert" ON bets;
CREATE POLICY "bets_insert" ON bets FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "bets_update" ON bets;
CREATE POLICY "bets_update" ON bets FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "bets_delete" ON bets;
CREATE POLICY "bets_delete" ON bets FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);

-- ---- moves ----
DROP POLICY "moves_select" ON moves;
CREATE POLICY "moves_select" ON moves FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "moves_insert" ON moves;
CREATE POLICY "moves_insert" ON moves FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "moves_update" ON moves;
CREATE POLICY "moves_update" ON moves FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "moves_delete" ON moves;
CREATE POLICY "moves_delete" ON moves FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role IN ('admin', 'manager')
  )
);

-- ---- decisions ----
DROP POLICY "decisions_select" ON decisions;
CREATE POLICY "decisions_select" ON decisions FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "decisions_insert" ON decisions;
CREATE POLICY "decisions_insert" ON decisions FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- blockers ----
DROP POLICY "blockers_select" ON blockers;
CREATE POLICY "blockers_select" ON blockers FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "blockers_insert" ON blockers;
CREATE POLICY "blockers_insert" ON blockers FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "blockers_update" ON blockers;
CREATE POLICY "blockers_update" ON blockers FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- commitments ----
DROP POLICY "commitments_select" ON commitments;
CREATE POLICY "commitments_select" ON commitments FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "commitments_insert" ON commitments;
CREATE POLICY "commitments_insert" ON commitments FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "commitments_update" ON commitments;
CREATE POLICY "commitments_update" ON commitments FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- issues ----
DROP POLICY "issues_select" ON issues;
CREATE POLICY "issues_select" ON issues FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "issues_insert" ON issues;
CREATE POLICY "issues_insert" ON issues FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "issues_update" ON issues;
CREATE POLICY "issues_update" ON issues FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- comments ----
DROP POLICY "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

DROP POLICY "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
  AND author_id = (select auth.uid())
);

DROP POLICY "comments_update" ON comments;
CREATE POLICY "comments_update" ON comments FOR UPDATE TO authenticated USING (author_id = (select auth.uid()));

-- ---- todos ----
DROP POLICY "todos_select" ON todos;
CREATE POLICY "todos_select" ON todos FOR SELECT TO authenticated USING (
  user_id = (select auth.uid())
  OR (visibility = 'team' AND organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid())
  ))
);

DROP POLICY "todos_insert" ON todos;
CREATE POLICY "todos_insert" ON todos FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY "todos_update" ON todos;
CREATE POLICY "todos_update" ON todos FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY "todos_delete" ON todos;
CREATE POLICY "todos_delete" ON todos FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- ---- notifications ----
DROP POLICY "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()))
);

-- ---- invites ----
DROP POLICY "invites_select" ON invites;
CREATE POLICY "invites_select" ON invites FOR SELECT TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role = 'admin'
  )
);

DROP POLICY "invites_insert" ON invites;
CREATE POLICY "invites_insert" ON invites FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = (select auth.uid()) AND role = 'admin'
  )
);

-- ---- onboarding_progress ----
DROP POLICY "onboarding_select" ON onboarding_progress;
CREATE POLICY "onboarding_select" ON onboarding_progress FOR SELECT TO authenticated USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = (select auth.uid())
  )
);

DROP POLICY "onboarding_insert" ON onboarding_progress;
CREATE POLICY "onboarding_insert" ON onboarding_progress FOR INSERT TO authenticated WITH CHECK (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = (select auth.uid())
  )
);

DROP POLICY "onboarding_update" ON onboarding_progress;
CREATE POLICY "onboarding_update" ON onboarding_progress FOR UPDATE TO authenticated USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = (select auth.uid())
  )
);

-- ============================================================
-- 6. Fix SECURITY DEFINER Function: Set search_path
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_name text;
  org_slug text;
  new_org_id uuid;
  new_venture_id uuid;
  invite_record record;
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, full_name, avatar_url, settings)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    '{}'
  );

  -- Check for pending invite
  SELECT * INTO invite_record FROM public.invites
  WHERE email = NEW.email AND accepted_at IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF invite_record IS NOT NULL THEN
    -- Accept invite: join existing org + venture
    INSERT INTO public.organization_memberships (user_id, organization_id, role)
    VALUES (NEW.id, invite_record.organization_id, invite_record.role)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.venture_memberships (user_id, venture_id, role)
    VALUES (NEW.id, invite_record.venture_id, invite_record.role::text::public.venture_role)
    ON CONFLICT DO NOTHING;

    UPDATE public.invites SET accepted_at = now() WHERE id = invite_record.id;
  ELSE
    -- No invite: create new org + venture
    org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', 'My Organization');
    org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

    INSERT INTO public.organizations (name, slug, settings)
    VALUES (org_name, org_slug, '{}')
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_memberships (user_id, organization_id, role)
    VALUES (NEW.id, new_org_id, 'admin');

    INSERT INTO public.ventures (organization_id, name, slug, settings)
    VALUES (new_org_id, org_name, 'default', '{}')
    RETURNING id INTO new_venture_id;

    INSERT INTO public.venture_memberships (user_id, venture_id, role)
    VALUES (NEW.id, new_venture_id, 'admin');

    -- Initialize onboarding progress
    INSERT INTO public.onboarding_progress (venture_id, steps, current_step)
    VALUES (new_venture_id, '{}', 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
