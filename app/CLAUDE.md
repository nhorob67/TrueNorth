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

## Hermes Agent Integration

TrueNorth uses **Hermes Agent v0.6.0** on a VPS (87.99.128.11) as the AI agent runtime. Agents run as isolated Hermes profiles, triggered by Vercel crons via a VPS proxy.

### Architecture
- **VPS Proxy** (`vps-proxy/`) — Fastify API at port 3100, routes trigger requests to `hermes -p {profile} chat -q`
- **MCP Servers** (`mcp-servers/`) — 9 Node.js MCP servers providing 44 tools to agents via stdio transport
- **Hermes Profiles** — 12 agent profiles at `~/.hermes/profiles/` on VPS, each with own config, SOUL.md, memories, MCP servers
- **Control Plane** — TrueNorth (Vercel) owns scheduling, review, approvals; Hermes owns execution

### Agent Roster (12 agents)
| Agent | Category | Profile | Status |
|---|---|---|---|
| Bet Tracker | governance | `kill-switch` | hermes_enabled |
| Signal Watch | sensing | `signal-watch` | legacy |
| Filter Guardian | governance | `filter-guardian` | legacy |
| Cockpit Advisor | operations | `cockpit-advisor` | legacy |
| Agenda Builder | operations | `agenda-builder` | legacy |
| Vault Archaeologist | synthesis | `vault-archaeologist` | legacy |
| Dispatch Scribe | synthesis + production | `dispatch-scribe` | legacy |
| Funnel Watchdog | sensing + synthesis | `funnel-watchdog` | legacy |
| Community Pulse | sensing | `community-pulse` | legacy |
| Content Copilot | production | `content-copilot` | legacy |
| Launch Assistant | execution | `launch-assistant` | legacy |
| Market Scout | sensing (external) | `market-scout` | hermes_enabled |
| Content Cascade | production | `content-cascade` | hermes_enabled |

### MCP Servers (9 servers, 44 tools)
| Server | Tools | Data Source |
|---|---|---|
| `truenorth-kpis` | 5 | Supabase (KPIs, entries, health) |
| `truenorth-strategy` | 6 | Supabase (vision, bets, moves, ideas) |
| `truenorth-content` | 3 | Supabase (content pieces, funnels) |
| `truenorth-operations` | 7 | Supabase (blockers, decisions, commitments, pulses, health) |
| `truenorth-community` | 8 | Discourse API + Data Explorer SQL |
| `truenorth-email` | 7 | ConvertKit/Kit v4 API |
| `truenorth-revenue` | 6 | Stripe API |
| `truenorth-web` | 3 | Tavily Search API |
| `truenorth-actions` | 8 | Supabase (action logging, notifications, memory, reviews) |

### Hermes-Enabled Cron Route Pattern
All 6 AI cron routes check `hermes_enabled` per-org before delegating to VPS:
```ts
const { data: hermesAgent } = await supabase
  .from("agents").select("hermes_enabled, hermes_profile_name")
  .eq("organization_id", org.id).eq("category", "AGENT_CATEGORY").single();

if (hermesAgent?.hermes_enabled && hermesAgent.hermes_profile_name) {
  const vpsResult = await callVps("/api/trigger", { ... }, { timeout: 270_000 });
  await persistVpsResult(supabase, { orgId, agentProfile, agentCategory, vpsResult });
} else {
  // Legacy Claude API path
}
```

### Key Files
- `lib/hermes/vps-client.ts` — `callVps()` for TrueNorth → VPS communication
- `lib/hermes/verify-secret.ts` — `verifyHermesSecret()` for VPS → TrueNorth auth
- `lib/hermes/persist-result.ts` — `persistVpsResult()` for inserting VPS results into `agent_tasks`
- `lib/cron/execution-logger.ts` — `logCronExecution()` wraps all 18+ cron routes
- `lib/cron/vercel-registry.ts` — static registry of all Vercel crons

### Database Tables (Hermes-specific)
`agent_tasks`, `agent_memory`, `agent_token_usage`, `agent_budget_policies`, `agent_skills`, `agent_performance_snapshots`, `agent_drift_alerts`, `moa_configs`, `workflow_templates`, `workflow_executions`, `vercel_cron_executions`, `hermes_cron_jobs`, `hermes_cron_executions`

### Cockpit Inbox Flow
VPS trigger result → `persistVpsResult()` extracts JSON → inserts `agent_tasks` (status=review) → Cockpit Inbox UI → human approve/reject → PATCH `/api/hermes/tasks`

## Reference Documents

- `TrueNorth-PRD.md` — full product requirements (design language, feature specs, AI agent definitions, data model)
- `BUILDPLAN.md` — phased implementation checklist tracking what's built vs. remaining
- `.claude/plans/humble-bouncing-parasol.md` — Hermes integration plan with full VPS infrastructure reference

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY     # Service role key for cron routes and server-side operations
ANTHROPIC_API_KEY             # For Content Copilot and Signal Watch (legacy path)
HERMES_VPS_URL                # VPS proxy URL (http://87.99.128.11:3100)
HERMES_API_SECRET             # Shared secret for TrueNorth ↔ VPS auth
CRON_SECRET                   # Vercel cron authentication
PLAYWRIGHT_AUTH_EMAIL         # Dedicated test user email for Playwright
PLAYWRIGHT_SUPABASE_URL       # Optional override; falls back to NEXT_PUBLIC_SUPABASE_URL
PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY # Used only to mint a one-time magic link in Playwright globalSetup
```

## Playwright Auth Method

Root `e2e/` specs no longer store or submit plaintext passwords. `playwright.config.ts` runs `app/playwright/auth.setup.ts`, which uses the Supabase admin API to generate a one-time magic link for `PLAYWRIGHT_AUTH_EMAIL`, opens it in a browser, and saves the resulting authenticated `storageState` under `playwright/.auth/user.json`. Keep that file ignored and rotate environment-backed test access instead of committing reusable credentials.
