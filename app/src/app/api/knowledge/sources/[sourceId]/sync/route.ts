import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function POST(
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

    if (ctx.orgRole !== "admin" && ctx.orgRole !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify source belongs to this org
    const { data: source } = await supabase
      .from("knowledge_sources")
      .select("id, source_type, status")
      .eq("id", sourceId)
      .eq("organization_id", ctx.orgId)
      .single();

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Create a sync run record
    const { data: syncRun, error } = await supabase
      .from("knowledge_sync_runs")
      .insert({
        organization_id: ctx.orgId,
        source_id: sourceId,
        status: "queued",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating sync run:", error);
      return NextResponse.json({ error: "Failed to queue sync" }, { status: 500 });
    }

    // TODO: Trigger actual sync execution via connector framework
    // For now, return the queued sync run

    return NextResponse.json(syncRun, { status: 202 });
  } catch (error) {
    console.error("Sync trigger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
