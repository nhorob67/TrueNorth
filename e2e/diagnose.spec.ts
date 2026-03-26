import { test, expect, Page } from "@playwright/test";

const BASE_URL = "https://true-north-bay.vercel.app";

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[type="email"], input[name="email"]', "test@truenorth.dev");
  await page.fill('input[type="password"], input[name="password"]', "TrueNorth-Test-2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

const failingRoutes = [
  "/strategy/launch", "/strategy/portfolio", "/strategy/vision", "/strategy/scoreboard",
  "/execution/ideas", "/execution/content", "/execution/funnels", "/reviews/pulse",
  "/reviews/sync", "/reviews/operations", "/library/processes", "/reviews/health",
  "/reviews/narratives", "/activity", "/todos", "/profile",
];

test("diagnose failing routes via direct navigation", async ({ page }) => {
  await login(page);
  console.log(`After login, URL: ${page.url()}`);

  const results: string[] = [];
  for (const route of failingRoutes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
    const finalUrl = new URL(page.url()).pathname;
    const status = finalUrl.startsWith(route) ? "OK" : `REDIRECTED -> ${finalUrl}`;
    results.push(`${route}: ${status}`);
    console.log(`${route}: ${status}`);

    // Check for error text on page
    if (finalUrl.startsWith(route)) {
      const bodyText = await page.textContent("body");
      if (bodyText?.includes("Something went wrong")) {
        results[results.length - 1] += " (ERROR BOUNDARY)";
        console.log(`  ^ Error boundary active`);
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  results.forEach((r) => console.log(r));
});
