import fs from "fs/promises";
import path from "path";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const authStatePath = path.resolve(__dirname, "../../playwright/.auth/user.json");

function readEnv(name: string, fallbacks: string[] = []) {
  const value = [process.env[name], ...fallbacks.map((key) => process.env[key])].find(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );

  if (!value) {
    const fallbackLabel = fallbacks.length > 0 ? ` (or ${fallbacks.join(", ")})` : "";
    throw new Error(`Missing required environment variable ${name}${fallbackLabel}`);
  }

  return value;
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:3000";
  const email = readEnv("PLAYWRIGHT_AUTH_EMAIL");
  const supabaseUrl = readEnv("PLAYWRIGHT_SUPABASE_URL", [
    "NEXT_PUBLIC_SUPABASE_URL",
  ]);
  const serviceRoleKey = readEnv("PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY", [
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  const redirectTo = new URL("/auth/callback?next=/", baseURL).toString();
  const expectedOrigin = new URL(baseURL).origin;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  });

  if (error || !data.properties?.action_link) {
    throw new Error(
      `Failed to generate Playwright magic link for ${email}: ${error?.message ?? "missing action link"}`
    );
  }

  await fs.mkdir(path.dirname(authStatePath), { recursive: true });

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await page.goto(data.properties.action_link, { waitUntil: "networkidle" });
    await page.waitForURL((url) => url.origin === expectedOrigin, {
      timeout: 15000,
    });
    await page.waitForLoadState("networkidle");

    const finalUrl = new URL(page.url());
    if (finalUrl.pathname.startsWith("/login")) {
      throw new Error(
        `Magic link login redirected back to /login for ${email}. Confirm the user exists in the target environment and the redirect URL is allowed.`
      );
    }

    await page.goto("/", { waitUntil: "networkidle" });
    await context.storageState({ path: authStatePath });
  } finally {
    await browser.close();
  }
}
