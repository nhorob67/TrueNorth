import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Content Machine → Recurring Move Auto-Credit
// ============================================================
// When a content piece reaches "published" status, this function
// finds a matching recurring move (linked via content_machine_id)
// in the same venture and auto-completes the oldest pending instance.

export interface AutoCreditResult {
  credited: boolean;
  moveId?: string;
  moveTitle?: string;
  instanceId?: string;
  reason?: string;
}

export async function creditRecurringMoveForContent(
  supabase: SupabaseClient,
  contentPieceId: string
): Promise<AutoCreditResult> {
  // 1. Fetch the content piece
  const { data: piece, error: pieceError } = await supabase
    .from("content_pieces")
    .select("id, machine_type, venture_id, lifecycle_status")
    .eq("id", contentPieceId)
    .single();

  if (pieceError || !piece) {
    return { credited: false, reason: "Content piece not found" };
  }

  if (piece.lifecycle_status !== "published") {
    return { credited: false, reason: "Content piece is not yet published" };
  }

  // 2. Find recurring moves in the same venture with a matching content_machine_id.
  //    The content_machine_id stores the machine_type string (e.g. "newsletter").
  const { data: moves, error: movesError } = await supabase
    .from("moves")
    .select("id, title")
    .eq("venture_id", piece.venture_id)
    .eq("type", "recurring")
    .eq("content_machine_id", piece.machine_type)
    .not("lifecycle_status", "eq", "cut");

  if (movesError || !moves || moves.length === 0) {
    return {
      credited: false,
      reason: `No recurring move linked to content machine "${piece.machine_type}" in this venture`,
    };
  }

  // Use the first matching move (typically one per machine type per venture)
  const move = moves[0];

  // 3. Find the oldest pending instance for this move
  const { data: instances, error: instanceError } = await supabase
    .from("move_instances")
    .select("id")
    .eq("move_id", move.id)
    .eq("status", "pending")
    .order("cycle_start", { ascending: true })
    .limit(1);

  if (instanceError || !instances || instances.length === 0) {
    return {
      credited: false,
      moveId: move.id,
      moveTitle: move.title,
      reason: "No pending instances to credit for this move",
    };
  }

  const instance = instances[0];

  // 4. Complete the instance and link it to the content piece
  const { error: updateError } = await supabase
    .from("move_instances")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      linked_entity_id: contentPieceId,
      linked_entity_type: "content_piece",
    })
    .eq("id", instance.id);

  if (updateError) {
    return {
      credited: false,
      moveId: move.id,
      moveTitle: move.title,
      reason: `Failed to update instance: ${updateError.message}`,
    };
  }

  return {
    credited: true,
    moveId: move.id,
    moveTitle: move.title,
    instanceId: instance.id,
  };
}
