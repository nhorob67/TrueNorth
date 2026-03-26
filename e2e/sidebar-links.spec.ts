import { test, expect } from "@playwright/test";

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

test.describe("Sidebar Navigation Links", () => {
  for (const link of sidebarLinks) {
    test(`sidebar link "${link.name}" (${link.href}) navigates correctly`, async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "networkidle" });

      const sidebar = page.locator("aside");
      const navLink = sidebar.locator(`a[href="${link.href}"]`);

      // Some links may be hidden (e.g., Portfolio for single-venture, Settings for non-admin)
      if ((await navLink.count()) === 0) {
        test.skip();
        return;
      }

      // Navigate via direct URL (tests both route and rendering)
      await page.goto(link.href, { waitUntil: "networkidle" });

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
