import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, bodyHtml, narrativeType } = body as {
      title: string;
      bodyHtml: string;
      narrativeType: string;
    };

    if (!title || !bodyHtml) {
      return NextResponse.json(
        { error: "title and bodyHtml are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("content_pieces")
      .insert({
        organization_id: ctx.orgId,
        venture_id: ctx.ventureId,
        title,
        machine_type: "flagship_newsletter",
        lifecycle_status: "drafting",
        body_json: {
          content: bodyHtml,
          source: "narrative_studio",
          narrative_type: narrativeType ?? null,
        },
        owner_id: ctx.userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to save content piece:", error);
      return NextResponse.json(
        { error: "Failed to save content piece" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("Save as content error:", error);
    return NextResponse.json(
      { error: "Failed to save as content piece" },
      { status: 500 }
    );
  }
}
