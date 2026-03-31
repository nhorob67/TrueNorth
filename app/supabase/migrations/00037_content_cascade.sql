-- Content Cascade: track cascade lineage and status on content_pieces
ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS cascade_source_id uuid REFERENCES content_pieces(id) ON DELETE SET NULL;
ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS cascade_status text CHECK (cascade_status IN ('pending', 'running', 'completed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_content_pieces_cascade_source ON content_pieces(cascade_source_id) WHERE cascade_source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_pieces_cascade_status ON content_pieces(cascade_status) WHERE cascade_status IS NOT NULL;
