import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: invite, error } = await supabase
    .from("invites")
    .select("id, email, role, organization_id, accepted_at, organizations(name)")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 410 });
  }

  const org = Array.isArray(invite.organizations)
    ? invite.organizations[0] ?? null
    : invite.organizations;

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    organizationId: invite.organization_id,
    organizationName: org?.name ?? "your team",
  });
}
