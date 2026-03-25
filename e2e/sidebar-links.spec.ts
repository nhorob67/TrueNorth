import { test, expect, Page } from "@playwright/test";

const BASE_URL = "https://true-north-bay.vercel.app";
const LOGIN_EMAIL = "test@truenorth.dev";
const LOGIN_PASSWORD = "TrueNorth-Test-2026!";

// All sidebar nav links from sidebar.tsx
// redirectsTo: expected redirect for links that legitimately redirect
const sidebarLinks = [
  { name: "Launch", href: "/launch", redirectsTo: "/cockpit" },
  { name: "Cockpit", href: "/cockpit", redirectsTo: "/cockpit" },
  { name: "Portfolio", href: "/portfolio", redirectsTo: "/cockpit" },
  { name: "Vision", href: "/vision" },
  { name: "Scoreboard", href: "/scoreboard" },
  { name: "Bets", href: "/bets" },
  { name: "Ideas", href: "/ideas" },
  { name: "Content", href: "/content" },
  { name: "Funnels", href: "/funnels" },
  { name: "Pulse", href: "/pulse" },
  { name: "Sync", href: "/sync" },
  { name: "Operations", href: "/ops" },
  { name: "Processes", href: "/processes" },
  { name: "Health", href: "/health" },
  { name: "Narratives", href: "/narratives" },
  { name: "Artifacts", href: "/artifacts" },
  { name: "Activity", href: "/activity" },
  { name: "Todos", href: "/todos" },
  // Bottom section (may be conditional)
  { name: "Settings", href: "/settings" },
  { name: "Profile", href: "/profile" },
];

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[type="email"], input[name="email"]', LOGIN_EMAIL);
  await page.fill(
    'input[type="password"], input[name="password"]',
    LOGIN_PASSWORD
  );
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
  await page.waitForLoadState("networkidle");
}

test.describe("Sidebar Navigation Links", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const link of sidebarLinks) {
    test(`sidebar link "${link.name}" (${link.href}) navigates correctly`, async ({
      page,
    }) => {
      const sidebar = page.locator("aside");
      const navLink = sidebar.locator(`a[href="${link.href}"]`);

      // Some links may be hidden (e.g., Portfolio for single-venture, Settings for non-admin)
      if ((await navLink.count()) === 0) {
        test.skip();
        return;
      }

      // Navigate via direct URL (tests both route and rendering)
      await page.goto(`${BASE_URL}${link.href}`, { waitUntil: "networkidle" });

      const expectedPath = (link as { redirectsTo?: string }).redirectsTo ?? link.href;

      // Verify we landed on the expected path (or its redirect target)
      expect(page.url()).toContain(expectedPath);

      // Verify we didn't get redirected to login
      expect(page.url()).not.toContain("/login");

      // Verify no unhandled error state
      const errorBanner = page.locator("text=Something went wrong");
      const hasError = (await errorBanner.count()) > 0;
      expect(hasError).toBe(false);
    });
  }
});
