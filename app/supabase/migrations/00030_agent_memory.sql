-- 00030_agent_memory.sql
-- Persistent per-agent memory backed by Supabase, synced to VPS filesystem.
-- core  = MEMORY.md equivalent (agent-learned observations, patterns, conventions)
-- user  = USER.md equivalent (per-org user interaction preferences)
-- session = session summaries and key learnings from individual runs

CREATE TABLE agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('core', 'user', 'session')),
  key text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, memory_type, key)
);

-- Indexes
CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_id);
CREATE INDEX idx_agent_memory_org ON agent_memory(organization_id);
CREATE INDEX idx_agent_memory_type ON agent_memory(agent_id, memory_type);

-- RLS
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory FORCE ROW LEVEL SECURITY;

-- Admin/manager can read agent memories
CREATE POLICY "agent_memory_select" ON agent_memory
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Admin can update (manual memory editing from UI)
CREATE POLICY "agent_memory_update" ON agent_memory
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can delete
CREATE POLICY "agent_memory_delete" ON agent_memory
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert via service role only (Hermes writes through MCP / sync endpoint)
-- No authenticated user insert policy needed

-- Auto-increment version on update
CREATE OR REPLACE FUNCTION increment_memory_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_memory_increment_version
  BEFORE UPDATE ON agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION increment_memory_version();

-- Updated_at trigger
CREATE TRIGGER agent_memory_updated_at
  BEFORE UPDATE ON agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
