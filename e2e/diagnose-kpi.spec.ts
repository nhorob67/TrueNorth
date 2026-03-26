import { test } from "@playwright/test";

test("diagnose community members KPI on scoreboard and home", async ({ page }) => {
  // 1. Check the scoreboard page
  await page.goto("/strategy/scoreboard", { waitUntil: "networkidle" });
  console.log(`\n=== SCOREBOARD PAGE ===`);
  console.log(`URL: ${page.url()}`);

  // Check for error boundary
  const bodyText = await page.textContent("body");
  if (bodyText?.includes("Something went wrong")) {
    console.log("ERROR BOUNDARY detected on scoreboard page");
  }

  // Look for all KPI tile names
  const kpiNames = await page.locator("[class*='font-medium'][class*='text-sm']").allTextContents();
  console.log(`KPI tiles found: ${kpiNames.length}`);
  kpiNames.forEach((name) => console.log(`  - ${name}`));

  // Look specifically for "Community Members"
  const communityKpi = page.getByText("Community Members");
  const communityCount = await communityKpi.count();
  console.log(`"Community Members" elements found: ${communityCount}`);

  // Check for the value 232
  const value232 = page.getByText("232");
  const value232Count = await value232.count();
  console.log(`"232" elements found: ${value232Count}`);

  // Check tier sections
  const tier1Section = page.getByText("Tier 1");
  const tier2Section = page.getByText("Tier 2");
  console.log(`Tier 1 section visible: ${await tier1Section.count() > 0}`);
  console.log(`Tier 2 section visible: ${await tier2Section.count() > 0}`);

  // Grab a screenshot
  await page.screenshot({ path: "playwright/screenshots/scoreboard-kpi.png", fullPage: true });

  // 2. Check the home page
  await page.goto("/", { waitUntil: "networkidle" });
  console.log(`\n=== HOME PAGE ===`);
  console.log(`URL: ${page.url()}`);

  const homeBody = await page.textContent("body");
  if (homeBody?.includes("Something went wrong")) {
    console.log("ERROR BOUNDARY detected on home page");
  }

  const homeCommunity = page.getByText("Community Members");
  console.log(`"Community Members" on home: ${await homeCommunity.count()}`);
  const homeValue = page.getByText("232");
  console.log(`"232" on home: ${await homeValue.count()}`);

  await page.screenshot({ path: "playwright/screenshots/home-kpi.png", fullPage: true });

  // 3. Try the API directly
  console.log(`\n=== API CHECK ===`);
  const apiResponse = await page.request.get("/api/kpi/sync-one", {
    failOnStatusCode: false,
  });
  console.log(`GET /api/kpi/sync-one status: ${apiResponse.status()}`);

  // 4. Check what the Supabase query returns by navigating to a KPI detail
  // First find any KPI links on scoreboard
  await page.goto("/strategy/scoreboard", { waitUntil: "networkidle" });
  const allLinks = await page.locator("a[href*='/strategy/scoreboard/']").allTextContents();
  console.log(`\nKPI detail links found: ${allLinks.length}`);
  allLinks.forEach((link) => console.log(`  - ${link}`));

  // Also dump full page text for debugging
  const fullText = await page.textContent("body");
  console.log(`\n=== FULL SCOREBOARD BODY TEXT (first 2000 chars) ===`);
  console.log(fullText?.slice(0, 2000));
});
