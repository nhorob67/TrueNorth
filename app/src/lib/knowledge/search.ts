import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCitation } from "./citations";
import type {
  KnowledgeSearchParams,
  KnowledgeSearchResult,
  KnowledgeSearchRow,
} from "./types";

/**
 * Search the knowledge layer using Postgres full-text search.
 * Returns citation-ready results.
 */
export async function searchKnowledge(
  supabase: SupabaseClient,
  params: KnowledgeSearchParams
): Promise<KnowledgeSearchResult[]> {
  const { orgId, query, ventureId, sourceTypes, limit = 20 } = params;

  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc("search_knowledge_chunks", {
    p_org_id: orgId,
    p_query: query,
    p_venture_id: ventureId ?? null,
    p_source_types: sourceTypes ?? null,
    p_limit: limit,
  });

  if (error) {
    console.error("Knowledge search error:", error);
    return [];
  }

  const rows = (data ?? []) as KnowledgeSearchRow[];

  return rows.map((row) => ({
    documentId: row.document_id,
    chunkId: row.chunk_id,
    title: row.document_title,
    snippet:
      row.snippet_text ?? row.content_text.slice(0, 200).trimEnd() + "...",
    sourceType: row.source_type,
    sourceTitle: row.source_name,
    sourceHref: row.canonical_url,
    entityType: row.entity_type,
    entityId: row.entity_id,
    freshness: row.updated_from_source_at,
    score: row.rank,
    citation: buildCitation(row),
  }));
}

/**
 * Retrieve context blocks for AI prompt injection.
 * Returns formatted context with citation IDs for model consumption.
 */
export async function retrieveContextForAI(
  supabase: SupabaseClient,
  params: KnowledgeSearchParams
): Promise<{ context: string; citations: ReturnType<typeof buildCitation>[] }> {
  const results = await searchKnowledge(supabase, params);

  const citations = results.map((r) => r.citation);
  const contextBlocks = results.map(
    (r, i) =>
      `[${i + 1}] ${r.title} (${r.sourceType})\n${r.snippet}`
  );

  return {
    context: contextBlocks.join("\n\n"),
    citations,
  };
}
