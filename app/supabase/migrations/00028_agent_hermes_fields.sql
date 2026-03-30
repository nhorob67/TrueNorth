-- 00028_agent_hermes_fields.sql
-- Extend agents table with Hermes runtime integration fields.
-- Supports: SOUL.md content, profile mapping, runtime metadata,
-- connection liveness, and capability declarations.

-- SOUL.md content synced to VPS
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_content text;

-- Hermes profile name on VPS (e.g., 'kill-switch', 'signal-watch')
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hermes_profile_name text;

-- Whether this agent runs via Hermes (true) or legacy Claude API (false)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hermes_enabled boolean NOT NULL DEFAULT false;

-- Runtime type: worker (task execution), gateway (interactive), orchestrator (delegation)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hermes_runtime text;

-- Source mode: legacy (Claude API only), hermes (Hermes only), hybrid (both available)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hermes_source text NOT NULL DEFAULT 'legacy';

-- Declared capabilities for routing and UI display
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '[]';

-- Liveness tracking
ALTER TABLE agents ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'offline';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

-- Currently executing task (FK added in 00031 after agent_tasks exists)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS current_task_id uuid;

-- Last error message from the Hermes runtime
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_error text;

-- Index for profile lookup
CREATE INDEX IF NOT EXISTS idx_agents_hermes_profile ON agents(hermes_profile_name)
  WHERE hermes_profile_name IS NOT NULL;

-- Index for connection status filtering
CREATE INDEX IF NOT EXISTS idx_agents_connection_status ON agents(connection_status)
  WHERE hermes_enabled = true;

COMMENT ON COLUMN agents.soul_content IS 'Markdown SOUL.md content synced to VPS Hermes profile';
COMMENT ON COLUMN agents.hermes_profile_name IS 'Hermes profile directory name on VPS (e.g., signal-watch)';
COMMENT ON COLUMN agents.hermes_enabled IS 'Whether this agent runs via Hermes (true) or legacy Claude API (false)';
COMMENT ON COLUMN agents.hermes_runtime IS 'Runtime type: worker, gateway, or orchestrator';
COMMENT ON COLUMN agents.hermes_source IS 'Source mode: legacy, hermes, or hybrid';
COMMENT ON COLUMN agents.capabilities IS 'JSON array of capability strings for routing';
COMMENT ON COLUMN agents.connection_status IS 'Liveness: offline, idle, busy, or error';
COMMENT ON COLUMN agents.last_heartbeat_at IS 'Last heartbeat received from Hermes runtime';
COMMENT ON COLUMN agents.current_task_id IS 'UUID of currently executing agent_task (FK added later)';
COMMENT ON COLUMN agents.last_error IS 'Last error message from Hermes runtime';
