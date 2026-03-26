import { test } from "@playwright/test";

const failingRoutes = [
  "/strategy/launch", "/strategy/portfolio", "/strategy/vision", "/strategy/scoreboard",
  "/execution/ideas", "/execution/content", "/execution/funnels", "/reviews/pulse",
  "/reviews/sync", "/reviews/operations", "/library/processes", "/reviews/health",
  "/reviews/narratives", "/activity", "/todos", "/profile",
];

test("diagnose failing routes via direct navigation", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  console.log(`After login, URL: ${page.url()}`);

  const results: string[] = [];
  for (const route of failingRoutes) {
    await page.goto(route, { waitUntil: "networkidle" });
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
