import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    const supabase = await createClient();

    // Step 1: Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    steps.user = user ? { id: user.id, email: user.email } : null;
    steps.userError = userError?.message ?? null;

    if (!user) return NextResponse.json({ steps, failed_at: "user" });

    // Step 2: Get profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    steps.profile = profile;
    steps.profileError = profileError?.message ?? null;

    // Step 3: Get org membership
    const { data: orgMembership, error: orgError } = await supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    steps.orgMembership = orgMembership;
    steps.orgError = orgError?.message ?? null;

    if (!orgMembership) return NextResponse.json({ steps, failed_at: "orgMembership" });

    // Step 4: Get ventures
    const { data: ventures, error: venturesError } = await supabase
      .from("ventures")
      .select("id, name")
      .eq("organization_id", orgMembership.organization_id)
      .order("created_at");
    steps.ventures = ventures;
    steps.venturesError = venturesError?.message ?? null;

    if (!ventures || ventures.length === 0) return NextResponse.json({ steps, failed_at: "ventures" });

    // Step 5: Check venture cookie
    const cookieStore = await cookies();
    const selectedVentureId = cookieStore.get("truenorth_venture_id")?.value;
    steps.selectedVentureCookie = selectedVentureId ?? null;

    const activeVenture = ventures.find((v) => v.id === selectedVentureId) ?? ventures[0];
    steps.activeVenture = activeVenture;

    // Step 6: Get venture membership
    const { data: ventureMembership, error: vmError } = await supabase
      .from("venture_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("venture_id", activeVenture.id)
      .single();
    steps.ventureMembership = ventureMembership;
    steps.ventureMembershipError = vmError?.message ?? null;

    return NextResponse.json({ steps, failed_at: null, context_would_be: "valid" });
  } catch (e) {
    return NextResponse.json({ steps, error: String(e) }, { status: 500 });
  }
}
