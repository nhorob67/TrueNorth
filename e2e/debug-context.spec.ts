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

test("debug getUserContext via API", async ({ page }) => {
  await login(page);

  const response = await page.goto(`${BASE_URL}/api/debug-context`, {
    waitUntil: "networkidle",
  });

  const body = await response?.text();
  console.log("Debug context result:");
  console.log(JSON.stringify(JSON.parse(body ?? "{}"), null, 2));
});
