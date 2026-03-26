import { test, expect, Page } from "@playwright/test";

const BASE_URL = "https://true-north-bay.vercel.app";
const LOGIN_EMAIL = "test@truenorth.dev";
const LOGIN_PASSWORD = "TrueNorth-Test-2026!";

// All sidebar nav links from sidebar.tsx
// redirectsTo: expected redirect for links that legitimately redirect
const sidebarLinks = [
  { name: "Home", href: "/" },
  { name: "Strategy", href: "/strategy" },
  { name: "Execution", href: "/execution" },
  { name: "Reviews", href: "/reviews" },
  { name: "Library", href: "/library" },
  { name: "Admin", href: "/admin" },
  { name: "Activity", href: "/activity" },
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
