import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { reindexOrganization } from "@/lib/knowledge/reindex-organization";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (ctx.orgRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await reindexOrganization(supabase, ctx.orgId, ctx.ventureId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Reindex error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
