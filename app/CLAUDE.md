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

# Discord bot (separate service)
cd discord-bot && npx tsx src/index.ts
```

There is no test runner configured. Verify changes with `npx tsc --noEmit` and `npm run build`.

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

## Design System

All colors defined as CSS custom properties in `globals.css` `@theme` block and used via Tailwind classes:

| Token | Hex | Usage |
|-------|-----|-------|
| `moss` | `#5F6F52` | Primary: sidebar, headers, active states |
| `parchment` | `#F4EFE6` | Page background |
| `ivory` | `#FDFAF5` | Card surfaces |
| `charcoal` | `#2F2B28` | Primary text (never use pure black) |
| `warm-gray` | `#7A756E` | Secondary text |
| `warm-border` | `#D9D3C7` | Borders, dividers |
| `clay` | `#B85C38` | Primary CTA buttons, active actions |
| `brass` | `#B69A45` | Premium emphasis (Vision Board, milestones) |
| `sage` | `#8B9E82` | AI-generated content indicators |
| `semantic-green` | `#6B8C54` | Health: on track |
| `semantic-ochre` | `#C49B2D` | Health: caution |
| `semantic-brick` | `#A04230` | Health: critical |

**Typography:** Inter (sans), JetBrains Mono (data/code). H3 headings use moss color. No pure white surfaces except the editor canvas.

## UI Components (`components/ui/`)

- `Card` — accepts optional `borderColor` prop for status left-borders
- `Badge` — `status` prop: `"green" | "yellow" | "red" | "neutral"`, auto-styled with dot
- `Button` — variants: `primary` (clay), `secondary` (ivory), `tertiary` (ghost), `destructive` (brick). Sizes: `sm`, `md`, `lg`
- `Input` — optional `label` and `error` props
- `EmptyState` / `LoadingSpinner` / `ErrorState` — consistent empty/loading/error patterns

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
```
