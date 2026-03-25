import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Collaboration API: Load / Persist Y.Doc state
//
// GET  /api/collaboration/[documentId] → load ydoc_state + body_json
// PUT  /api/collaboration/[documentId] → persist ydoc_state
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("content_pieces")
    .select("ydoc_state, body_json")
    .eq("id", documentId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ydocState: data.ydoc_state ?? null,
    bodyJson: data.body_json ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { ydocState } = body;

  if (!ydocState) {
    return NextResponse.json({ error: "Missing ydocState" }, { status: 400 });
  }

  // Persist the Y.Doc binary state
  const { error } = await supabase
    .from("content_pieces")
    .update({
      ydoc_state: ydocState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    console.error("Failed to update document:", error.message);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
