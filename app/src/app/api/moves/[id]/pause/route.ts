import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

// ============================================================
// Pause / Resume a Recurring Move
//
// POST   /api/moves/:id/pause  — pauses the move (sets paused_at)
// DELETE /api/moves/:id/pause  — resumes the move (clears paused_at)
//
// Only works on recurring moves. Paused moves won't generate new
// instances and won't have missed detection run against them.
// ============================================================

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify the move exists, is recurring, and belongs to the user's org
    const { data: move, error: fetchError } = await supabase
      .from("moves")
      .select("id, type, organization_id, paused_at")
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .single();

    if (fetchError || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    if (move.type !== "recurring") {
      return NextResponse.json(
        { error: "Only recurring moves can be paused" },
        { status: 400 }
      );
    }

    if (move.paused_at) {
      return NextResponse.json(
        { error: "Move is already paused" },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("moves")
      .update({ paused_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Pause move error:", updateError);
      return NextResponse.json(
        { error: "Failed to pause move" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, paused: true });
  } catch (error) {
    console.error("Pause move error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify the move exists, is recurring, and belongs to the user's org
    const { data: move, error: fetchError } = await supabase
      .from("moves")
      .select("id, type, organization_id, paused_at")
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .single();

    if (fetchError || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    if (move.type !== "recurring") {
      return NextResponse.json(
        { error: "Only recurring moves can be resumed" },
        { status: 400 }
      );
    }

    if (!move.paused_at) {
      return NextResponse.json(
        { error: "Move is not paused" },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("moves")
      .update({ paused_at: null })
      .eq("id", id);

    if (updateError) {
      console.error("Resume move error:", updateError);
      return NextResponse.json(
        { error: "Failed to resume move" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, paused: false });
  } catch (error) {
    console.error("Resume move error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
