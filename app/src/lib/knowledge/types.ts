import type {
  KnowledgeSourceType,
  KnowledgeDocumentType,
  Citation,
} from "@/types/database";

/** Shape returned by the search_knowledge_chunks RPC */
export interface KnowledgeSearchRow {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content_text: string;
  snippet_text: string | null;
  anchor_label: string | null;
  rank: number;
  document_title: string;
  document_type: KnowledgeDocumentType;
  entity_type: string | null;
  entity_id: string | null;
  canonical_url: string | null;
  source_id: string;
  source_name: string;
  source_type: KnowledgeSourceType;
  updated_from_source_at: string | null;
}

/** Search result with citation payload, ready for UI consumption */
export interface KnowledgeSearchResult {
  documentId: string;
  chunkId: string;
  title: string;
  snippet: string;
  sourceType: KnowledgeSourceType;
  sourceTitle: string;
  sourceHref: string | null;
  entityType: string | null;
  entityId: string | null;
  freshness: string | null;
  score: number;
  citation: Citation;
}

/** Parameters for knowledge search */
export interface KnowledgeSearchParams {
  orgId: string;
  query: string;
  ventureId?: string;
  sourceTypes?: KnowledgeSourceType[];
  limit?: number;
}

/** Projector output: the normalized representation of an entity */
export interface ProjectedDocument {
  entityType: string;
  entityId: string;
  title: string;
  contentText: string;
  canonicalUrl: string;
  snippetText: string;
  anchorLabel: string;
  metadata: Record<string, unknown>;
}
