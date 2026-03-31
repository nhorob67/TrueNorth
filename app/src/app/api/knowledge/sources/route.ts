import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: sources, error } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .order("name");

    if (error) {
      console.error("Error fetching sources:", error);
      return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
    }

    return NextResponse.json(sources ?? []);
  } catch (error) {
    console.error("Knowledge sources error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (ctx.orgRole !== "admin" && ctx.orgRole !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, source_type, connector_type, external_ref, config, visibility } = body;

    if (!name || !source_type) {
      return NextResponse.json(
        { error: "name and source_type are required" },
        { status: 400 }
      );
    }

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        organization_id: ctx.orgId,
        venture_id: ctx.ventureId,
        name,
        source_type,
        connector_type: connector_type ?? null,
        external_ref: external_ref ?? null,
        config: config ?? {},
        visibility: visibility ?? "org",
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating source:", error);
      return NextResponse.json({ error: "Failed to create source" }, { status: 500 });
    }

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Knowledge source creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
