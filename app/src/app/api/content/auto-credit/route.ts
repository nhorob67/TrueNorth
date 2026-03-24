import { createClient } from "@/lib/supabase/server";
import { creditRecurringMoveForContent } from "@/lib/content-auto-credit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { contentPieceId } = body as { contentPieceId?: string };

  if (!contentPieceId) {
    return NextResponse.json(
      { error: "contentPieceId is required" },
      { status: 400 }
    );
  }

  // Verify the user has access to this content piece via org membership
  const { data: piece } = await supabase
    .from("content_pieces")
    .select("organization_id")
    .eq("id", contentPieceId)
    .single();

  if (!piece) {
    return NextResponse.json(
      { error: "Content piece not found" },
      { status: 404 }
    );
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("organization_id", piece.organization_id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Not authorized for this organization" },
      { status: 403 }
    );
  }

  const result = await creditRecurringMoveForContent(supabase, contentPieceId);

  return NextResponse.json(result);
}
