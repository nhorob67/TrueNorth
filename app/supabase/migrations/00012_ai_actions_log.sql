-- ============================================================
-- AI Actions Log (Section 3.9 — AI Trust & Audit Dashboard)
-- ============================================================

CREATE TABLE ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_category text NOT NULL,
  action_type text NOT NULL,
  entity_id uuid,
  entity_type text,
  input_summary text,
  output_summary text,
  outcome text DEFAULT 'pending',
  override_reason text,
  confidence text,
  processing_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions FORCE ROW LEVEL SECURITY;

-- Org-scoped read
CREATE POLICY "ai_actions_select" ON ai_actions FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Org-scoped insert (members can insert via agent execution)
CREATE POLICY "ai_actions_insert" ON ai_actions FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Allow outcome updates (accept/override/ignore)
CREATE POLICY "ai_actions_update" ON ai_actions FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX idx_ai_actions_org ON ai_actions(organization_id);
CREATE INDEX idx_ai_actions_category ON ai_actions(agent_category);
CREATE INDEX idx_ai_actions_outcome ON ai_actions(outcome);
CREATE INDEX idx_ai_actions_created ON ai_actions(created_at DESC);
CREATE INDEX idx_ai_actions_org_created ON ai_actions(organization_id, created_at DESC);
