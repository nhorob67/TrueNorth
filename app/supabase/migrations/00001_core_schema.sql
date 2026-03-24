-- TrueNorth Core Schema: Multi-Tenant Foundation
-- Phase 0.3 — Organizations, Ventures, Users, Memberships

-- ============================================================
-- Shared Enums
-- ============================================================

CREATE TYPE org_role AS ENUM ('admin', 'manager', 'member', 'viewer');
CREATE TYPE venture_role AS ENUM ('admin', 'manager', 'member', 'viewer');
CREATE TYPE lifecycle_status AS ENUM ('active', 'paused', 'archived', 'completed');
CREATE TYPE health_status AS ENUM ('green', 'yellow', 'red');
CREATE TYPE entity_type AS ENUM (
  'bet', 'kpi', 'move', 'move_instance', 'idea', 'funnel',
  'decision', 'blocker', 'commitment', 'issue', 'process', 'content_piece'
);

-- ============================================================
-- Organizations
-- ============================================================

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Ventures
-- ============================================================

CREATE TABLE ventures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_ventures_org ON ventures(organization_id);

-- ============================================================
-- User Profiles (extends Supabase auth.users)
-- ============================================================

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Organization Memberships
-- ============================================================

CREATE TABLE organization_memberships (
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX idx_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);

-- ============================================================
-- Venture Memberships
-- ============================================================

CREATE TABLE venture_memberships (
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  role venture_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venture_id)
);

CREATE INDEX idx_venture_memberships_venture ON venture_memberships(venture_id);
CREATE INDEX idx_venture_memberships_user ON venture_memberships(user_id);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_memberships ENABLE ROW LEVEL SECURITY;

-- Organizations: visible to members
CREATE POLICY "org_select" ON organizations FOR SELECT USING (
  id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- Ventures: visible to org members
CREATE POLICY "venture_select" ON ventures FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- User profiles: users can read profiles in their orgs
CREATE POLICY "profile_select" ON user_profiles FOR SELECT USING (
  id IN (
    SELECT om2.user_id FROM organization_memberships om1
    JOIN organization_memberships om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
  )
);

-- User profiles: users can update their own
CREATE POLICY "profile_update" ON user_profiles FOR UPDATE USING (id = auth.uid());

-- User profiles: insert own profile on signup
CREATE POLICY "profile_insert" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Org memberships: visible to members of the same org
CREATE POLICY "org_membership_select" ON organization_memberships FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- Org memberships: admins can manage
CREATE POLICY "org_membership_manage" ON organization_memberships FOR ALL USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Venture memberships: visible to org members
CREATE POLICY "venture_membership_select" ON venture_memberships FOR SELECT USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  )
);

-- Venture memberships: org admins can manage
CREATE POLICY "venture_membership_manage" ON venture_memberships FOR ALL USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = auth.uid() AND om.role = 'admin'
  )
);

-- ============================================================
-- Policy Overrides (Phase 0 foundation for Policy Engine)
-- ============================================================

CREATE TABLE policy_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name text NOT NULL,
  overridden_by uuid NOT NULL REFERENCES user_profiles(id),
  justification text NOT NULL,
  entity_id uuid,
  entity_type entity_type,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE policy_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_override_select" ON policy_overrides FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE INDEX idx_policy_overrides_org ON policy_overrides(organization_id);

-- ============================================================
-- Audit Log (Phase 0.5 foundation)
-- ============================================================

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES user_profiles(id),
  action text NOT NULL,
  entity_id uuid,
  entity_type entity_type,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE INDEX idx_audit_log_org ON audit_log(organization_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- Seed Data Function (for dev)
-- ============================================================

-- Call: SELECT seed_dev_data();
CREATE OR REPLACE FUNCTION seed_dev_data()
RETURNS void AS $$
DECLARE
  org_id uuid;
  venture_id uuid;
BEGIN
  -- Create org
  INSERT INTO organizations (id, name, slug, settings)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Dev Organization', 'dev-org', '{}')
  ON CONFLICT DO NOTHING
  RETURNING id INTO org_id;

  IF org_id IS NULL THEN
    org_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  -- Create venture
  INSERT INTO ventures (id, organization_id, name, slug, settings)
  VALUES ('00000000-0000-0000-0000-000000000002', org_id, 'Dev Venture', 'dev-venture', '{}')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
