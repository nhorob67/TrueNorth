import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const userSupabase = await createClient();
  const serviceSupabase = createServiceClient();

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invite, error } = await serviceSupabase
    .from("invites")
    .select("id, email, role, organization_id, venture_id, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 410 });
  }

  if (!user.email || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You must sign in with the invited email address" },
      { status: 403 }
    );
  }

  const { error: orgMembershipError } = await serviceSupabase
    .from("organization_memberships")
    .upsert(
      {
        user_id: user.id,
        organization_id: invite.organization_id,
        role: invite.role,
      },
      {
        onConflict: "user_id,organization_id",
        ignoreDuplicates: false,
      }
    );

  if (orgMembershipError) {
    return NextResponse.json(
      { error: `Failed to join organization: ${orgMembershipError.message}` },
      { status: 500 }
    );
  }

  const { error: ventureMembershipError } = await serviceSupabase
    .from("venture_memberships")
    .upsert(
      {
        user_id: user.id,
        venture_id: invite.venture_id,
        role: invite.role,
      },
      {
        onConflict: "user_id,venture_id",
        ignoreDuplicates: false,
      }
    );

  if (ventureMembershipError) {
    return NextResponse.json(
      { error: `Failed to join venture: ${ventureMembershipError.message}` },
      { status: 500 }
    );
  }

  const { error: acceptError } = await serviceSupabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (acceptError) {
    return NextResponse.json(
      { error: `Failed to accept invite: ${acceptError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
