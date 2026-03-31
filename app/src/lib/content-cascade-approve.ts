import { SupabaseClient } from "@supabase/supabase-js";

interface CascadeVariant {
  machine_type: string;
  title: string;
  body_markdown: string;
  cta?: { text: string; url_slug: string };
  word_count?: number;
}

interface CascadeOutput {
  source_piece_id: string;
  campaign_name: string;
  variants: CascadeVariant[];
}

/**
 * Convert markdown text to a minimal Tiptap document structure.
 * Produces paragraph nodes split on double newlines.
 */
function markdownToTiptapDoc(markdown: string): Record<string, unknown> {
  const paragraphs = markdown.split(/\n\n+/).filter(Boolean);

  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text: text.trim() }],
    })),
  };
}

/**
 * Approve a Content Cascade task and create content_pieces from the variants.
 *
 * Each variant becomes a content_piece in "drafting" status, linked to the
 * source piece via cascade_source_id and grouped via campaign_name.
 *
 * Returns the IDs of the newly created pieces.
 */
export async function approveCascadeVariants(
  supabase: SupabaseClient,
  taskId: string
): Promise<{ createdPieceIds: string[]; error?: string }> {
  // Fetch the agent task
  const { data: task, error: taskErr } = await supabase
    .from("agent_tasks")
    .select("id, organization_id, venture_id, output_data, entity_id")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return { createdPieceIds: [], error: "Task not found" };
  }

  const structured = (task.output_data as Record<string, unknown>)?.structured as CascadeOutput | undefined;
  if (!structured?.variants?.length) {
    return { createdPieceIds: [], error: "No variants found in task output" };
  }

  const sourcePieceId = structured.source_piece_id ?? task.entity_id;
  const campaignName = structured.campaign_name ?? "Cascade";

  // Fetch the source piece to get the owner
  const { data: sourcePiece } = await supabase
    .from("content_pieces")
    .select("owner_id")
    .eq("id", sourcePieceId)
    .single();

  const createdPieceIds: string[] = [];

  for (const variant of structured.variants) {
    const bodyJson = markdownToTiptapDoc(variant.body_markdown ?? "");

    const { data: piece, error: insertErr } = await supabase
      .from("content_pieces")
      .insert({
        organization_id: task.organization_id,
        venture_id: task.venture_id,
        title: variant.title,
        machine_type: variant.machine_type,
        lifecycle_status: "drafting",
        body_json: bodyJson,
        owner_id: sourcePiece?.owner_id ?? task.organization_id,
        campaign_name: campaignName,
        cascade_source_id: sourcePieceId,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(`Failed to create cascade variant "${variant.title}":`, insertErr.message);
      continue;
    }

    if (piece) {
      createdPieceIds.push(piece.id);
    }
  }

  // Mark the source piece as cascade completed
  if (sourcePieceId) {
    await supabase
      .from("content_pieces")
      .update({ cascade_status: "completed", campaign_name: campaignName })
      .eq("id", sourcePieceId);
  }

  return { createdPieceIds };
}
