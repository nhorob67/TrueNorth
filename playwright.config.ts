import path from "path";
import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? "https://true-north-bay.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./app/playwright/auth.setup.ts",
  use: {
    baseURL,
    storageState: path.join(__dirname, "playwright/.auth/user.json"),
  },
});
