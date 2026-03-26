import { test } from "@playwright/test";

test("diagnose getUserContext failure", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  console.log(`After login: ${page.url()}`);

  // Use the browser's Supabase client to replicate what getUserContext does
  const result = await page.evaluate(async () => {
    // Access the Supabase client from the browser (same as the app uses)
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm" as string);

    // Get the Supabase URL and anon key from the page's env
    const supabaseUrl = (window as any).__NEXT_DATA__?.props?.pageProps?.supabaseUrl
      || document.querySelector('meta[name="supabase-url"]')?.getAttribute("content")
      || "";

    // Try to read from existing cookies/localStorage
    const cookies = document.cookie;
    const localStorageKeys = Object.keys(localStorage).filter(k => k.includes("supabase") || k.includes("sb-"));

    // Check if we can find the Supabase project URL from any script tags or network
    const scripts = Array.from(document.querySelectorAll("script[src]")).map(s => s.getAttribute("src"));

    return {
      cookies: cookies.substring(0, 500),
      localStorageKeys,
      url: window.location.href,
    };
  });

  console.log("Browser state:", JSON.stringify(result, null, 2));

  // Now use the API route to check auth state
  // Navigate to a simple page and check what the server can see
  const response = await page.goto("/api/entities/search?q=test&limit=1", {
    waitUntil: "networkidle",
  });
  console.log(`API route status: ${response?.status()}`);
  const apiBody = await response?.text();
  console.log(`API route response: ${apiBody?.substring(0, 200)}`);

  // Check if the user has the required Supabase cookies
  const allCookies = await page.context().cookies();
  const supabaseCookies = allCookies.filter(c =>
    c.name.includes("supabase") || c.name.includes("sb-") || c.name.includes("tn_")
  );
  console.log("\nSupabase-related cookies:");
  for (const c of supabaseCookies) {
    console.log(`  ${c.name} = ${c.value.substring(0, 50)}... (domain: ${c.domain}, path: ${c.path})`);
  }

  // Check ALL cookies for the domain
  const domainCookies = allCookies.filter(c => c.domain.includes("true-north"));
  console.log(`\nAll cookies for domain (${domainCookies.length}):`);
  for (const c of domainCookies) {
    console.log(`  ${c.name} (httpOnly: ${c.httpOnly}, secure: ${c.secure}, sameSite: ${c.sameSite})`);
  }
});
