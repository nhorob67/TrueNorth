import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except auth routes and invite)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/invite")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role-based cockpit routing
  if (user && request.nextUrl.pathname === "/cockpit") {
    // Check cached role from cookie first
    const cachedRole = request.cookies.get("tn_org_role")?.value;

    let orgRole = cachedRole;
    if (!orgRole) {
      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      orgRole = membership?.role ?? "member";

      // Cache role in cookie for subsequent requests
      supabaseResponse.cookies.set("tn_org_role", orgRole as string, {
        path: "/",
        maxAge: 3600, // 1 hour
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    // Redirect based on role
    if (orgRole === "manager") {
      const url = request.nextUrl.clone();
      url.pathname = "/cockpit/team";
      return NextResponse.redirect(url);
    }
    if (orgRole === "member") {
      const url = request.nextUrl.clone();
      url.pathname = "/cockpit/my";
      return NextResponse.redirect(url);
    }
    if (orgRole === "viewer") {
      const url = request.nextUrl.clone();
      url.pathname = "/strategy/scoreboard";
      return NextResponse.redirect(url);
    }
    // admin stays on /cockpit (Operator Cockpit)
  }

  return supabaseResponse;
}
