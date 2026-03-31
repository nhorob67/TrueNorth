-- 00038_shared_knowledge_layer.sql
-- Shared knowledge layer: normalized knowledge storage, chunked retrieval,
-- sync tracking, agent knowledge access, and full-text search.

-- Enable pgvector for embedding storage
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================
-- knowledge_sources — logical sources configured per organization
-- ============================================================

CREATE TABLE knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  name text NOT NULL,
  source_type text NOT NULL
    CHECK (source_type IN ('internal_entity', 'upload', 'web_page', 'connector')),
  connector_type text
    CHECK (connector_type IS NULL OR connector_type IN (
      'google_drive', 'notion', 'slack', 'github', 'web', 'pdf_upload'
    )),
  external_ref text,
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'error')),
  visibility text NOT NULL DEFAULT 'org'
    CHECK (visibility IN ('org', 'venture', 'restricted')),
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_sources_org ON knowledge_sources(organization_id);
CREATE INDEX idx_knowledge_sources_venture ON knowledge_sources(venture_id)
  WHERE venture_id IS NOT NULL;
CREATE INDEX idx_knowledge_sources_type ON knowledge_sources(source_type);
CREATE INDEX idx_knowledge_sources_status ON knowledge_sources(status);

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources FORCE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_sources_org_read" ON knowledge_sources
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "knowledge_sources_admin_insert" ON knowledge_sources
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "knowledge_sources_admin_update" ON knowledge_sources
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "knowledge_sources_admin_delete" ON knowledge_sources
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE TRIGGER knowledge_sources_updated_at
  BEFORE UPDATE ON knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- knowledge_documents — normalized retrievable documents
-- ============================================================

CREATE TABLE knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  document_type text NOT NULL
    CHECK (document_type IN ('entity', 'file', 'web_page', 'message_thread', 'generated_artifact')),
  entity_type text,
  entity_id uuid,
  title text NOT NULL,
  canonical_url text,
  content_text text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  permissions_scope jsonb NOT NULL DEFAULT '{}',
  checksum text,
  updated_from_source_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_documents_org ON knowledge_documents(organization_id);
CREATE INDEX idx_knowledge_documents_venture ON knowledge_documents(venture_id)
  WHERE venture_id IS NOT NULL;
CREATE INDEX idx_knowledge_documents_source ON knowledge_documents(source_id);
CREATE INDEX idx_knowledge_documents_entity ON knowledge_documents(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;
CREATE UNIQUE INDEX idx_knowledge_documents_entity_unique
  ON knowledge_documents(organization_id, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents_org_read" ON knowledge_documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Service role handles writes (via projectors and sync)
CREATE POLICY "knowledge_documents_service_write" ON knowledge_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Restrict the service policy to service role only
ALTER POLICY "knowledge_documents_service_write" ON knowledge_documents
  USING (auth.role() = 'service_role');

-- ============================================================
-- knowledge_chunks — chunked retrieval units for search
-- ============================================================

CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES ventures(id) ON DELETE SET NULL,
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content_text text NOT NULL,
  snippet_text text,
  token_count integer,
  embedding extensions.vector(1536),
  search_vector tsvector,
  anchor_label text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_chunks_org ON knowledge_chunks(organization_id);
CREATE INDEX idx_knowledge_chunks_document ON knowledge_chunks(document_id);
CREATE INDEX idx_knowledge_chunks_search ON knowledge_chunks USING gin(search_vector);
CREATE INDEX idx_knowledge_chunks_content_trgm ON knowledge_chunks
  USING gin(content_text gin_trgm_ops);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_chunks_org_read" ON knowledge_chunks
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "knowledge_chunks_service_write" ON knowledge_chunks
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-generate tsvector on insert/update
CREATE OR REPLACE FUNCTION knowledge_chunks_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_chunks_search_vector
  BEFORE INSERT OR UPDATE OF content_text ON knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION knowledge_chunks_search_vector_trigger();

-- ============================================================
-- knowledge_sync_runs — tracks ingestion/sync jobs
-- ============================================================

CREATE TABLE knowledge_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  documents_created integer NOT NULL DEFAULT 0,
  documents_updated integer NOT NULL DEFAULT 0,
  documents_deleted integer NOT NULL DEFAULT 0,
  error_message text,
  run_metadata jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_knowledge_sync_runs_org ON knowledge_sync_runs(organization_id);
CREATE INDEX idx_knowledge_sync_runs_source ON knowledge_sync_runs(source_id);
CREATE INDEX idx_knowledge_sync_runs_status ON knowledge_sync_runs(status);

ALTER TABLE knowledge_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sync_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_sync_runs_org_read" ON knowledge_sync_runs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "knowledge_sync_runs_service_write" ON knowledge_sync_runs
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- agent_knowledge_access — controls what knowledge an agent can use
-- ============================================================

CREATE TABLE agent_knowledge_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  access_mode text NOT NULL DEFAULT 'read'
    CHECK (access_mode IN ('read', 'read_citations_only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, source_id)
);

CREATE INDEX idx_agent_knowledge_access_org ON agent_knowledge_access(organization_id);
CREATE INDEX idx_agent_knowledge_access_agent ON agent_knowledge_access(agent_id);
CREATE INDEX idx_agent_knowledge_access_source ON agent_knowledge_access(source_id);

ALTER TABLE agent_knowledge_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_access FORCE ROW LEVEL SECURITY;

CREATE POLICY "agent_knowledge_access_org_read" ON agent_knowledge_access
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_knowledge_access_admin_write" ON agent_knowledge_access
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- Helper: full-text search function for knowledge chunks
-- ============================================================

CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  p_org_id uuid,
  p_query text,
  p_venture_id uuid DEFAULT NULL,
  p_source_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_index integer,
  content_text text,
  snippet_text text,
  anchor_label text,
  rank real,
  document_title text,
  document_type text,
  entity_type text,
  entity_id uuid,
  canonical_url text,
  source_id uuid,
  source_name text,
  source_type text,
  updated_from_source_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kd.id AS document_id,
    kc.chunk_index,
    kc.content_text,
    kc.snippet_text,
    kc.anchor_label,
    ts_rank(kc.search_vector, websearch_to_tsquery('english', p_query)) AS rank,
    kd.title AS document_title,
    kd.document_type,
    kd.entity_type,
    kd.entity_id,
    kd.canonical_url,
    ks.id AS source_id,
    ks.name AS source_name,
    ks.source_type,
    kd.updated_from_source_at
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  JOIN knowledge_sources ks ON ks.id = kd.source_id
  WHERE kc.organization_id = p_org_id
    AND ks.status = 'active'
    AND (p_venture_id IS NULL OR kc.venture_id = p_venture_id)
    AND (p_source_types IS NULL OR ks.source_type = ANY(p_source_types))
    AND kc.search_vector @@ websearch_to_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
