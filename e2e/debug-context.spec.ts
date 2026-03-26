import { test } from "@playwright/test";

test("debug getUserContext via API", async ({ page }) => {
  const response = await page.goto("/api/debug-context", {
    waitUntil: "networkidle",
  });

  const body = await response?.text();
  console.log("Debug context result:");
  console.log(JSON.stringify(JSON.parse(body ?? "{}"), null, 2));
});
