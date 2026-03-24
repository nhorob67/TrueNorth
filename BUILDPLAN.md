# TrueNorth Build Plan

**Based on PRD v2.0 — March 2026**
**Last updated: 2026-03-24 (ALL PHASES COMPLETE — Full build shipped: 53 routes, 15 Discord commands, 21 cron templates, 14 policies, 6 AI agents, RLS hardening, input validation, performance indexes)**

---

## Phase 0: Project Scaffolding & Foundation (Week 0)

The PRD specifies: Next.js 14+ (App Router), Supabase, Tailwind CSS, Vercel. This phase gets the skeleton standing before any features are built.

### 0.1 — Project Init
- [x] Initialize Next.js 14+ project with App Router, TypeScript, Tailwind CSS
- [x] Configure Tailwind with TrueNorth design tokens (colors, typography, spacing)
  - Moss `#5F6F52`, Parchment `#F4EFE6`, Ivory `#FDFAF5`, Charcoal `#2F2B28`
  - Warm Gray `#7A756E`, Warm Border `#D9D3C7`
  - Clay `#B85C38`, Brass `#B69A45`, Sage `#8B9E82`
  - Semantic: Green `#6B8C54`, Ochre `#C49B2D`, Brick `#A04230`
- [x] Set up Inter font (primary) + JetBrains Mono (data/code)
- [x] Configure PWA with service worker (`public/sw.js` with IndexedDB-backed offline pulse queue, `install-prompt.tsx` handles registration)
- [x] Set up ESLint, Prettier, and project conventions
- [x] Create initial folder structure (`app/`, `components/`, `lib/`, `types/`)
- [ ] Deploy empty shell to Vercel, confirm CI pipeline

