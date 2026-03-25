-- Phase 1 Enhancements: Comments, Todos, Notifications, Invites, Onboarding

-- Required for gen_random_bytes() used in invite token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- Comments (Universal)
-- ============================================================

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  entity_type entity_type NOT NULL,
  author_id uuid NOT NULL REFERENCES user_profiles(id),
  body text NOT NULL,
  parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_org ON comments(organization_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON comments FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  AND author_id = auth.uid()
);
CREATE POLICY "comments_update" ON comments FOR UPDATE USING (author_id = auth.uid());

-- ============================================================
-- Todos (Personal)
-- ============================================================

CREATE TYPE todo_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE todo_visibility AS ENUM ('private', 'team');

CREATE TABLE todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  due_date date,
  priority todo_priority NOT NULL DEFAULT 'medium',
  linked_entity_id uuid,
  linked_entity_type entity_type,
  visibility todo_visibility NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_todos_user ON todos(user_id);
CREATE INDEX idx_todos_org ON todos(organization_id);
CREATE INDEX idx_todos_entity ON todos(linked_entity_type, linked_entity_id);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_select" ON todos FOR SELECT USING (
  user_id = auth.uid()
  OR (visibility = 'team' AND organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "todos_insert" ON todos FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "todos_update" ON todos FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "todos_delete" ON todos FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Notifications
-- ============================================================

CREATE TYPE notification_tier AS ENUM ('immediate', 'urgent', 'daily_digest', 'weekly_digest');

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  tier notification_tier NOT NULL DEFAULT 'daily_digest',
  title text NOT NULL,
  body text,
  entity_id uuid,
  entity_type entity_type,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_org ON notifications(organization_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- ============================================================
-- Invites
-- ============================================================

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  email text NOT NULL,
  role org_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES user_profiles(id),
  accepted_at timestamptz,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_org ON invites(organization_id);
CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_email ON invites(email);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select" ON invites FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "invites_insert" ON invites FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- Onboarding Progress
-- ============================================================

CREATE TABLE onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE UNIQUE,
  steps jsonb NOT NULL DEFAULT '{}',
  current_step integer NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_select" ON onboarding_progress FOR SELECT USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  )
);
CREATE POLICY "onboarding_insert" ON onboarding_progress FOR INSERT WITH CHECK (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  )
);
CREATE POLICY "onboarding_update" ON onboarding_progress FOR UPDATE USING (
  venture_id IN (
    SELECT v.id FROM ventures v
    JOIN organization_memberships om ON v.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  )
);

-- ============================================================
-- Schema Additions to Existing Tables
-- ============================================================

-- Add venture_id to pulses (nullable for single-venture auto-tagging)
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL;

-- Add pulse_streak to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pulse_streak integer NOT NULL DEFAULT 0;

-- ============================================================
-- Updated At Triggers for New Tables
-- ============================================================

CREATE TRIGGER todos_updated_at BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER onboarding_updated_at BEFORE UPDATE ON onboarding_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Update handle_new_user to check for pending invites
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
  INSERT INTO user_profiles (id, full_name, avatar_url, settings)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    '{}'
  );

  -- Check for pending invite
  SELECT * INTO invite_record FROM invites
  WHERE email = NEW.email AND accepted_at IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF invite_record IS NOT NULL THEN
    -- Accept invite: join existing org + venture
    INSERT INTO organization_memberships (user_id, organization_id, role)
    VALUES (NEW.id, invite_record.organization_id, invite_record.role)
    ON CONFLICT DO NOTHING;

    INSERT INTO venture_memberships (user_id, venture_id, role)
    VALUES (NEW.id, invite_record.venture_id, invite_record.role::text::venture_role)
    ON CONFLICT DO NOTHING;

    UPDATE invites SET accepted_at = now() WHERE id = invite_record.id;
  ELSE
    -- No invite: create new org + venture
    org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', 'My Organization');
    org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

    INSERT INTO organizations (name, slug, settings)
    VALUES (org_name, org_slug, '{}')
    RETURNING id INTO new_org_id;

    INSERT INTO organization_memberships (user_id, organization_id, role)
    VALUES (NEW.id, new_org_id, 'admin');

    INSERT INTO ventures (organization_id, name, slug, settings)
    VALUES (new_org_id, org_name, 'default', '{}')
    RETURNING id INTO new_venture_id;

    INSERT INTO venture_memberships (user_id, venture_id, role)
    VALUES (NEW.id, new_venture_id, 'admin');

    -- Initialize onboarding progress
    INSERT INTO onboarding_progress (venture_id, steps, current_step)
    VALUES (new_venture_id, '{}', 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
