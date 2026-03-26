import { test, expect } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

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

async function captureAuthenticatedHome(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "01-after-login.png"),
    fullPage: true,
  });
  console.log("📸 01-after-login.png");
}

test("Screenshot all sidebar links", async ({ page }) => {
  // Set a wide viewport to capture full sidebar + content
  await page.setViewportSize({ width: 1440, height: 900 });

  await captureAuthenticatedHome(page);

  const results: { name: string; href: string; status: string; screenshot: string }[] = [];

  for (let i = 0; i < sidebarLinks.length; i++) {
    const link = sidebarLinks[i];
    const idx = String(i + 2).padStart(2, "0");
    const filename = `${idx}-${link.name.toLowerCase().replace(/\s+/g, "-")}.png`;

    // Check if link is visible in sidebar
    const sidebar = page.locator("aside");
    const navLink = sidebar.locator(`a[href="${link.href}"]`);

    if ((await navLink.count()) === 0) {
      console.log(`⏭️  ${link.name} (${link.href}) — SKIPPED (not visible in sidebar)`);
      results.push({ name: link.name, href: link.href, status: "SKIPPED", screenshot: "N/A" });
      continue;
    }

    // Navigate via direct URL
    await page.goto(link.href, { waitUntil: "networkidle" });

    // Small extra wait for any client-side hydration
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, filename),
      fullPage: true,
    });

    // Determine status
    const finalPath = new URL(page.url()).pathname;
    const expectedPath = (link as { redirectsTo?: string }).redirectsTo ?? link.href;
    const onExpectedPage = finalPath.startsWith(expectedPath);
    const onLogin = finalPath.includes("/login");
    const errorBanner = page.locator("text=Something went wrong");
    const hasError = (await errorBanner.count()) > 0;

    let status: string;
    if (onLogin) {
      status = "FAIL (redirected to login)";
    } else if (hasError) {
      status = "FAIL (error boundary)";
    } else if (!onExpectedPage) {
      status = `WARN (unexpected redirect → ${finalPath})`;
    } else {
      status = "PASS";
    }

    console.log(`📸 ${filename} — ${link.name} (${link.href}) → ${finalPath} — ${status}`);
    results.push({ name: link.name, href: link.href, status, screenshot: filename });
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("SIDEBAR NAVIGATION TEST SUMMARY");
  console.log("=".repeat(70));

  const passed = results.filter((r) => r.status === "PASS");
  const failed = results.filter((r) => r.status.startsWith("FAIL"));
  const skipped = results.filter((r) => r.status === "SKIPPED");
  const warned = results.filter((r) => r.status.startsWith("WARN"));

  console.log(`\n✅ PASSED:  ${passed.length}`);
  console.log(`❌ FAILED:  ${failed.length}`);
  console.log(`⚠️  WARNED:  ${warned.length}`);
  console.log(`⏭️  SKIPPED: ${skipped.length}`);
  console.log(`📸 TOTAL:   ${results.length}`);

  console.log("\nDetailed results:");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "SKIPPED" ? "⏭️" : r.status.startsWith("WARN") ? "⚠️" : "❌";
    console.log(`  ${icon} ${r.name.padEnd(12)} ${r.href.padEnd(14)} ${r.status}`);
  }

  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);

  // Assert no failures
  expect(failed.length).toBe(0);
});
