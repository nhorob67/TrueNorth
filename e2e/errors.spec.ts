import { test, Page } from "@playwright/test";

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

const errorRoutes = ["/vision", "/pulse", "/sync", "/health", "/narratives", "/profile"];

test("capture error messages from error boundary pages", async ({ page }) => {
  await login(page);

  for (const route of errorRoutes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });

    // Get the error message text
    const errorEl = page.locator("text=Something went wrong").locator("..");
    const errorSection = await errorEl.locator("..").textContent();
    console.log(`\n${route}: ${errorSection?.trim()}`);
  }
});
