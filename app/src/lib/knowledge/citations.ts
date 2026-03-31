import type { Citation } from "@/types/database";
import type { KnowledgeSearchRow } from "./types";

/**
 * Build a citation object from a knowledge search row.
 * Citations are serializable and reusable across product surfaces.
 */
export function buildCitation(row: KnowledgeSearchRow): Citation {
  return {
    id: `cite-${row.chunk_id}`,
    title: row.document_title,
    href: row.canonical_url,
    sourceType: row.source_type,
    sourceId: row.source_id,
    documentId: row.document_id,
    chunkId: row.chunk_id,
    snippet: row.snippet_text ?? truncateSnippet(row.content_text, 200),
    anchorLabel: row.anchor_label,
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Build numbered citation labels for a list of citations.
 * Returns citations with their display index (1-based).
 */
export function numberCitations(
  citations: Citation[]
): Array<Citation & { index: number }> {
  return citations.map((c, i) => ({ ...c, index: i + 1 }));
}

/**
 * Deduplicate citations by document ID, keeping the first occurrence.
 */
export function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = c.chunkId ?? c.documentId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function truncateSnippet(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}
