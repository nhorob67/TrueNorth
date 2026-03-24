-- Meeting History Log
CREATE TABLE meeting_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  meeting_type text NOT NULL DEFAULT 'weekly_sync',
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  duration_seconds integer,
  output jsonb NOT NULL DEFAULT '{}',
  facilitator_id uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_logs_org ON meeting_logs(organization_id, started_at DESC);

ALTER TABLE meeting_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_logs FORCE ROW LEVEL SECURITY;

-- RLS: org-scoped select
CREATE POLICY "meeting_logs_select" ON meeting_logs FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);

-- RLS: org-scoped insert
CREATE POLICY "meeting_logs_insert" ON meeting_logs FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
);
