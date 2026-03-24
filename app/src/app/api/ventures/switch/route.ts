import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateUuid } from "@/lib/validation";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ventureId } = await request.json();
  if (!ventureId || !validateUuid(ventureId)) {
    return NextResponse.json({ error: "ventureId must be a valid UUID" }, { status: 400 });
  }

  // Verify user belongs to an org that owns this venture
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  const { data: venture } = await supabase
    .from("ventures")
    .select("id")
    .eq("id", ventureId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!venture) {
    return NextResponse.json({ error: "Venture not found or not accessible" }, { status: 404 });
  }

  // Set the cookie
  const cookieStore = await cookies();
  cookieStore.set("truenorth_venture_id", ventureId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return NextResponse.json({ success: true });
}
