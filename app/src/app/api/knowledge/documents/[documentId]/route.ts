import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: document, error } = await supabase
      .from("knowledge_documents")
      .select("*, knowledge_sources(name, source_type)")
      .eq("id", documentId)
      .eq("organization_id", ctx.orgId)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Fetch chunks for this document
    const { data: chunks } = await supabase
      .from("knowledge_chunks")
      .select("id, chunk_index, snippet_text, anchor_label, token_count")
      .eq("document_id", documentId)
      .order("chunk_index");

    return NextResponse.json({
      ...document,
      chunks: chunks ?? [],
    });
  } catch (error) {
    console.error("Knowledge document detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