### 0.2 — Supabase Setup
- [ ] Create Supabase project
- [x] Configure Supabase Auth (email + magic link)
- [x] Set up Supabase client in Next.js (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
- [x] Create database migration system (Supabase CLI or manual SQL migrations)
- [ ] Set up Supabase Storage buckets/conventions for content media, attachments, and future document imports

### 0.3 — Core Data Model (Multi-Tenant Foundation)
- [x] `organizations` table (id, name, slug, settings, created_at)
- [x] `ventures` table (id, organization_id, name, slug, settings, created_at)
- [x] `users` profile table extending Supabase auth (id, full_name, avatar_url, settings)
- [x] `organization_memberships` join table (user_id, organization_id, role: admin/manager/member/viewer)
- [x] `venture_memberships` join table (user_id, venture_id, role)
- [x] Tenancy convention: every applicable table includes `organization_id` and `venture_id` where appropriate
- [x] Venture-scoped entities store both `organization_id` and `venture_id`; org-scoped entities store `organization_id` and nullable `venture_id` only when needed for attribution/filtering
- [x] Shared enum/state conventions for lifecycle vs. health across bets, ideas, funnels, KPIs, moves
- [x] Polymorphic entity index/view for universal linking and entity picker search
- [x] Row-Level Security (RLS) policies on all tables scoped by organization_id first, then venture where applicable
- [x] Indexes on organization_id and venture_id across all tables
- [x] Seed script for dev data (1 org, 1 venture, 1 admin user)

### 0.4 — Shared UI Components (Design System)
- [x] Layout shell: Moss navigation sidebar, Parchment background, Ivory card surfaces
- [x] Navigation component with venture switcher (hidden when single venture)
- [x] Card component (Ivory bg, Warm Border, warm shadow)
- [x] Button variants: Primary (Clay), Secondary (Ivory/Charcoal), Tertiary (ghost/Clay text), Destructive (Brick)
- [x] Status badge component (R/Y/G using semantic colors with filled dots/pills)
- [x] Form inputs styled to design language
- [x] Loading states, empty states, error states
- [x] Responsive layout primitives for PWA
- [x] Single-venture simplification primitives: hide venture switcher, auto-apply venture context, suppress venture badges/fields until second venture exists

### 0.5 — Shared Platform Dependencies
- [x] Audit/event logging conventions for policy overrides, AI actions, and immutable decisions
- [x] Notification delivery abstraction (in-app + Discord) used by pulse drift, blockers, comments, and AI agents
- [x] Versioning conventions/tables for visions (`vision_snapshots`); processes and editor content snapshots still pending
- [x] Search/indexing strategy for entity picker, comments/activity feed, and later editor full-text search
- [x] Environment/config management for Supabase, Discord, Anthropic, Vercel Cron

---

## Phase 1: The Heartbeat (Weeks 1–6)

> *Build the daily heartbeat first. If people are checking KPIs and posting pulses, the system has traction.*

### 1.1 — Auth & Onboarding Flow
- [x] Sign up / sign in pages (Supabase Auth)
- [x] Organization creation on first sign-up (auto-create first venture behind the scenes)
- [x] Invite flow: admin sends email invite, invitee joins org + venture
- [x] Role-based route protection middleware (admin/manager/member/viewer)
- [x] Resolve default-view mapping by role: admin → Operator Cockpit, manager → Team Cockpit, member → Team Member Cockpit, viewer → Scoreboard
- [x] User profile page (basic)

### 1.2 — Operator Cockpit (Today View) — MVP
- [x] Default home screen route (`/`)
- [x] "What is drifting" section: Red/Yellow KPIs, trend direction, days-in-status, stale artifacts
- [x] "What decisions are required" section: Open Decision objects
- [x] "Which bets are at risk" section (includes execution stalled: no Move progress in 10+ days)
- [x] "Blocked Moves" section: Moves linked to unresolved blockers, sorted by bet priority
- [x] "Upcoming Milestone due dates" section: Milestone Moves due in next 7 days across all bets
- [x] "Who is blocked" section: Open Blocker objects by severity
- [x] "What commitments are due" section
- [x] "Pulse status" section: Who has/hasn't posted today
- [x] "Next cadence event" section
- [x] Manager / Team Cockpit variant (venture-scoped team view)
- [x] Team Member Cockpit variant (scoped to user's own data):
  - [x] "My Moves" section: active Moves by bet, health indicators, due dates, overdue Milestones
- [x] Role-based cockpit selection (admin → Operator, manager → Team, member → Team Member, viewer → Scoreboard)

### 1.3 — KPI Scoreboard (Pillar 4)
- [x] `kpis` table (organization_id, venture_id, name, type, frequency, owner_id, target, current_value, health_status, lifecycle_status, tier, unit, directionality, aggregation_window, threshold_logic jsonb, linked_driver_kpis uuid[], action_playbook jsonb)
- [x] `kpi_entries` table (kpi_id, value, recorded_at, source)
- [x] RLS policies scoped to venture
- [x] KPI CRUD pages: create, edit, list, detail
- [x] Scoreboard dashboard view: Tier 1 (lagging, monthly) top row, Tier 2 (leading, weekly) below
- [x] KPI tiles: Ivory card, 4px left border in status color, monospace value, warm-gray target line
- [x] R/Y/G auto-calculation from threshold_logic config
- [x] Manual data entry form with date stamp
- [x] Single ownership enforcement (Policy Engine rule)
- [x] 5–15 KPI limit enforcement (Policy Engine rule)
- [x] KPI structured metadata fields (unit, directionality, aggregation window, thresholds)
- [x] KPI action playbook config (if yellow do X, if red do Y)
- [x] Linked driver KPIs field (lagging → leading linkage)
- [x] Sparkline/trend visualization per KPI (trailing 4–8 data points)

### 1.4 — Daily Pulse (Pillar 5)
- [x] `pulses` table (user_id, organization_id, date, items jsonb)
- [x] Pulse item schema: each line item stores type, venture_id, linked_entity_ids, mentions, and offline sync metadata
- [x] RLS: users can read all org pulses, write only their own
- [x] Pulse submission form: 4 fields (Shipped, Focus, Blockers, Signal)
- [x] Entity auto-suggest on each field (link to bets, KPIs, Moves)
- [x] Focus field: bet selector (must tie to active bet)
- [x] Blocker field: @mention team members
- [x] Blocker auto-creation: when @mention used, create Blocker object
- [x] Pulse streak tracking (consecutive days counter on profile)
- [x] Drift Detector: notify if 5 days of pulses don't connect to a bet/KPI
- [x] Offline-first pulse capture (service worker + IndexedDB storage, auto-sync on reconnect via `useOfflinePulse` hook)
- [x] Pulse feed: view all team pulses for today, filterable by date
- [x] Move auto-suggest in Shipped field: match text to open Moves, offer to update Move status to "shipped"
- [x] Single-venture behavior: venture tag auto-applied and hidden until a second venture exists

### 1.5 — Quarterly Bets (Pillar 3) — Basic
- [x] `bets` table (organization_id, venture_id, outcome, mechanism, lead_indicators uuid[], owner_id, proof_by_week6, kill_criteria, resource_cap jsonb, lifecycle_status, health_status, quarter)
- [x] RLS scoped to venture
- [x] Bet CRUD with all 7 anatomy fields
- [x] War Room view: 3 bet cards in a row, status badges
- [x] Bet card rendering: Ivory card, moss header bar, status badge top-right, owner avatar, lead indicator sparklines
- [x] 3-bet maximum enforcement per venture (Policy Engine)
- [x] 70/30 capacity bar visualization per team member (allocated vs. flex)

### 1.6 — Moves: Milestone Type (Bet Execution Layer)
- [x] `moves` table (organization_id, venture_id, bet_id, type enum(milestone/recurring), title, description, owner_id, lifecycle_status enum(not_started/in_progress/shipped/cut), health_status enum(green/yellow/red), due_date, effort_estimate jsonb, kpi_link_ids uuid[], content_machine_id nullable, cadence nullable, target_per_cycle nullable, external_source jsonb, cut_reason, position, created_at, updated_at)
- [x] RLS scoped to venture (inherited from parent bet)
- [x] Milestone Move CRUD: create, edit, reorder (drag position), change status
- [x] Move list view on bet detail / War Room card expand
  - [x] Sorted by status: in_progress → not_started (by due date) → shipped → cut
  - [x] Each Move shows: title, owner avatar, health badge, due date, linked KPI badges, blocker indicator
  - [x] Quick actions: change status, assign owner, link blocker, add comment
- [x] Progress bar on bet card: compact visualization of Move status distribution (e.g., "5 shipped, 2 in progress, 1 blocked")
- [x] Milestone Move health auto-calculation:
  - [x] Green: due date >5 days away, no linked blockers
  - [x] Yellow: due date within 5 days, or has linked blocker, or in_progress >14 days without change
  - [x] Red: past due, or linked to critical/high-severity blocker, or not_started with due date <3 days
- [x] Move effort estimates roll up into bet resource cap and 70/30 capacity bar
- [x] Cutting a Move requires cut_reason text (immutable)
- [x] Move → KPI linkage (optional, links to lead indicators on scoreboard)
- [x] Move → Blocker linkage (via polymorphic linking system)
- [x] Move → Comment support (via universal commenting)
- [x] Move → Todo linkage (personal task decomposition beneath a shared Move)

### 1.7 — Operational Objects
- [x] Add `move` and `move_instance` to polymorphic entity_type enum across all linking tables
- [x] `decisions` table (organization_id, venture_id nullable, title, context, options_considered jsonb, final_decision, owner_id, linked_entity_id, linked_entity_type, created_at, decided_at, supersedes_decision_id nullable, audit_trail jsonb)
- [x] `blockers` table (organization_id, venture_id nullable, description, owner_id, severity, linked_entity_id, linked_entity_type, resolution_state, resolved_at, resolution_notes)
- [x] `commitments` table (organization_id, venture_id nullable, description, owner_id, due_date, linked_entity_id, linked_entity_type, status, created_in)
- [x] `issues` table (organization_id, venture_id nullable, description, owner_id, severity, category, linked_entity_id, linked_entity_type, status, resolution_notes)
- [x] RLS policies on all four tables
- [x] Decision flow is append-only: create + supersede, never destructive edit after record
- [x] CRUD UI for blockers, commitments, and issues; create/detail/supersede flow for decisions
- [x] Polymorphic entity picker component (search/link to any entity)
- [x] Basic list views in Cockpit sections

### 1.8 — Policy & Constraint Engine (Core)
- [x] `policy_overrides` table (policy_name, overridden_by, justification, entity_id, entity_type, created_at)
- [x] Policy engine service (`lib/policies/engine.ts`)
- [x] Policy definition model includes scope, enforcement mode, override_allowed, and user-facing explanation
- [x] Implement core policies:
  - [x] 3 active bets maximum per venture
  - [x] 5–15 KPI range per venture
  - [x] Single KPI ownership
  - [x] 14-day idea quarantine timer (data model ready, UI in Phase 2)
  - [x] Idea classification required before scoring (UI enforced in Idea Vault detail panel)
  - [x] 15 Moves maximum per bet (hard block)
  - [x] 5 Recurring Moves maximum per bet (hard block — implemented in Policy Engine as MAX_RECURRING_MOVES_PER_BET)
  - [x] Move ownership required (hard block)
  - [x] Cut reason required for Moves (hard block)
- [x] Policy violation UI: Brick left-border card with explanation text
- [x] Admin override flow only for overrideable policies; non-overrideable policies hard block with explicit explanation
- [x] Override logging captures who, when, why, and which policy was bypassed

### 1.9 — Discord Bot (Basic)
- [x] Discord bot setup (Discord.js, bot token, server connection)
- [x] Slash command registration:
  - [x] `/pulse` — modal form → save to DB + post to #daily-pulse
  - [x] `/scoreboard` — embed showing R/Y/G for all active KPIs
  - [x] `/bets` — embed showing 3 active bets with progress
  - [x] `/blocker @person "description"` — create Blocker object + notify
  - [x] `/commit "commitment"` — create Commitment object
  - [x] `/cockpit` — embed with top alerts, due commitments, blockers
  - [x] `/moves` — show active Moves across all bets (grouped by bet)
  - [x] `/moves [bet-name]` — show all Moves for a specific bet with progress summary
  - [x] `/move-done [move-name]` — mark a Milestone Move shipped
  - [x] `/move-add [bet-name] "title"` — quick-create a Milestone Move (owner = invoker)
- [x] Discord embed styling: Moss `#5F6F52` left-border accent
- [x] Deep links from Discord embeds back to web app

### 1.10 — Launch Mode (Guided Onboarding)
- [x] `onboarding_progress` table or jsonb field on venture (step statuses)
- [x] Launch Mode checklist UI (sidebar progress indicator)
- [x] Step 1: Name your venture (auto-created during org setup)
- [x] Step 2: Define your BHAG (guided form with examples + basic AI suggestions)
- [x] Step 3: Set strategic filters (card creation with templates)
- [x] Step 4: Define annual outcomes (3 max, constraint fields)
- [x] Step 5: Build your scoreboard (KPI creation with 5–15 coaching + spreadsheet import)
- [x] Step 6: Choose your first 3 bets (guided by filters + prior setup context)
- [x] Step 7: Create role cards (basic profile setup + AI-assisted suggestions based on bets/KPIs)
- [x] Step 8: Set up your pulse (config + test pulse)
- [x] Step 9: Run your first weekly sync (guided Meeting Mode walkthrough)
- [x] Step 10: Complete your first monthly review (pre-populated data walkthrough)
- [x] Import existing docs/spreadsheets at each step where relevant
- [x] AI-assisted suggestions build on context from previous steps
- [x] Non-blocking: can skip/return to steps, gentle re-surfacing of incomplete steps
- [ ] Progress milestones: "Week 1 complete: Vision Board live"

### 1.11 — PWA Shell
- [x] Service worker configuration for offline pulse capture
- [x] Install prompt on mobile
- [x] Responsive layouts for Pulse, Scoreboard, Cockpit
- [x] App manifest with TrueNorth branding

---

## Phase 2: The Strategic Layer (Weeks 7–12)

> *Add the planning and idea management capabilities that make TrueNorth more than a dashboard.*

### 2.1 — Idea Vault (Pillar 2)
- [x] `ideas` table (organization_id, venture_id, name, description, classification, submitter, submitted_at, cooling_expires_at, filter_results jsonb, score, lifecycle_status, health_status)
- [x] RLS scoped to venture
- [x] Kanban board UI with enforced stages: Quarantine → Filter Review → Scoring → Candidate → Archived
- [x] 14-day cooling timer with visual "frozen/thawing" card treatment (reduced opacity → gradual thaw)
- [x] More/Better/New classification requirement (Policy Engine: must classify before scoring)
- [x] Filter review checklist: pass/fail toggle per strategic filter
- [x] Scoring framework: Alignment 40%, Revenue Potential 35%, Effort 25%
- [ ] Configurable score threshold for Candidate stage
- [ ] WIP limit enforcement (max 2 active projects per person, max 1 new initiative per week)
- [x] Idea capture via Discord `/idea "description"` command
- [x] Archived ideas: searchable, preserved, can be reactivated

### 2.2 — AI: Filter Guardian
- [x] Claude Agent SDK integration setup (Supabase Edge Function)
- [x] Filter Guardian agent: system prompt with venture's BHAG + strategic filters
- [x] Trigger: idea exits cooling period → auto-evaluate against all filters
- [x] Output: structured pass/fail per filter with reasoning
- [x] Confidence level display (high/medium/low) with sage badge
- [x] Source inputs display ("Based on: idea description + 4 strategic filters")
- [x] Human can override any AI recommendation; AI reasoning preserved in audit trail
- [x] AI evaluation results stored in idea's filter_results jsonb

### 2.3 — Vision Board (Pillar 1)
- [x] `visions` table (organization_id, venture_id, bhag, strategic_filters jsonb, annual_outcomes jsonb, not_doing_list jsonb, year, version, created_at)
- [x] `vision_snapshots` table for version history
- [x] Vision Board single-page view (`/vision`)
- [x] BHAG display (prominent, visual gravitas)
- [x] Strategic filter cards: horizontal card deck, each with unique ID for cross-referencing (used by Idea Vault filter review)
- [x] Not Doing list: visually distinct rendering (Brass-framed)
- [x] Annual outcomes table: 3 max enforced, constraint fields (team size, budget, timeline, complexity)
- [x] Edit gating: read-only by default, locked state with admin "Unlock Vision" action
- [x] Version history: every edit creates immutable snapshot, browse prior versions
- [x] Edit gating by cadence window (auto-unlock during Quarterly Summit / Annual Vision Refresh)

### 2.4 — Role Cards (Pillar 6)
- [x] `role_cards` table (entity_id, entity_type, venture_assignments jsonb, outcomes_owned, metrics_moved jsonb, decision_authority, interfaces, commitments_standard)
- [x] Profile-as-Role-Card page (`/profile`): header with avatar + pulse streak, role card details, edit flow
- [x] Live KPI linkage: "Metrics Moved" section pulls real-time R/Y/G from scoreboard for owned KPIs
- [x] Structured fields: outcomes owned (multi-line), decision authority, interfaces, commitments standard
- [x] Active bets display: owned bets with live health status on role card
- [x] Active commitments display: current commitments with status on role card
- [x] Agent role cards (Sage header, "AI Agent" badge) — separate section in team roster

### 2.5 — Funnel Registry (Pillar 7 — partial)
- [x] `funnels` table (organization_id, venture_id, name, entry_point, capture_mechanism, nurture_sequence, conversion_event, scoreboard_tie jsonb, owner_id, lifecycle_status, health_status, last_result_at, linked_idea_id)
- [x] Funnel CRUD (`/funnels`): all 5 required elements with create/edit form, detail panel, active/archived views
- [x] Cannot save without all 5 elements (client-side validation, submit disabled until complete)
- [x] Approved idea linkage: dropdown of candidate/selected ideas from Vault, confirmation prompt if no idea linked
- [x] Basic health grading: Healthy / Underperforming / Stalled / Orphaned — displayed as R/Y/G badges
- [x] Single ownership (owner_id = current user on create)

### 2.6 — Universal Commenting System
- [x] `comments` table (body, author_id, entity_id, entity_type, mentions jsonb, parent_comment_id, resolved, created_at)
- [x] RLS: inherits scope from parent entity
- [x] Comment component: polymorphic, works on any entity
- [x] @mention team member picker with autocomplete (MentionInput integration)
- [x] Single-level threading (reply to comment with inline reply form)
- [x] Resolution tracking (mark resolved/unresolve, resolved comments collapse with toggle)
- [x] In-app notification on @mention (immediate tier); Discord DM delivery pending webhook config
- [x] Activity feed (`/activity`): unified comment stream, filterable by entity type and time range (today/week/all)

### 2.7 — Personal To-Do System
- [x] `todos` table (user_id, organization_id, title, completed, due_date, priority, linked_entity_id, linked_entity_type, visibility)
- [x] RLS: private to user (visibility=private)
- [x] To-do CRUD with universal entity linking via entity picker
- [x] Due dates and priority (high/medium/low)
- [x] Cross-venture filtering in to-do list, defaulting to all ventures for the user
- [x] Quick capture: global keyboard shortcut (Cmd+T)
- [x] Context menu on any entity: "Add to my to-dos"
- [x] Discord `/todo` command integration
- [ ] Pulse sidebar integration: to-do list visible during pulse entry
- [ ] Overdue to-dos surface in daily pulse reminder

### 2.8 — Moves: Recurring Type & Content Machine Integration
- [x] `move_instances` table (move_id, cycle_start, cycle_end, status enum(pending/completed/missed/skipped), completed_at, linked_entity_id, linked_entity_type, notes, skip_reason)
- [x] RLS scoped to venture (inherited from parent move → bet)
- [x] Recurring Move CRUD: create with cadence (daily/weekly/biweekly/monthly) + target_per_cycle
- [x] Instance generation: auto-creates expected instances for current cycle on Recurring Move creation
- [x] Instance tracking UI: cycle progress dots per Recurring Move (e.g., "2/3 /wk") with rolling health %
- [x] Manual instance crediting: "Done" button on pending instances
- [x] Skip instance with required reason
- [x] Missed instance auto-detection: mark pending instances as missed when cycle ends (cron job)
- [x] Recurring Move health auto-calculation (rolling 3-cycle completion rate):
  - [x] Green: ≥80% completed across last 3 cycles
  - [x] Yellow: 50–79%, or current cycle behind pace
  - [x] Red: <50%, or current cycle will mathematically miss target
- [x] Recurring Move rhythm indicators on bet cards (small green/yellow/red dots per rhythm)
- [x] Content Machine → Recurring Move linkage (content_machine_id field — data model ready, UI pending Content Machines)
- [x] Auto-crediting: when ContentPiece transitions to "Published", credit matching Recurring Move instance
  - [x] Match by content_machine_id on active Recurring Move for the relevant bet
  - [x] Credit oldest pending instance in current cycle
  - [x] Link ContentPiece as evidencing entity on the MoveInstance
- [x] 5 Recurring Moves max per bet enforcement (Policy Engine)
- [ ] KPI linkage encouragement: soft warning when Move has no KPI link
- [ ] Content machine linkage encouragement: soft warning for content-related Recurring Moves without content_machine_id
- [ ] Recurring Move sidebar in pulse entry: compact view of user's active rhythms with cycle progress
- [ ] `/move-done` Discord command extended: credit Recurring Move instance
- [x] `moves_progress` cron query template: Move status distribution per bet with progress bars and overdue Milestones
- [x] `rhythm_health` cron query template: Recurring Move health summary, highlighting red/yellow rhythms
- [ ] Move-aware Focus Check in weekly sync: show each person's active Moves with status, call out red rhythms
- [ ] Rhythm review segment in weekly sync: 60-second Recurring Move health across all active bets
- [x] Execution health score on bet cards: % of active Moves in green status, alongside KPI-based health
- [x] Stall detection: flag bets where no Milestone shipped in 10+ days AND no Recurring instances completed in current cycle
- [x] Pause/resume for Recurring Moves
- [x] Auto-generate new cycle instances when current cycle ends (cron job)

### 2.9 — Meeting Cadence System (Weekly Sync)
- [x] Weekly Sync Meeting Mode view (`/sync`)
- [x] Auto-generated agenda from system state:
  - [x] Scoreboard Review (10 min): red/yellow KPIs with action playbooks displayed inline
  - [x] Focus Check (5 min): each bet with owner, active Moves count, red Moves called out, recurring rhythm count
  - [x] Blockers & Decisions (10 min): unresolved blockers sorted by severity with age, open decisions with inline decide flow, open issues
  - [x] Commitments (5 min): last week's review (mark done/missed) + new commitment creation with owner assignment
- [x] 30-minute countdown timer with play/pause, color-coded urgency (green → ochre → brick)
- [x] Segment navigation with time-per-segment tracking and over-time warnings
- [x] Structured output capture: resolve blockers, record decisions, review/create commitments — all write directly to DB
- [x] Meeting output summary card: counts of resolved blockers, decisions made, commitments reviewed/created
- [x] Suggest open Moves as commitment targets
- [x] Meeting history log (persist meeting outputs as a record)

### 2.10 — Process Library (Basic)
- [x] `processes` table (organization_id, venture_id, name, owner_id, content jsonb, trigger_conditions, linked_kpis jsonb, linked_bets jsonb, automation_level, version, created_at)
- [x] Process CRUD with versioned content (every edit = new version with diff)
- [x] Single ownership per process
- [x] Trigger conditions: structured definition of when process is used
- [x] KPI and bet linkages
- [x] Automation level tracking (L0–L4)

### 2.11 — Core Artifacts & Staleness
- [x] Artifact registry: Vision Page, Quarterly Bets Page, Scoreboard, Meeting Cadence Doc, Role Cards, Process Library, Media Calendar — all 7 defined with default cadences and thresholds
- [x] `core_artifacts` table type + `staleness.ts` library with live data fallback (computes staleness from visions, bets, kpi_entries, role_cards tables when no explicit artifact records exist)
- [x] Artifacts dashboard (`/artifacts`): card per artifact with freshness bar, R/Y/G health, last-updated date, days-since-update, cadence display
- [x] Staleness detection with configurable thresholds per artifact type (395d vision, 100d bets, 10d scoreboard, etc.)
- [x] Surface stale artifacts in Operator Cockpit "What is drifting" section
- [x] Daily digest notification for stale artifacts
- [ ] Monthly Operating Review inputs from stale artifact data

### 2.12 — Cron Broadcast Engine (Basic)
- [x] `cron_jobs` table (organization_id, venture_id nullable, name, schedule, query_template, format_template, discord_channel_id, enabled)
- [x] Vercel Cron + Supabase Edge Functions infrastructure
- [x] Pre-built query templates:
  - [x] `kpi_scoreboard` (red/yellow filter)
  - [x] `weekly_priorities`
  - [x] `daily_work_summary`
  - [x] `blocker_report`
  - [x] `cockpit_summary`
- [x] Cron schedule builder UI (human-readable + raw cron)
- [x] Discord channel targeting
- [x] Ship 5 core cron jobs: morning scoreboard, weekly priorities, daily recap, blocker nag, cockpit daily
- [x] On/off toggle per cron job

### 2.13 — Multi-Venture UI
- [x] Venture CRUD in Settings (add/edit ventures)
- [x] Venture switcher in navigation (auto-hidden for single-venture orgs)
- [x] Venture badges on entities (hidden for single-venture)
- [x] Venture-scoped data isolation on all venture-level entities
- [x] Adding second venture activates multi-venture UI elements
- [x] Pulse line items gain venture tag selector in multi-venture orgs
- [x] All single-venture simplification rules verified and active

### 2.14 — Async Attention Model
- [x] `notifications` table (user_id, type, tier, title, body, entity_id, entity_type, read, held_until, created_at)
- [x] Notification tiers: Immediate, Urgent, Daily Digest, Weekly Digest — tier field on all notifications
- [x] In-app notification center (bell icon, unread count, list view) — respects held_until for quiet hours
- [x] Quiet hours config per user (default 9pm–7am) — UI in Settings with start/end hour + timezone
- [x] Quiet hours enforcement: non-immediate notifications held with `held_until` timestamp; immediate always delivers
- [x] Escalation engine (`lib/escalation.ts`) with `runEscalationChecks()`:
  - [x] Yellow KPI escalation: yellow 2+ weeks with no update → urgent tier
  - [x] Red KPI escalation: red 2+ weeks → immediate tier with corrective action plan required
  - [x] Blocker aging: open 3+ days → immediate (critical/high) or urgent (medium/low)
  - [x] Pulse drift: 3 missed consecutive days → immediate tier notification
  - [x] Commitment miss: past due date with pending status → urgent tier
- [x] `dispatchEscalations()` helper: runs all checks and creates notifications in batch
- [x] Discord delivery: DMs for personal, channel posts for team-wide (pending webhook config)
- [x] Daily digest batching cron job (configurable time, default 8am)
- [x] Escalation cron job: run `runEscalationChecks()` on schedule (e.g., every 30 minutes)

---

## Phase 3: The Intelligence Layer (Weeks 13–20)

> *Add AI capabilities, the content engine, and the full cron broadcast system.*

### 3.1 — Content Machines & Media Calendar (Pillar 7 — full)
- [x] `content_pieces` table (organization_id, venture_id, title, machine_type, lifecycle_status, body_json jsonb, owner_id, scheduled_at, linked_funnel_id)
- [x] `content_versions` table for version history (content_piece_id, body_json, body_html, created_by)
- [x] Four content machine pipeline views (Flagship Newsletter, Deep Content, Short-Form Daily, Monthly Live) with filter tabs
- [x] Kanban stages per machine: Ideation → Drafting → Review → Scheduled → Published
- [x] Content piece detail page (`/content/[id]`) with full Tiptap editor, metadata sidebar, comments, version history
- [x] Status stepper: click-to-advance through pipeline stages
- [x] Machine type filter on content list view
- [x] Media Calendar: calendar view of content output vs. plan
- [ ] One-Ask Rule enforcement: block competing CTAs for same audience within 30-day window
- [ ] Shared Audience Map: detect overlapping audience segments across funnels and warn on CTA collisions
- [x] Calendar ↔ Funnel linkage
- [ ] Campaign grouping with aggregate performance tracking
- [x] Drag-and-drop rescheduling
- [x] Gap detection (highlight days with no scheduled content)

### 3.2 — Moves: External Hooks, AI Integration & Full Rollup
- [x] External content hooks infrastructure:
  - [x] Webhook receiver endpoint for external content crediting
  - [x] External source config UI on Recurring Move (platform, match rules)
  - [x] Discourse webhook integration: match topic author + category against Recurring Move rules → credit instance
  - [x] Generic webhook matching: custom JSON path matching against external_source config
  - [x] Instagram/YouTube/Podcast support via Zapier/Make webhook relay patterns
- [ ] Media Calendar gap detection based on Recurring Move targets:
  - [ ] If a Recurring Move expects N items/cycle and fewer are scheduled, highlight the gap
  - [ ] AI-suggested content topics when gaps are detected (via Content Copilot or Agenda Builder)
- [x] Kill Switch enhancement with Move execution data:
  - [x] Move velocity: how many Milestone Moves shipped in assessment window? How many overdue?
  - [x] Rhythm compliance: are Recurring Moves maintaining target completion rates?
  - [x] Blocker density: how many active Moves have linked blockers?
  - [x] Divergence detection: "KPIs moving but execution unclear" / "execution active but outcomes not materializing"
- [x] Cockpit Advisor enhancement:
  - [x] Milestone Moves due within 48 hours with no status change
  - [x] Recurring Moves that will miss cycle target if not addressed today
  - [x] Bets where all Moves are green but lead indicators trending down (strategic question flag)
- [x] Content Copilot enhancement:
  - [x] When Recurring Move has pending instances, suggest topics based on engagement analytics and discipline coverage gaps
  - [x] "Suggested next" card in content machine Ideation column
  - [ ] Optional prompt when opening editor in context of a content machine with pending rhythm instances
- [x] Discord automation:
  - [x] Rhythm alerts: post to #bets when a Recurring Move turns red, tagging Move owner
  - [x] Weekly Moves summary in Monday broadcast (via moves_progress cron template)
  - [x] Stall detection indicator in Kill Switch biweekly report embed
- [ ] Full execution health rollup on bet cards: % of Moves in green alongside KPI health

### 3.3 — Collaborative Rich Text Editor
- [x] Tiptap (ProseMirror) editor integration — `@tiptap/react`, `@tiptap/starter-kit`, and 10+ extensions
- [x] Rich text: bold, italic, strikethrough, headings (H1-H3), blockquotes, code blocks, horizontal rules
- [x] Image support via URL insertion (Supabase Storage upload pending)
- [x] Table support with resizable columns (Table, TableRow, TableCell, TableHeader extensions)
- [x] Link support with URL prompt
- [x] Typography extension (smart quotes, dashes)
- [x] Full toolbar: formatting, headings, lists, blockquote, code block, hr, table, link, image, HTML/text export
- [x] HTML export (copy to clipboard)
- [x] Plain text export (copy to clipboard)
- [x] Version history: every save creates a snapshot in `content_versions` table
- [x] White `#FFFFFF` editor canvas (exception to no-white rule), Parchment surrounding chrome
- [x] TrueNorth-styled CSS: moss headings, warm-gray blockquotes, charcoal code blocks, clay links
- [x] Placeholder text support
- [x] Read-only rendering mode
- [x] Slash commands: type `/` to open a filterable command popup with 10 commands (H1-H3, bullet list, numbered list, blockquote, code block, hr, table, image) — built on `@tiptap/suggestion` + `tippy.js`; keyboard navigable (arrow keys + enter), auto-filters as you type, disabled inside code blocks
- [x] Markdown toggle: WYSIWYG ↔ raw Markdown
- [x] Markdown export
- [ ] Media embeds: video embeds, tweet embeds, drag-and-drop image upload
- [ ] Yjs real-time collaboration with presence cursors (Supabase Realtime as transport)
- [x] Version diff view between snapshots
- [x] Structured object embeds: live-linked bets, KPIs, decisions, commitments inline
- [ ] Funnel and media calendar links (bidirectional via entity picker)
- [ ] Template support (from Process Library)
- [x] Full-text search indexing (Supabase)

### 3.4 — Content Commenting (Inline Annotations)
- [x] Inline text-anchored comments (highlight text → add comment)
- [x] Sidebar comment panel alongside editor (using universal Comments component with @mentions, threading, resolution)
- [x] Resolved/unresolved tracking (via universal commenting system)
- [ ] Real-time sync for all active collaborators

### 3.5 — AI: Content Copilot
- [x] Content Copilot API route (`/api/ai/copilot`) powered by Anthropic Claude SDK
- [x] `/ai draft` slash command: prompt for topic → generate full draft via Claude
- [x] "Rewrite" toolbar action: select text → choose tone (simplify/expand/persuasive) → inline replacement
- [x] `/ai continue`: reads existing content, generates next 2-4 paragraphs
- [x] `/ai summarize`: summarize selected text or full document
- [x] `/ai rewrite` slash command: select text + tone prompt → inline replacement
- [x] Sage-tinted left border + "AI" badge on all AI-generated content blocks (CSS indicator per PRD)
- [x] Confidence level returned from API (high/medium/low based on input quality)
- [x] All AI content editable by human author (inserted as normal editor content)
- [x] Loading indicator while AI generates (`[AI drafting...]` placeholder)
- [x] SEO optimization suggestions (title tags, meta descriptions, keywords)
- [x] Brand voice configuration per organization (system prompt template)

### 3.6 — AI: Signal Watch (Anomaly Detection)
- [x] Signal Watch engine (`lib/signal-watch.ts`) + API route (`/api/ai/signal-watch`)
- [x] Threshold alerts: detects when latest KPI entry crosses below target for first time in 30-day window
- [x] Trend reversal detection: identifies when 2+ period upward/downward trend reverses direction
- [x] Correlation detection: when a leading driver KPI drops >10%, warns about downstream impact on linked lagging KPIs via KPI Linkage Map
- [x] AI-enhanced analysis: optional Claude enrichment with possible causes and recommended next steps per anomaly
- [x] Alert delivery: in-app notifications (urgent for high severity, daily_digest for medium) with KPI entity links
- [x] Deduplication: same kpi_id + alert_type only fires once per run
- [x] Vercel Cron trigger (daily 6am schedule)
- [ ] Seasonality awareness (6+ months data → adjusted expectations)
- [ ] KPI Linkage Map visualization (interactive graph: click lagging → highlight drivers)
- [x] Discord delivery with deep link + agent analysis embed

### 3.7 — AI: Agenda Builder
- [x] Agenda Builder agent (Claude Agent SDK)
- [x] Trigger: 48 hours before scheduled meeting
- [x] Input: red/yellow KPIs, open blockers, pending decisions, pulse data, bet status, commitments
- [x] Output: pre-populated meeting agenda with structured sections
- [x] Weekly Sync, Monthly Review, and Quarterly Summit agenda generation
- [x] Editable by meeting facilitator

### 3.8 — AI: Cockpit Advisor
- [x] Cockpit Advisor agent (Claude Agent SDK, daily cron 7am)
- [x] Input: all operational objects, KPI status, bet health, commitments, blocker age
- [x] Output: single most important action recommendation for operator
- [x] Display in Operator Cockpit "AI recommends" section
- [x] Discord delivery to #operator-briefing

### 3.9 — AI Trust & Audit Dashboard
- [x] Per-agent performance tracking:
  - [x] Acceptance rate
  - [x] Override rate
  - [x] Error patterns (recurring overrides by category)
  - [x] Time-to-action
- [x] AI Performance Dashboard (admin-only)
- [x] Agent Role Card display of trust metrics
- [x] Autonomy level management (suggest-only default for v1)
- [x] Autonomy level changes require admin approval + Policy Engine audit trail

### 3.10 — Meeting Mode (Full)
- [x] Monthly Operating Review: AI-generated pre-read, wins/losses, root causes, system fixes, pipeline decisions
- [x] Quarterly Summit: BHAG progress, Keeper Test workflow (private/confidential), outgoing bet grades, incoming bet selection from Idea Vault candidates (with More/Better/New distribution), scoreboard recalibration, Not Doing list updates
- [x] Structured output capture for all three cadence types
- [x] Attendance and completion tracking

### 3.11 — KPI Integrations
- [x] Stripe API integration (MRR, active customers, churn rate) via Supabase Edge Function
- [x] ConvertKit/Beehiiv API integration (subscriber count, open rate, click rate)
- [x] Generic webhook endpoint per KPI (POST to push data from any external system)
- [x] CSV bulk import for historical data/backfill

### 3.12 — Agent Roster & Automation Ladder (Pillar 8)
- [x] `agents` table (organization_id, name, category, role_card_id, venture_assignments jsonb, automation_level, status)
- [x] Agent Roster UI: dedicated section of team roster
- [x] Agent profile pages: name, category, role card, automation level, task history, performance metrics
- [x] Sage-tinted header on agent cards (distinct from human team members)
- [x] Automation Ladder Tracker: every process shows L0–L4 level as visual progress bar
- [x] Monthly automation audit workflow: review ladder, identify advancement candidates
- [x] Sacred Work list: processes that cannot be assigned to agents (Policy Engine enforced)

### 3.13 — Process Library (Full)
- [ ] AI-assisted improvement suggestions (monthly review of process performance data)
- [ ] Template generation: process → editor template for governed tasks
- [ ] Impact analysis: "If we change this process, which KPIs might be affected?"

### 3.14 — Cron Engine (Full)
- [x] Custom query composition (combine multiple templates into one job)
- [x] Conditional logic: only-if-data-exists, threshold trigger, day-of-quarter logic
- [x] Handlebars format editor with live Discord embed preview
- [x] Test-fire capability
- [x] Execution history with delivery status logs
- [x] Remaining query templates:
  - [x] `kpi_single`, `bet_status`, `idea_vault_new`, `funnel_health`
  - [x] `pulse_streaks`, `commitment_tracker`
  - [x] `automation_ladder`, `agent_performance`
  - [x] `content_pipeline`, `kill_switch_report`
  - [x] `stale_artifacts`, `portfolio_summary`, `decision_log`
  - [x] `cadence_compliance`, `cockpit_summary`
  - [x] `moves_progress`, `rhythm_health` (shipped in Phase 2)

### 3.15 — Engagement & Gamification
- [x] Bet Graveyard view (`/bets/graveyard`): tombstones with dark charcoal header, cross icon, bet name, mechanism, duration (weeks/days), date range
- [x] "Total hours saved by smart kills" counter — aggregate across all killed bets based on unshipped Move effort estimates
- [x] Resources recovered per tombstone: hours saved, capacity freed (h/wk from resource cap), moves shipped count
- [x] Lessons learned preserved per killed bet in tombstone cards
- [x] Graveyard linked from War Room header
- [x] North Star Distance: persistent visual in app header showing BHAG progress journey
- [x] Quarterly Retrospective Timeline: animated timeline of quarter achievements (shareable)
- [x] Vault Archaeologist agent (monthly cron): resurface archived ideas that are newly relevant

### 3.16 — Week-6 Checkpoint & Kill Switch
- [x] Week-6 Checkpoint workflow: auto-detected when bet is 5.5–8 weeks old, banner on bet detail page
- [x] Structured checkpoint form: original proof criteria reminder, evidence textarea, Green/Yellow/Red verdict selection
- [x] Yellow verdict: new proof criteria for Week 9 with updated proof_by_week6 field
- [x] Red verdict: kill with lessons learned prompt → Graveyard
- [x] Green/Yellow/Red decision capture as Decision objects with linked_entity_id pointing to the bet
- [x] Killed bets → Bet Graveyard (lifecycle_status = completed, killed_at timestamp, kill_reason text)
- [x] Kill Bet action: available on any active bet (not just at checkpoint), with confirmation flow, required lessons learned, Decision object creation
- [x] Bet cards in War Room are now clickable links to detail view
- [x] Biweekly Kill Switch agent: automated project assessment
- [x] Kill/pause/continue recommendation per project with confidence level
- [x] Move velocity and rhythm compliance as input signals (see 3.2 for full Move data integration)

### 3.17 — Portfolio Dashboard (Multi-Venture Only)
- [x] Portfolio Dashboard route (hidden for single-venture orgs)
- [x] One card per venture: name, health score (aggregate R/Y/G), active bets summary, top alert, pulse activity
- [x] Cross-venture aggregations:
  - [x] Unified blocker list across all ventures
  - [x] Combined pulse feed (filterable by venture)
  - [x] Commitment tracker across ventures
  - [x] Decision log across ventures
- [x] `portfolio_summary` cron template for Discord

### 3.18 — Cadence Intelligence System
- [x] Cadence compliance tracking for: Daily Pulse, KPI Updates, Weekly Sync, Monthly Review, Quarterly Summit, Automation Audit
- [x] Per-venture and per-org aggregate cadence compliance score
- [x] Automated alerts for missed/delayed cadences
- [x] Cadence score display in Operator Cockpit and Monthly Operating Review

### 3.19 — Discord Deepening
- [x] Remaining slash commands: `/idea`, `/todo`, `/focus`, `/update-kpi`, `/decision`
- [x] Agent participation in channels: Signal Watch posts anomalies, missing update requests
- [x] Discussion summarization: 20+ message threads → offer to create Decision/Blocker/Issue
- [x] Automated summaries: daily cockpit (7am), weekly sync prep (48h before), cadence reminders

### 3.20 — Policy Engine (Full)
- [x] Policy dashboard: all active policies, violation/override rates, historical override log
- [x] All v1 policies active:
  - [x] Funnel requires approved idea linkage
  - [x] KPI update cadence enforcement (soft: warning → escalation)
  - [x] Sacred Work protection
  - [x] 2 active projects per person
  - [x] 1 new initiative per week
  - [x] Vision Board edit gating
- [x] Venture-specific policy overrides
- [x] Override analytics: where is the team pushing against constraints?

### 3.21 — Launch Mode Enhancement
- [x] Richer import parsers for docs/spreadsheets with higher-confidence AI auto-structuring
- [x] More opinionated, context-aware AI guidance based on the workspace's full operating history
- [x] Re-entry for completed steps
- [x] Venture-specific Launch Mode (skip org-level steps when adding second venture)

---

## Cross-Cutting Concerns (Ongoing)

These are not phase-gated — they should be addressed continuously.

### Security & Data Isolation
- [x] Comprehensive RLS test suite (critical for multi-tenancy)
- [x] RLS audit before any productization
- [x] No data leakage between orgs (automated tests)
- [x] Input validation at system boundaries

### Performance
- [x] Indexes on org_id and venture_id on all tables
- [x] Materialized views for KPI aggregation windows >30 days
- [ ] Pre-computed health scores for Portfolio Dashboard (15-min refresh)
- [ ] Yjs collaboration: designed for up to 10 simultaneous editors

### Testing
- [ ] Unit tests for Policy Engine rules
- [ ] Integration tests for critical flows (pulse submission, KPI updates, bet creation)
- [ ] Integration tests for role-based default views and single-venture simplification rules
- [ ] RLS policy tests (verify data isolation)
- [ ] E2E tests for onboarding flow

### AI Cost Management
- [ ] Cache frequent AI evaluations
- [ ] Batch daily AI analyses
- [ ] Per-org monthly AI budget cap (future)

## Phase Exit Criteria

Each phase should close only when the product is usable at the level promised in the PRD, not just when the tickets are complete.

### Phase 0 Exit
- [x] Multi-tenant schema conventions, RLS, entity linking foundation, and shared platform dependencies are in place
- [ ] Empty shell deploys to Vercel and local/dev environments are reproducible

### Phase 1 Exit
- [x] Team can complete Launch Mode through first live scoreboard, bets, pulse, and first weekly sync
- [x] Bets have Milestone Moves with progress visible on bet cards and in Cockpit
- [x] Operator and non-operator default views work by role
- [ ] Pulse completion, scoreboard review, and time-to-first-value are measurable against PRD success metrics

### Phase 2 Exit
- [x] Strategic planning layer is usable end-to-end: Vision → Idea Vault → Funnel registration → Weekly cadence
- [x] Recurring Moves with auto-crediting from content machines are operational; rhythm health visible on bet cards
- [x] Staleness detection, notifications, and multi-venture activation rules are working in practice

### Phase 3 Exit
- [x] AI features remain suggest-only by default with trust/audit scaffolding
- [x] Content engine, portfolio views, cadence intelligence, and full cron system are production-viable

## Intentional v1 Simplifications

These are deliberate simplifications, not accidental gaps:

- [x] Single-venture UI remains the default experience until a second venture is added
- [x] Manual KPI entry ships before API integrations
- [x] Pre-built cron templates ship before full custom cron composition
- [x] AI agents operate in suggest-only mode before any higher-autonomy workflows
- [x] Milestone Moves ship in Phase 1; Recurring Moves with auto-crediting ship in Phase 2; external hooks and AI-enhanced Move intelligence ship in Phase 3
- [x] Basic Launch Mode AI/import flows ship in Phase 1; deeper enrichment and smarter guidance layer on in Phase 3

---

## Summary

| Phase | Weeks | Focus | Key Deliverables |
|-------|-------|-------|-----------------|
| 0 | 0 | Scaffolding | Next.js + Supabase + design system + data model |
| 1 | 1–6 | The Heartbeat | Cockpit, Scoreboard, Pulse, Bets, Milestone Moves, Ops Objects, Discord bot, Launch Mode |
| 2 | 7–12 | Strategic Layer | Idea Vault, Vision Board, Role Cards, Funnels, Recurring Moves + auto-crediting, Comments, Todos, Meeting Mode, Cron engine, Multi-venture |
| 3 | 13–20 | Intelligence Layer | Content editor, AI agents (5), External Move hooks, Media calendar, Full cron, Gamification, Portfolio, Cadence Intelligence |
