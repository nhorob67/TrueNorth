-- 00033_agent_skills.sql
-- Agent skills registry for Hermes integration.
-- Skills are procedural knowledge that agents learn from experience.
-- Auto-generated skills arrive with approved=false for admin review.
-- Shared skills are visible to all agents in the organization.

CREATE TABLE agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_profile text NOT NULL,
  skill_name text NOT NULL,
  skill_description text,
  skill_content text NOT NULL,
  auto_generated boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  shared boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'vps_sync', 'auto_generated')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, agent_profile, skill_name)
);

-- Indexes
CREATE INDEX idx_agent_skills_org ON agent_skills(organization_id);
CREATE INDEX idx_agent_skills_profile ON agent_skills(agent_profile);
CREATE INDEX idx_agent_skills_approved ON agent_skills(approved);
CREATE INDEX idx_agent_skills_shared ON agent_skills(shared) WHERE shared = true;

-- RLS
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills FORCE ROW LEVEL SECURITY;

-- All org members can read skills
CREATE POLICY "agent_skills_org_read" ON agent_skills
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Admin can insert (manual skill creation from UI)
CREATE POLICY "agent_skills_admin_insert" ON agent_skills
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update (approve, edit, share)
CREATE POLICY "agent_skills_admin_update" ON agent_skills
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can delete
CREATE POLICY "agent_skills_admin_delete" ON agent_skills
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-increment version on update
CREATE OR REPLACE FUNCTION increment_skill_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.skill_content IS DISTINCT FROM NEW.skill_content THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_skills_increment_version
  BEFORE UPDATE ON agent_skills
  FOR EACH ROW
  EXECUTE FUNCTION increment_skill_version();

-- Updated_at trigger
CREATE TRIGGER agent_skills_updated_at
  BEFORE UPDATE ON agent_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
