import { test } from "@playwright/test";

test.use({ storageState: undefined });

async function loginWithPassword(page: import("@playwright/test").Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(process.env.PLAYWRIGHT_AUTH_EMAIL ?? "");
  await page.getByLabel("Password").fill(process.env.PLAYWRIGHT_AUTH_PASSWORD ?? "");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
  await page.waitForLoadState("networkidle");
}

test("diagnose community members KPI sync", async ({ page }) => {
  await loginWithPassword(page);

  const kpiId = "b1b8fb24-ac8c-45b5-aeb3-436c004b894f";

  // Trigger sync
  await page.goto(`/strategy/scoreboard/${kpiId}/integrations`, { waitUntil: "networkidle" });
  const syncButton = page.getByRole("button", { name: /sync now/i });

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/kpi/sync-one"),
    { timeout: 30000 }
  );
  await syncButton.first().click();
  const response = await responsePromise;
  const json = await response.json();
  console.log(`Sync response: ${JSON.stringify(json)}`);

  // Verify data persisted
  await page.waitForTimeout(2000);
  await page.goto(`/strategy/scoreboard/${kpiId}`, { waitUntil: "networkidle" });
  const bodyText = await page.textContent("body");
  console.log(`Value persisted: ${bodyText?.includes(String(json.value))}`);
});
