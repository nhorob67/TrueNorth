import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkContent } from "./chunking";
import type { ProjectedDocument } from "./types";
import crypto from "crypto";

/**
 * Index a single projected entity into the knowledge layer.
 * Handles upsert of document + chunks with checksum-based change detection.
 */
export async function indexInternalEntity(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string,
  sourceId: string,
  projected: ProjectedDocument
) {
  const checksum = crypto
    .createHash("md5")
    .update(projected.contentText)
    .digest("hex");

  // Check if document already exists for this entity
  const { data: existing } = await supabase
    .from("knowledge_documents")
    .select("id, checksum")
    .eq("organization_id", orgId)
    .eq("entity_type", projected.entityType)
    .eq("entity_id", projected.entityId)
    .single();

  if (existing && existing.checksum === checksum) {
    // Content unchanged, skip
    return { action: "skipped" as const, documentId: existing.id };
  }

  const now = new Date().toISOString();

  if (existing) {
    // Update existing document
    await supabase
      .from("knowledge_documents")
      .update({
        title: projected.title,
        canonical_url: projected.canonicalUrl,
        content_text: projected.contentText,
        metadata: projected.metadata,
        checksum,
        updated_from_source_at: now,
        indexed_at: now,
      })
      .eq("id", existing.id);

    // Delete old chunks and re-create
    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", existing.id);

    const chunks = chunkContent(projected.contentText);
    if (chunks.length > 0) {
      await supabase.from("knowledge_chunks").insert(
        chunks.map((chunk) => ({
          organization_id: orgId,
          venture_id: ventureId,
          document_id: existing.id,
          chunk_index: chunk.index,
          content_text: chunk.content,
          snippet_text: chunk.snippet,
          token_count: chunk.tokenEstimate,
          anchor_label: projected.anchorLabel,
          metadata: {},
        }))
      );
    }

    return { action: "updated" as const, documentId: existing.id };
  }

  // Insert new document
  const { data: doc, error } = await supabase
    .from("knowledge_documents")
    .insert({
      organization_id: orgId,
      venture_id: ventureId,
      source_id: sourceId,
      document_type: "entity",
      entity_type: projected.entityType,
      entity_id: projected.entityId,
      title: projected.title,
      canonical_url: projected.canonicalUrl,
      content_text: projected.contentText,
      metadata: projected.metadata,
      checksum,
      updated_from_source_at: now,
      indexed_at: now,
    })
    .select("id")
    .single();

  if (error || !doc) {
    console.error("Failed to insert knowledge document:", error);
    return { action: "error" as const, documentId: null };
  }

  const chunks = chunkContent(projected.contentText);
  if (chunks.length > 0) {
    await supabase.from("knowledge_chunks").insert(
      chunks.map((chunk) => ({
        organization_id: orgId,
        venture_id: ventureId,
        document_id: doc.id,
        chunk_index: chunk.index,
        content_text: chunk.content,
        snippet_text: chunk.snippet,
        token_count: chunk.tokenEstimate,
        anchor_label: projected.anchorLabel,
        metadata: {},
      }))
    );
  }

  return { action: "created" as const, documentId: doc.id };
}
