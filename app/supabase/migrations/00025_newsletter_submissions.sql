-- ============================================================
-- Newsletter Submissions from Discord
-- ============================================================
-- Captures newsletter ideas submitted via a designated Discord
-- channel. Ideas appear in the Content > Inbox UI for triage.
-- Accepted ideas become content_pieces in the Ideation stage.

-- ============================================================
-- Status enum
-- ============================================================

CREATE TYPE newsletter_submission_status AS ENUM ('pending', 'accepted', 'parked', 'dismissed');

-- ============================================================
-- Newsletter submissions table
-- ============================================================

CREATE TABLE newsletter_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  submitter_discord_id text NOT NULL,
  submitter_discord_name text NOT NULL,
  discord_message_id text NOT NULL UNIQUE,
  discord_channel_id text NOT NULL,
  status newsletter_submission_status NOT NULL DEFAULT 'pending',
  triaged_by uuid REFERENCES user_profiles(id),
  triaged_at timestamptz,
  content_piece_id uuid REFERENCES content_pieces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_newsletter_sub_org ON newsletter_submissions(organization_id);
CREATE INDEX idx_newsletter_sub_status ON newsletter_submissions(organization_id, status);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE newsletter_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_submissions FORCE ROW LEVEL SECURITY;

-- Members can view submissions for their org
CREATE POLICY "newsletter_sub_select" ON newsletter_submissions FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Members can triage (update status)
CREATE POLICY "newsletter_sub_update" ON newsletter_submissions FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
  )
);

-- Insert via service role only (Discord bot uses service role key)

-- ============================================================
-- Updated_at trigger
-- ============================================================

CREATE TRIGGER newsletter_submissions_updated_at
  BEFORE UPDATE ON newsletter_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
