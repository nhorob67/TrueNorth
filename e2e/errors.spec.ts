import { test } from "@playwright/test";

const errorRoutes = [
  "/strategy/vision",
  "/reviews/pulse",
  "/reviews/sync",
  "/reviews/health",
  "/reviews/narratives",
  "/profile",
];

test("capture error messages from error boundary pages", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  for (const route of errorRoutes) {
    await page.goto(route, { waitUntil: "networkidle" });

    // Get the error message text
    const errorEl = page.locator("text=Something went wrong").locator("..");
    const errorSection = await errorEl.locator("..").textContent();
    console.log(`\n${route}: ${errorSection?.trim()}`);
  }
});
