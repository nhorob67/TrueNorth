import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { sourceId } = await params;
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .eq("organization_id", ctx.orgId)
      .single();

    if (error || !source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Fetch recent sync runs
    const { data: syncRuns } = await supabase
      .from("knowledge_sync_runs")
      .select("*")
      .eq("source_id", sourceId)
      .order("started_at", { ascending: false })
      .limit(10);

    // Fetch document count
    const { count } = await supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId);

    return NextResponse.json({
      ...source,
      sync_runs: syncRuns ?? [],
      document_count: count ?? 0,
    });
  } catch (error) {
    console.error("Knowledge source detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
