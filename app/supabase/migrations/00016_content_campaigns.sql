-- Campaign grouping for content pieces.
-- Uses a simple text field rather than a separate table — campaigns are lightweight groupings.
ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS campaign_name text;

CREATE INDEX IF NOT EXISTS idx_content_pieces_campaign ON content_pieces(campaign_name) WHERE campaign_name IS NOT NULL;

COMMENT ON COLUMN content_pieces.campaign_name IS 'Optional campaign grouping name for aggregate tracking';
