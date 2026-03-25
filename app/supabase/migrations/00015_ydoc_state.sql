-- Add Y.Doc binary state column to content_pieces for Yjs collaboration persistence.
-- This stores the encoded Yjs document state so new clients can bootstrap from it.
ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS ydoc_state bytea;

COMMENT ON COLUMN content_pieces.ydoc_state IS 'Binary-encoded Yjs document state for real-time collaboration';
