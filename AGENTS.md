# Repository Guidelines

## Project Structure & Module Organization
This repository is centered on the Next.js app in `app/`. Main code lives in `app/src/app` for routes, `app/src/components` for UI, `app/src/lib` for domain logic, `app/src/hooks` for hooks, and `app/src/types` for shared types. Database work is tracked in `app/supabase/migrations`. The smaller `discord-bot/src` package is a separate TypeScript entrypoint. Root-level Playwright specs live in `e2e/`. Treat `app/.next/`, `app/node_modules/`, `node_modules/`, and `test-results/` as generated output.

## Build, Test, and Development Commands
Run app commands from `app/`:
- `npm run dev` starts the Next.js dev server.
- `npm run build` creates the production build.
- `npm run lint` runs the shared ESLint config.
- `npm run test` runs Vitest once.
- `npm run test:watch` runs Vitest in watch mode.

Run bot commands from `discord-bot/`:
- `npm run dev` starts the bot with `tsx`.
- `npm run start` runs the TypeScript entrypoint with Node’s loader.

From the repo root, `npx playwright test e2e/sidebar-links.spec.ts` runs an end-to-end spec. Playwright now authenticates by generating a one-time Supabase magic link during `globalSetup` and reusing the saved browser `storageState`; set `PLAYWRIGHT_AUTH_EMAIL`, `PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY`, and either `PLAYWRIGHT_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` before running the suite. `PLAYWRIGHT_BASE_URL` is optional and defaults to the deployed preview URL.

## Coding Style & Naming Conventions
Use TypeScript, 2-space indentation, double quotes, and semicolons to match the existing codebase. Prefer PascalCase for React component exports, camelCase for functions and hooks, and lowercase route folders under `app/src/app`. Keep view files descriptive, for example `bet-detail-view.tsx` or `portfolio-view.tsx`. Use the `@/` alias inside `app/` instead of deep relative imports when possible.

## Testing Guidelines
Vitest is configured in `app/vitest.config.ts` with a Node test environment. Place unit tests beside the feature in `__tests__/` or name them `*.test.ts` or `*.test.tsx`. Add or update tests for changed business logic; there is no enforced coverage threshold, so contributors need to be deliberate. Root `e2e/*.spec.ts` files use Playwright and currently target deployed URLs, so confirm the target before running them in CI or locally. Do not add plaintext test passwords to specs; use the shared Playwright magic-link bootstrap instead.

## Commit & Pull Request Guidelines
Recent history favors short, imperative subjects such as `fix: resolve RLS infinite recursion`, `design tweaks`, and `tiptap fix`. Keep commits focused and scoped to one concern. PRs should include a brief summary, affected areas, linked issues when relevant, screenshots for UI changes, and notes for schema or env changes. If you add a migration, call out the new file under `app/supabase/migrations`.

## Security & Configuration Tips
Do not commit `.env*` files or secrets. Start local setup from `app/.env.local.example`, and keep API keys, service-role credentials, and test credentials out of source changes. For Playwright, keep auth inputs in environment variables only and rely on the generated magic-link session instead of stored passwords.
