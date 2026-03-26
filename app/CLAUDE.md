# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js Version

This project runs **Next.js 16.2.1** with **React 19**. APIs and conventions differ from training data. Before writing any code, read the relevant guide in `node_modules/next/dist/docs/`. Key differences:
- `params` in page components is a `Promise` — must be awaited: `const { id } = await params;`
- Route handlers use the Web standard `Request`/`Response` API
- Heed all deprecation notices

## Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build (also serves as type check)
npx tsc --noEmit     # Type check without building
npm run lint         # ESLint

# End-to-end tests (run from repo root)
npx playwright test

# Discord bot (separate service)
cd discord-bot && npx tsx src/index.ts
```

Vitest lives in `app/` and Playwright lives at the repo root. For UI tests, prefer the shared Playwright auth bootstrap over form-filling credentials.

## Architecture

### Stack
- **Next.js 16 App Router** with `force-dynamic` on all dashboard routes
- **Supabase** (Postgres + Auth + RLS + Realtime) — client in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (SSR with cookie handling)
- **Tailwind CSS v4** with inline `@theme` tokens in `globals.css`
- **Tiptap** rich text editor with `@tiptap/suggestion` + `tippy.js` for slash commands
- **Anthropic Claude API** (`@anthropic-ai/sdk`) for Content Copilot and Signal Watch
- **Discord.js** bot in separate `discord-bot/` directory

### Route Layout Groups
- `(auth)/` — login, signup (public, no dashboard shell)
- `(dashboard)/` — all protected routes, wrapped in `UserContextProvider` + `AppShell` (sidebar + main content)

### Data Flow Pattern
Every dashboard page follows the same pattern:
1. **Server component** (`page.tsx`) — creates Supabase server client, fetches data, passes as props
2. **Client component** (`*-view.tsx`) — receives data as props, handles interactivity and mutations via browser Supabase client

### Key Abstractions

**UserContext** (`lib/user-context.ts`) — loaded once in `(dashboard)/layout.tsx`, provides `userId`, `orgId`, `orgRole`, `ventureId`, `ventureRole`, `isSingleVenture`. Access via `useUserContext()` hook.

**Policy Engine** (`lib/policies/engine.ts`) — central enforcement of TrueNorth business rules (3-bet max, 5-15 KPI range, 14-day idea quarantine, etc.). Policies define scope, enforcement level, and user-facing explanations. `checkPolicy()` returns pass/fail with violation details.

**Polymorphic Linking** — entities reference each other via `linked_entity_id` + `linked_entity_type` columns. The `EntityPicker` component and `/api/entities/search` route power universal entity search across all types.

**Notification System** (`lib/notifications.ts`) — 4 tiers (immediate/urgent/daily_digest/weekly_digest). Respects per-user quiet hours via `held_until` timestamp. Escalation rules in `lib/escalation.ts`.

### Multi-Tenant Model
`Organization → Venture → Entities`. Every table has `organization_id`; venture-scoped tables also have `venture_id`. RLS enforces isolation. Single-venture orgs never see multi-venture UI (controlled by `isSingleVenture` flag).

## Design System — Warm Carbon

"Warm Carbon" design with dark/light mode. All colors in `globals.css` `@theme` block, dark overrides via `[data-theme="dark"]`. Theme switching via `next-themes`.

### Color Tokens (semantic, mode-adaptive)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `canvas` | `#F5F1EC` | `#131110` | Page background |
| `surface` | `#FFFFFF` | `#1A1816` | Cards, elevated containers |
| `well` | `#EAE5DE` | `#221F1C` | Inputs, nested surfaces |
| `hovered` | `#E2DCD4` | `#2A2622` | Hover states |
| `ink` | `#2A2420` | `#E8E2DA` | Primary text |
| `subtle` | `#6E6358` | `#9A9088` | Secondary text |
| `faded` | `#A69B90` | `#5A534C` | Muted text, placeholders |
| `accent` | `#B74E28` | `#CC5E34` | Primary accent |
| `accent-warm` | `#CC5E34` | `#E07A4F` | Hover accents |
| `cta` | `#B74E28` | `#CC5E34` | Primary button bg |
| `line` | warm brown | warm white | Default borders |

### Sidebar Tokens (always dark, both modes)

`sidebar`, `sidebar-hover`, `sidebar-active`, `sidebar-text`, `sidebar-text-hover`, `sidebar-text-active`, `sidebar-label`, `sidebar-divider`, `sidebar-bar`

### Supplementary Colors

| Token | Usage |
|-------|-------|
| `brass` / `brass-text` | Premium emphasis (Vision Board) |
| `sage` / `sage-text` | AI-generated content indicators |
| `semantic-green/ochre/brick` | Health status (unchanged) |

**Typography:** Bricolage Grotesque (`font-display` — headings), Sora (`font-sans` — body/UI), IBM Plex Mono (`font-mono` — labels/badges/breadcrumbs). Section labels use `font-mono text-[10px] uppercase tracking-[0.10em]`.

## UI Components (`components/ui/`)

- `Card` — accepts optional `borderColor` prop for status left-borders, `rounded-[10px]`
- `Badge` — `status` prop: `"green" | "yellow" | "red" | "neutral"`, `font-mono`, `rounded-[4px]`
- `Button` — variants: `primary` (cta), `secondary` (surface), `tertiary` (ghost), `destructive` (brick). Sizes: `sm`, `md`, `lg`
- `Input` / `Select` / `Textarea` — `bg-well`, `rounded-[8px]`, accent focus ring
- `EmptyState` / `LoadingSpinner` / `ErrorState` — consistent empty/loading/error patterns
- `Dialog` — `font-display` title, `bg-surface` panel
- `Toggle` — `bg-accent` when active

## Conventions

- **Server data fetching, client interactivity** — page.tsx fetches, *-view.tsx renders
- **Supabase joins** return arrays for single relations — always normalize: `Array.isArray(x.profiles) ? x.profiles[0] : x.profiles`
- **Entity types enum** — `bet | kpi | move | move_instance | idea | funnel | decision | blocker | commitment | issue | process | content_piece`
- **Two-dimensional state** on entities — `lifecycle_status` (stage progression) and `health_status` (R/Y/G performance), always separate fields
- **All types** live in `types/database.ts` — add new entity types there, not inline
- **Sidebar nav** defined in `components/layout/sidebar.tsx` — add nav items to the `navigation` array and icons to `iconMap`

## Reference Documents

- `TrueNorth-PRD.md` — full product requirements (design language, feature specs, AI agent definitions, data model)
- `BUILDPLAN.md` — phased implementation checklist tracking what's built vs. remaining

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon key
ANTHROPIC_API_KEY             # For Content Copilot and Signal Watch
PLAYWRIGHT_AUTH_EMAIL         # Dedicated test user email for Playwright
PLAYWRIGHT_SUPABASE_URL       # Optional override; falls back to NEXT_PUBLIC_SUPABASE_URL
PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY # Used only to mint a one-time magic link in Playwright globalSetup
```

## Playwright Auth Method

Root `e2e/` specs no longer store or submit plaintext passwords. `playwright.config.ts` runs `app/playwright/auth.setup.ts`, which uses the Supabase admin API to generate a one-time magic link for `PLAYWRIGHT_AUTH_EMAIL`, opens it in a browser, and saves the resulting authenticated `storageState` under `playwright/.auth/user.json`. Keep that file ignored and rotate environment-backed test access instead of committing reusable credentials.
