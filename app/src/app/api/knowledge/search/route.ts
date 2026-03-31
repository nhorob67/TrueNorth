import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { searchKnowledge } from "@/lib/knowledge/search";
import type { KnowledgeSourceType } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const sourceTypesParam = searchParams.get("source_types");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    if (query.length < 2) {
      return NextResponse.json([]);
    }

    const sourceTypes = sourceTypesParam
      ? (sourceTypesParam.split(",") as KnowledgeSourceType[])
      : undefined;

    const results = await searchKnowledge(supabase, {
      orgId: ctx.orgId,
      query,
      ventureId: ctx.ventureId,
      sourceTypes,
      limit,
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Knowledge search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
