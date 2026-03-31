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

  const { data: ventureMembership } = await supabase
    .from("venture_memberships")
    .select("venture_id")
    .eq("user_id", user.id)
    .eq("venture_id", ventureId)
    .maybeSingle();

  if (!ventureMembership) {
    return NextResponse.json(
      { error: "Venture not found or not accessible" },
      { status: 404 }
    );
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
