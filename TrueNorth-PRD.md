# TRUENORTH

## BUSINESS OPERATING SYSTEM

### Product Requirements Document

**Version 2.0 — March 2026**

Nerd Out Enterprises

**CONFIDENTIAL**

---

## 1. Executive Summary

TrueNorth is a custom business operating system designed for digital products and media businesses. This PRD defines the software application that brings the TrueNorth framework to life as an interactive, AI-augmented platform. The system replaces the collection of documents, spreadsheets, and tribal knowledge that typically powers a business operating system with a single, opinionated application that enforces the system's rules, automates its cadences, and provides real-time visibility into business health.

The application is built for Nerd Out Enterprises as the first customer, but is architected from day one to support multi-tenant SaaS deployment for other operators and small teams running digital businesses.

**Core thesis:** Most business operating systems fail not because the framework is wrong, but because the team stops doing the work. TrueNorth software makes the right behavior the path of least resistance by embedding the system's rules, cadences, and constraints directly into the product experience.

### 1.1 Decision Log

The following architectural and product decisions were finalized during requirements gathering and are binding for v2 development:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target audience | Internal-first, architected to productize | Use Nerd Out as proving ground; multi-tenant data model from day one |
| Infrastructure | Supabase + Vercel | Existing team expertise; Supabase provides auth, Postgres, real-time, edge functions |
| Content editor | Full collaborative editor with HTML/Markdown export | Content machines require production-grade drafting; Tiptap recommended |
| Personal to-dos | Universal linking to any entity across all pillars | Operators think in connections, not silos; polymorphic foreign keys |
| Cron / Discord system | Full flexibility: custom queries, formatting, schedules per channel | Power users need a broadcast engine, not predefined templates |
| AI priority #1 | Auto-evaluate ideas against strategic filters | Highest-leverage automation; enforces the Anti-Distraction Engine |
| AI priority #2 | Content drafting assistance inside the editor | Direct revenue impact; content velocity is a leading KPI |
| AI priority #3 | KPI anomaly detection and proactive alerts | Early warning system; "data as immune system" philosophy |
| AI priority #4 | AI-drafted meeting agendas and summaries | Quality-of-life; reduces meeting prep overhead |
| Commenting | Universal across all entities with Discord @mention notifications | Async-first culture requires rich, connected commentary |
| KPI data entry | Manual + key API integrations (Stripe, ConvertKit) | Balance of speed-to-ship and real utility |
| AI agents in UI | Visible but separate from human team members | Agents are team members but need distinct UX treatment |
| Mobile | PWA with responsive design | Pulses, to-dos, and scoreboard must work on mobile |
| Multi-venture hierarchy | Org → Venture model with single-venture simplification | Operators running multiple ventures need unified personal tools (pulse, to-dos) with isolated operational contexts (bets, KPIs, vision) per venture; single-venture users see no multi-venture UI |
| Default surface | Operator Cockpit ("Today" view) as home screen | The OS needs a default operating surface that pulls all modules together into an immediate-action view |
| First-class operational objects | Decision, Blocker, Commitment, and Issue as structured entities | Comments and discussions are insufficient for accountability loops; these objects power cadence workflows |
| Policy enforcement | Central Policy & Constraint Engine | TrueNorth philosophy rules must be executable constraints, not just guidelines |
| Onboarding | Launch Mode guided implementation | The 30-day implementation path should be a product experience, not documentation |
| AI trust model | Explicit approval, audit, and confidence mechanics for all AI output | AI-generated output requires trust scaffolding: source inputs, confidence levels, approval workflows |
| Bet execution tracking | Moves as bet-scoped Milestone and Recurring work items with auto-crediting | Fills the gap between strategic bets and private to-dos; deliberately constrained to prevent TrueNorth from becoming a project management tool |

---

## 2. Product Vision and Principles

> *TrueNorth software is an operator's cockpit, not a project manager. It tells you where you are, what's drifting, and what needs your attention right now. It enforces the system so the team can focus on the work.*

### 2.1 Design Principles

- **Opinionated by default.** The software enforces TrueNorth rules (3-bet max, 14-day idea quarantine, 5–15 KPI limit) as hard constraints, not suggestions. Override requires explicit admin action with audit logging.

- **Async-first UX.** Every interaction is designed for asynchronous teams. Status updates never require a meeting. The Daily Pulse takes under 2 minutes. Discord is a first-class interaction surface.

- **AI as co-operator.** AI agents are not hidden background services. They are visible team members with names, role cards, and measurable output. The Claude Agent SDK powers evaluation, drafting, and anomaly detection. All AI output includes explicit trust signals: source inputs, confidence levels, and approval state.

- **Cadence-driven.** The application's navigation, notifications, and default views change based on where you are in the quarterly cycle. Week 6 surfaces the checkpoint. Month-end surfaces the operating review. The Today view always answers "What needs your attention right now?"

- **Fun to use.** Streaks, visual progress, a bet graveyard that celebrates smart kills, and North Star distance tracking make the system engaging, not punishing.

- **Discipline-as-product.** The system enforces TrueNorth philosophy rules through a central Policy & Constraint Engine. Violations are blocked with explanations, not just warnings. Overrides are logged, not hidden. The product should feel like TrueNorth enforcing discipline, not just documenting it.

- **Scale-ready from day one.** The architecture supports 2–10 person teams with zero friction and 100+ person organizations without a rebuild. Role-based views, venture segmentation, permissioning, and aggregation layers are structural, not bolted on.

### 2.2 User Personas

- **The Operator (primary):** Founder or CEO running 1–3 digital ventures. Makes strategic decisions, sets bets, manages the scorecard. Needs the cockpit view and the anti-distraction engine. Uses both web and mobile. The Operator Cockpit is their default home screen.

- **The Team Member:** Contributor working on active bets. Posts daily pulses, manages personal to-dos, drafts content in the editor, and tracks their own KPIs. Primarily interacts via Discord and mobile PWA. The Team Member Cockpit is their default home screen.

- **The Agent:** An AI agent (from the Pantheon roster) with a dedicated role card, assigned tasks, and measurable output. Visible in the team roster but with distinct UX treatment.

---

## 3. Visual Design Language & Color System

### 3.1 Design Philosophy

The TrueNorth visual identity is a premium operator's palette: grounded, strategic, calm under pressure, and built for people running real businesses. The product should feel like an operator's cockpit — cadence-driven, AI-augmented, and designed to replace a patchwork of docs and spreadsheets with a single system of record. The color system is stable, opinionated, and quietly powerful, not trendy or overly cheerful.

> *The emotional starting point is cultivated land, parchment, iron, moss, clay, and brass. The palette should feel like it belongs to a business operating system that helps a team make better decisions, kill weak bets early, monitor the scoreboard, and keep marching toward a long-term North Star.*

The design world of TrueNorth is not playful pastel SaaS, and it is not hard-edged enterprise blue. It is a strategic, earth-toned cockpit for operators. If the designer gets the emotional mix right — warm enough to feel human, disciplined enough to feel operational, and distinctive enough to be memorable — the software will feel like a true operating system for running a serious digital business.

### 3.2 Core Color Palette

The following hex values define the canonical TrueNorth color system. All UI components, marketing materials, and generated exports must use these values or their approved tint/shade variants.

**Primary Brand Anchor: Moss**

| Role | Hex | Usage |
|------|-----|-------|
| Moss (Primary) | #5F6F52 | Headers, navigation, primary framing surfaces, brand identity moments. Communicates steadiness, judgment, and long-term thinking. Not bright "eco" green or default startup green — mature and slightly weathered, like a sophisticated agricultural green with gray and brown in it. |

**Foundation Neutrals**

| Role | Hex | Usage |
|------|-----|-------|
| Parchment | #F4EFE6 | Primary background surface. Warm and readable for long sessions. Gives the system character and makes it feel like a refined, living operating manual rather than a sterile admin panel. |
| Ivory | #FDFAF5 | Card surfaces, modals, elevated containers. Subtle layering against parchment background. Warm borders and soft shadows only. |
| Charcoal | #2F2B28 | Primary text, structural elements. Deep warm dark with brown undertone — never pure black or cool blue-gray. Decisive, disciplined, high-context. |
| Warm Gray | #7A756E | Secondary text, captions, metadata, timestamps, placeholder text. Readable but recessive. |
| Warm Border | #D9D3C7 | Borders, dividers, table rules, subtle structural lines. Visible but unobtrusive. |

**Accent Colors**

| Role | Hex | Usage |
|------|-----|-------|
| Clay (Primary Accent) | #B85C38 | Primary calls to action, active states, buttons that ask the user to commit, ship, publish, or decide. Warm disciplined energy — sun-baked earth or fired ceramic, not consumer-app orange. Keeps the product warm and alive without making it noisy. |
| Brass (Secondary Accent) | #B69A45 | Premium emphasis, used sparingly: milestone states, sacred or strategic elements (Vision Board, Not Doing list), badges, streak achievements, elevated data moments. Makes the palette distinctive and editorial. Must never dominate the UI. |

**Semantic Status Colors**

Status colors are integrated into the brand rather than pasted on top. They are slightly muted and consistent with the earth-toned palette, but remain instantly legible in dashboards and scoreboard views.

| Status | Hex | Usage | Contrast Notes |
|--------|-----|-------|----------------|
| Green (Moss variant) | #6B8C54 | On track, healthy, target met. KPI green status, bet "continue" state, healthy funnel grade. | Relates to the primary moss family |
| Ochre (Harvest gold) | #C49B2D | Caution, below target but stable. KPI yellow status, bet "pivot" state, underperforming funnel. | Feels like harvest-gold, not neon amber |
| Brick (Oxide red) | #A04230 | Critical, needs action. KPI red status, bet "kill" state, stalled or orphaned funnel. | Leans toward brick or oxide, not bright alert red |

**AI Agent Layer**

| Role | Hex | Usage |
|------|-----|-------|
| Sage | #8B9E82 | AI-related surfaces, agent profile cards, AI-generated content indicators, Copilot UI chrome. A slightly cooler, mistier variation within the moss family. Agents feel like recognized members of the operating system — co-operators, not sci-fi bolt-ons. Combined with brass accents for premium AI moments. |

### 3.3 Application Rules

The following rules govern how the palette is applied across the product interface:

- **Background hierarchy:** Parchment (#F4EFE6) as the base page background. Ivory (#FDFAF5) for cards, modals, and elevated containers. No flat white (#FFFFFF) surfaces in the primary UI except inside the content editor canvas.

- **Text hierarchy:** Charcoal (#2F2B28) for all primary body text, headings, and labels. Warm Gray (#7A756E) for secondary text, timestamps, and metadata. Never use pure black (#000000) or cool gray.

- **Moss dominance:** The primary moss green (#5F6F52) should be present on every screen via the navigation bar, page headers, or key framing elements. It anchors the brand identity. Avoid using moss for small, scattered UI elements — it should feel structural, not decorative.

- **Clay for action:** All primary buttons, active toggle states, and destructive-but-intentional actions (publish, commit, kill a bet) use clay (#B85C38). Hover states darken by 10%. Disabled states desaturate by 40%.

- **Brass sparingly:** Brass (#B69A45) is reserved for premium moments: the Vision Board header, BHAG progress indicator, streak milestone badges, the Not Doing list frame, and Quarterly Summit branding. If brass appears more than 3 times on any single screen, it has been overused.

- **Sage for AI:** Any surface, badge, or indicator that represents AI-generated content or an AI agent uses sage (#8B9E82) as its distinguishing color. This includes the Content Copilot toolbar, agent profile cards, the Filter Guardian evaluation panel, and AI-generated content markers in the editor. AI confidence indicators use sage tints (lighter = lower confidence, darker = higher confidence).

- **Status colors in context:** R/Y/G status indicators use the branded semantic colors (Moss Green, Ochre, Brick) with filled dots, pills, or background tints — never bordered-only. Status must be legible at a glance on the scoreboard. In dense data views (scoreboard, bet status), the status color may be used as a subtle left-border or row tint.

- **Dark mode (future):** When implemented, dark mode inverts the hierarchy: Charcoal becomes the page background, Parchment becomes the text color, and accent colors (clay, brass, status) remain unchanged but with increased luminance for contrast.

### 3.4 Typography

The typographic system reinforces the "field manual for modern operators" aesthetic. It should feel clear, authoritative, and information-dense without becoming clinical.

| Element | Font | Weight | Size | Color |
|---------|------|--------|------|-------|
| Page titles / H1 | Inter or DM Sans | 700 (Bold) | 28–32px | Charcoal (#2F2B28) |
| Section headers / H2 | Inter or DM Sans | 600 (Semibold) | 22–24px | Charcoal (#2F2B28) |
| Subsection headers / H3 | Inter or DM Sans | 600 (Semibold) | 18–20px | Moss (#5F6F52) |
| Body text | Inter or DM Sans | 400 (Regular) | 15–16px | Charcoal (#2F2B28) |
| Secondary text / captions | Inter or DM Sans | 400 (Regular) | 13–14px | Warm Gray (#7A756E) |
| KPI values / data | JetBrains Mono or IBM Plex Mono | 500 (Medium) | 20–28px | Charcoal (#2F2B28) |
| Badges / labels | Inter or DM Sans | 500 (Medium) | 12–13px | Varies by context |
| Code / cron expressions | JetBrains Mono | 400 (Regular) | 14px | Charcoal on Parchment |

Inter is the recommended primary typeface for its excellent legibility at small sizes, comprehensive weight range, and neutral-warm character. DM Sans is an acceptable alternative with a slightly more rounded, approachable feel. Monospace fonts (JetBrains Mono or IBM Plex Mono) are used exclusively for data values, KPI numbers, cron expressions, and code blocks.

### 3.5 Component Surface Treatments

These rules define how cards, panels, and interactive elements are rendered across the product:

- **Cards:** Ivory (#FDFAF5) background, 1px Warm Border (#D9D3C7), 4–8px border radius, subtle warm shadow (0 2px 8px rgba(47,43,40,0.06)). No harsh drop shadows.

- **Navigation:** Moss (#5F6F52) background with ivory text. Active state uses a lighter moss tint. The navigation bar is the strongest brand presence on every screen.

- **Scoreboard KPI tiles:** Ivory card with a 4px left border in the appropriate status color (green/ochre/brick). KPI value in monospace, large. Target shown as a subtle warm-gray reference line.

- **Bet cards (War Room):** Ivory card with a moss-tinted header bar. Status badge (Green/Yellow/Red) in the top-right corner. Owner avatar and lead indicator sparklines visible without expanding.

- **Idea Vault cards:** During quarantine, cards render with a frosted/muted overlay (reduced opacity + subtle blur). As the 14-day timer progresses, the card gradually "thaws" (opacity increases). Fully thawed = ready for filter review.

- **AI agent cards:** Sage (#8B9E82) tinted header instead of moss. Agent category badge. Distinct from human team member cards but structurally identical (same Role Card layout). AI confidence indicator badge visible on all agent-generated output.

- **Content editor:** White (#FFFFFF) canvas for the writing surface (exception to the no-white rule) to match the mental model of a blank page. Surrounding chrome uses parchment. Toolbar uses warm-gray icons on ivory.

- **Buttons:** Primary = Clay background, ivory text. Secondary = Ivory background, charcoal text, warm-border outline. Tertiary/ghost = No background, clay text. Destructive = Brick background, ivory text (used only for irreversible actions, not for bet kills which are intentional and positive).

- **Policy violation cards:** When the Policy & Constraint Engine blocks an action, the explanation card uses a Brick left-border with parchment background and charcoal text. Override button (admin only) uses Clay with a distinct "override" icon and requires confirmation.

- **Discord embeds:** When TrueNorth posts to Discord via the cron engine, embeds use the moss color (#5F6F52) as the left-border accent. Status embeds use the appropriate semantic color. This ensures TrueNorth messages are instantly recognizable in a busy Discord server.

---

## 4. Technical Architecture

### 4.1 Stack Overview

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS | SSR for SEO-ready pages; client components for interactive features |
| Editor | Tiptap (ProseMirror) with Yjs for collaboration | Supports rich text, embeds, tables, slash commands; exports to HTML/Markdown |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) | Row-level security for multi-tenancy; real-time subscriptions for scoreboard |
| AI Layer | Claude Agent SDK (Anthropic) | Agent orchestration for filter evaluation, content drafting, anomaly detection |
| Cron Engine | Vercel Cron + Supabase Edge Functions | Flexible scheduled broadcasts; user-configurable via UI |
| Discord | Discord.js bot + webhook integrations | Slash commands for input; webhooks for broadcasts; thread management |
| File Storage | Supabase Storage | Content images, document exports, attachment uploads |
| PWA | next-pwa, service worker for offline pulse capture | Install prompt on mobile; offline-first for daily pulse |
| Hosting | Vercel (frontend + API routes + cron) | Edge network for global performance |

### 4.2 Multi-Tenant Data Model: Org → Venture Hierarchy

The database is designed for multi-tenancy from day one. The core structural insight is that operators often run multiple ventures (e.g., Fullstack Ag and Nerd Out) that are operationally distinct but managed by the same person with one brain, one to-do list, and one daily rhythm. The data model must support this without penalizing single-venture users with unnecessary complexity.

#### Entity Hierarchy

The system uses a three-tier hierarchy: Organization → Venture → Operational Entities. Every table includes both an organization_id and a venture_id foreign key (where applicable). Supabase Row-Level Security (RLS) policies enforce data isolation at both levels.

- **Organization:** Top-level tenant. Represents the operator or holding entity. Owns billing (future), team roster, user authentication, and cross-venture shared resources. A single-venture user has one Organization with one Venture and never interacts with the multi-venture layer.

- **Venture:** The operational unit. Each venture has its own BHAG, strategic filters, quarterly bets, KPI scoreboard, idea vault, funnels, content machines, and process library. A venture is where TrueNorth's rules are enforced: 3 bets per venture, 5–15 KPIs per venture, idea quarantine per venture's filters. Every organization has at least one venture, created automatically during onboarding. Each venture owns its own scorecard, bets, funnels, media machine, and cadence overlays.

- **User:** A human team member. Belongs to the Organization via a membership join table with role (admin, member, viewer). Assigned to one or more Ventures via a venture_membership join table. Users who belong to multiple ventures see a venture switcher in the navigation; users in a single venture do not.

- **Agent:** An AI team member. Belongs to the Organization. Can be assigned to one or more Ventures. Has a role card, task history, and KPIs, stored in a separate agents table with a user_type discriminator for polymorphic queries.

#### Venture Rollups and Cross-Venture Comparisons

The Portfolio Dashboard (Section 5.12) and the Operator Cockpit (Section 5.13) consume aggregated venture data. The system supports:

- **KPI rollups:** Organization-level aggregate views that sum, average, or concatenate venture-level KPIs based on configurable rollup rules per KPI type.
- **Cross-venture comparisons:** Side-by-side venture health scores, bet progress, and funnel performance for operators managing multiple business lines.
- **Unified operational objects:** Decisions, blockers, commitments, and issues can be viewed across all ventures or filtered to a single venture.

#### Scoping Rules: What Lives Where

The most important architectural decision is which entities scope to the Organization level (shared across all ventures) and which scope to the Venture level (isolated per venture):

| Scope | Entities | Rationale |
|-------|----------|-----------|
| Organization (shared) | Users, Agents, Team Roster, Role Cards, Personal To-Dos, Daily Pulse, Commitments, Decisions, Blockers, Issues, Cron Job configuration, Portfolio Dashboard, Policy Engine rules (global) | These are inherently personal or cross-venture. An operator has one daily rhythm, one to-do list, and one commitment per week — not one per venture. Agents serve the whole organization. Cron jobs can query any venture or span all of them. Operational objects (decisions, blockers, commitments) attach to entities and inherit scope from their parent but are viewable cross-venture. |
| Venture (isolated) | Vision / BHAG, Strategic Filters, Quarterly Bets, KPI Scoreboard, Idea Vault, Funnels, Content Machines, Media Calendar, Process Library, Automation Ladder, Core Artifacts, Policy Engine rules (venture-specific) | These are the operational pillars where TrueNorth's rules are enforced. Each venture has its own BHAG, its own 3-bet limit, its own 5–15 KPI cap, and its own idea quarantine evaluated against its own strategic filters. |
| Flexible (inherits from parent) | Comments, Activity Feed | Comments attach to the entity they belong to and inherit that entity's scope. A comment on a Fullstack Ag bet lives in the Fullstack Ag venture context. |

#### Pulse and To-Do Cross-Venture Behavior

The Daily Pulse is posted once per day per user, at the Organization level. Each line item within the pulse (Shipped, Focus, Blockers, Signal) can be tagged with a venture, allowing the system to attribute work to the correct venture context. When a pulse is viewed in the venture-scoped scoreboard, only items tagged to that venture appear. When viewed in the portfolio dashboard, all items appear.

Personal to-dos live at the Organization level and can link to entities in any venture. The to-do list view supports filtering by venture, but defaults to showing all to-dos across ventures. This matches how operators actually work — a single prioritized list, not siloed lists per company.

#### Single-Venture Simplification

> *Critical design constraint: A user whose organization has only one venture must never see, encounter, or be confused by multi-venture UI. The experience should feel like a single, focused operating system with no unnecessary abstraction layers.*

The following rules ensure single-venture users have a clean experience:

- **No venture switcher:** If the organization has exactly one venture, the venture switcher component is hidden from the navigation entirely. All pages render in the context of the sole venture automatically.

- **No venture labels:** Entity cards, scoreboard tiles, and list items do not display a venture badge or tag when only one venture exists. The venture name only appears in contexts where disambiguation is necessary (multi-venture orgs).

- **No venture selection during creation:** When creating a bet, KPI, idea, or funnel, the venture field is auto-populated and hidden if only one venture exists. No dropdown, no extra step.

- **Simplified pulse:** The venture tag on pulse line items is auto-applied and hidden when only one venture exists. The daily pulse form shows only the four core fields.

- **No portfolio dashboard:** The portfolio (cross-venture summary) view is hidden from navigation when only one venture exists. The default landing page is the venture's Operator Cockpit.

- **Automatic first venture:** During onboarding, the first venture is created automatically as part of organization setup. The user names their company and the venture is created behind the scenes. They never see the word "venture" unless they later add a second one.

- **Adding a second venture:** When an operator adds a second venture (via Settings → Ventures → Add Venture), the multi-venture UI elements activate: the venture switcher appears in the nav, venture badges appear on entities, the portfolio dashboard becomes available, and pulse line items gain the venture tag selector. This transition should feel like a natural upgrade, not a breaking change.

### 4.3 Core Data Entities

The following entities map directly to TrueNorth pillars and form the relational backbone of the system. Entities marked (V) are venture-scoped; entities marked (O) are organization-scoped.

#### State Model Convention: Lifecycle vs. Health

All key entities (bets, ideas, funnels, KPIs) maintain two independent state dimensions:

- **Lifecycle state** (what stage it is in): proposed → active → completed → killed/archived. Represents progression through a workflow.
- **Health state** (how it is performing): green → yellow → red. Represents current performance against targets.

These are never combined into a single field. This separation simplifies reporting logic, enables independent automation triggers, and prevents ambiguity (e.g., an active bet can be red; a completed funnel can have been green).

#### Entity Reference

| Entity | Pillar | Key Fields | Relationships |
|--------|--------|------------|---------------|
| Venture | System | name, slug, organization_id, created_at, settings{} | Belongs to Organization; has many Visions, Bets, KPIs, Ideas, Funnels, ContentPieces, Processes |
| Vision (V) | P1: North Star | venture_id, bhag, strategic_filters[], annual_outcomes[], not_doing_list[], year | Belongs to Venture; has many Bets, Ideas (via filter evaluation) |
| Idea (V) | P2: Idea Landmine | venture_id, name, description, classification (more/better/new), submitter, submitted_at, cooling_expires_at, filter_results{}, score, lifecycle_status, health_status | Belongs to Venture; has many Comments, AI Evaluations. Classification required before scoring. |
| Bet (V) | P3: Quarterly Bets | venture_id, outcome, mechanism, lead_indicators[], owner_id, proof_by_week6, kill_criteria, resource_cap, lifecycle_status, health_status, quarter | Belongs to Venture; has many KPIs, Moves, Todos, Comments, Commitments, Decisions |
| Move (V) | P3: Execution | bet_id, venture_id, type (milestone/recurring), title, owner_id, lifecycle_status, health_status, due_date, effort_estimate, kpi_link_ids[], cadence, target_per_cycle, content_machine_id, external_source{}, position | Belongs to Bet (inherits venture scope); has many MoveInstances (recurring only), Blockers, Comments, Todos, Commitments |
| MoveInstance | P3: Execution | move_id, cycle_start, cycle_end, status (pending/completed/missed/skipped), completed_at, linked_entity_id, linked_entity_type, notes, skip_reason | Belongs to Move (Recurring only); polymorphic link to ContentPiece or external content |
| KPI (V) | P4: Command Center | venture_id, name, type (leading/lagging), frequency, owner_id, target, current_value, health_status, lifecycle_status, tier, unit, directionality (up_is_good/down_is_good), aggregation_window, threshold_logic{}, linked_driver_kpis[], action_playbook{} | Belongs to Venture; has many KPIEntries (time series), linked to Bets, linked to driver KPIs |
| KPIEntry | P4: Command Center | kpi_id, value, recorded_at, source (manual/api/webhook) | Belongs to KPI (inherits venture scope) |
| Pulse (O) | P5: Async Rhythm | user_id, organization_id, date, items[]{shipped/focus/blockers/signal, venture_id, linked_entity_ids[]} | Belongs to User at Org level; line items tagged to Ventures |
| RoleCard (O) | P6: Accountability | entity_id, entity_type (user/agent), venture_assignments[], outcomes_owned, metrics_moved[], decision_authority, interfaces, commitments_standard | Belongs to User or Agent; references Ventures for assignment context |
| Funnel (V) | P7: Media | venture_id, name, entry_point, capture_mechanism, nurture_sequence, conversion_event, scoreboard_tie[], owner_id, lifecycle_status, health_status, last_result_at, linked_idea_id | Belongs to Venture; has many Comments. Requires linkage to an approved idea OR explicit override with audit log. |
| ContentPiece (V) | P7: Media | venture_id, title, machine_type, lifecycle_status, body_json (Tiptap doc), owner_id, scheduled_at | Belongs to Venture; linked to Funnel or standalone; has many Comments |
| Agent (O) | P8: Automation | organization_id, name, category, role_card_id, venture_assignments[], automation_level (L0–L4), status | Belongs to Organization; assigned to Ventures; has a RoleCard |
| Todo (O) | P9: Personal | user_id, organization_id, title, completed, due_date, linked_entity_id, linked_entity_type, visibility (private/team) | Belongs to User at Org level; polymorphic link to any entity in any Venture |
| Decision (O) | Operational | organization_id, venture_id (nullable), title, context, options_considered[], final_decision, owner_id, linked_entity_id, linked_entity_type, created_at, decided_at, audit_trail[] | Polymorphic link to bet/KPI/artifact; feeds weekly sync and monthly reviews |
| Blocker (O) | Operational | organization_id, venture_id (nullable), description, owner_id, severity (low/medium/high/critical), linked_entity_id, linked_entity_type, resolution_state (open/in_progress/resolved), resolved_at, resolution_notes | Linked to commitment or bet; powers escalation logic |
| Commitment (O) | Operational | organization_id, venture_id (nullable), description, owner_id, due_date, linked_entity_id, linked_entity_type, status (on_track/at_risk/missed/completed), created_in (weekly_sync/monthly_review/ad_hoc) | Linked to bet/KPI/meeting; tracked week over week |
| Issue (O) | Operational | organization_id, venture_id (nullable), description, owner_id, severity, category (operational/strategic/interpersonal), linked_entity_id, linked_entity_type, status (open/investigating/resolved), resolution_notes | General catch-all for operational friction; triaged in weekly sync |
| Comment | Universal | body, author_id, entity_id, entity_type, mentions[], parent_comment_id | Polymorphic; inherits scope from parent entity |
| CronJob (O) | Discord | organization_id, venture_id (nullable — null = cross-venture), name, schedule, query_template, format_template, discord_channel_id, enabled | Belongs to Organization; optionally scoped to a Venture |

### 4.4 Polymorphic Linking System

Several features (to-dos, comments, activity feeds, decisions, blockers, commitments, issues) need to reference any entity in the system. This is implemented via a polymorphic pattern using two columns: linked_entity_id (UUID) and linked_entity_type (enum: venture, bet, kpi, idea, funnel, content_piece, pulse, agent, vision, decision, blocker, commitment, issue, move, move_instance). A database view unions all linkable entities into a single searchable index for the UI's entity picker component. The entity picker respects venture scoping: when operating within a venture context, it shows that venture's entities first, with a "All ventures" toggle for cross-venture linking (available only in multi-venture orgs).

### 4.5 Policy & Constraint Engine

Instead of scattering TrueNorth philosophy rules throughout feature code, the system implements a central Policy & Constraint Engine that manages all business rules as executable policies.

#### Architecture

The engine is a system-wide service that intercepts entity creation, modification, and state transitions. Each policy is a named rule with:

- **Policy definition:** The constraint being enforced (e.g., "maximum 3 active bets per venture").
- **Scope:** Whether the policy applies at the organization level, venture level, or globally.
- **Violation detection:** Real-time check that fires before the action is committed.
- **User-facing explanation:** A clear message displayed when a violation occurs (e.g., "You cannot add a 4th active bet. TrueNorth enforces a 3-bet maximum per venture to protect focus. Kill or complete an existing bet first.").
- **Override mechanism:** Admin-only override with required justification text, logged immutably in the audit trail.
- **Override logging:** Every override records: who, when, why, and the specific policy overridden.

#### v1 Policy Set

| Policy | Scope | Enforcement | Override Available |
|--------|-------|-------------|-------------------|
| 3 active bets maximum | Per venture | Hard block on 4th bet creation | Yes (admin, logged) |
| 5–15 KPI range | Per venture | Block creation below 5 prompt / above 15 block | Yes (admin, logged) |
| 14-day idea quarantine | Per venture | Timer-based; no bypass of cooling period | No |
| Idea classification required | Per venture | "More / Better / New" must be set before scoring | No |
| Funnel requires approved idea linkage | Per venture | Funnel creation requires linked idea OR explicit override | Yes (admin, logged) |
| KPI single ownership | Per venture | Exactly one owner required | No |
| KPI update cadence | Per venture | Owner must update within cadence window | Soft (warning → escalation) |
| Sacred Work protection | Per org | Processes on Sacred Work list cannot be assigned to agents | No |
| 2 active projects per person | Per org | Block assignment beyond limit | Yes (admin, logged) |
| 1 new initiative per week | Per org | Block creation beyond limit | Yes (admin, logged) |
| Vision Board edit gating | Per venture | Read-only outside cadence windows | Yes (admin, logged) |
| 15 Moves maximum per bet | Per bet | Hard block on 16th Move creation | No |
| 5 Recurring Moves maximum per bet | Per bet | Hard block on 6th Recurring Move | No |
| Move ownership required | Per Move | Every Move must have an owner | No |
| Cut reason required for Moves | Per Move | Cutting a Move requires a reason, logged immutably | No |
| Move KPI linkage encouragement | Per Move | Soft warning when a Move has no KPI link | Soft (warning only) |
| Content machine linkage for content bets | Per bet | Soft warning if Recurring Moves relate to content but are not linked to a Content Machine | Soft (warning only) |

#### Policy Dashboard

Admins can view all active policies, their violation and override rates, and a historical log of all overrides. This provides visibility into where the team is pushing against the system's constraints — which can signal either that the team needs more discipline or that a policy needs adjustment.

### 4.6 Multi-Scale Architecture

TrueNorth is designed to serve 2–10 person teams with zero friction while supporting 100+ person organizations without requiring a rebuild.

#### Role-Based Views

| Role | Default View | Accessible Views | Write Permissions |
|------|-------------|-------------------|-------------------|
| Operator (Admin) | Operator Cockpit | All views, all ventures, policy engine, cron management | Full CRUD on all entities |
| Manager | Team Cockpit | Venture-scoped views for assigned ventures, team member pulses | CRUD on assigned venture entities; read-only on other ventures |
| Individual Contributor (Member) | Team Member Cockpit | Own pulse, own to-dos, assigned bets/KPIs, content editor | Own pulse, own to-dos, assigned content; read-only on scoreboard |
| Viewer | Scoreboard | Read-only access to assigned venture data | No write access |

#### Aggregation Layers

Data aggregates through four levels: Individual → Team → Venture → Organization. Each level supports drill-down navigation. The Operator Cockpit surfaces organization-level aggregates; the Venture Scoreboard surfaces venture-level data; individual Role Cards surface person-level metrics.

#### Performance Considerations

- Supabase RLS policies are optimized for the common case (single-venture, <10 users) with indexes on organization_id and venture_id.
- KPI time-series queries use materialized views for aggregation windows longer than 30 days.
- The Portfolio Dashboard uses pre-computed health scores updated every 15 minutes, not real-time queries across all ventures.
- Content editor collaboration (Yjs) is designed for up to 10 simultaneous editors per document; beyond that, a queueing mechanism prevents performance degradation.

### 4.7 Async Attention Model

TrueNorth is an async-first OS with Discord in the loop. The system defines explicit rules for how attention is allocated to prevent notification noise from undermining deep work.

#### Notification Tiers

| Tier | Trigger | Delivery | Timing |
|------|---------|----------|--------|
| Immediate | @mention in blocker, critical KPI alert (red for 2+ weeks), Week-6 checkpoint due, policy override by another admin | In-app notification + Discord DM | Real-time |
| Urgent (within 2 hours) | KPI turns red, new blocker assigned to you, commitment marked at-risk | In-app notification + Discord channel post | Batched every 30 minutes |
| Daily digest | Pulse reminder, stale artifact warnings, commitment due tomorrow, new ideas in vault | Single daily digest DM (configurable time, default 8am) | Once daily |
| Weekly digest | Automation ladder review, funnel health changes, archived idea resurfacing | Weekly summary embed in #operations | Monday morning |

#### Quiet Hours

- Users configure personal quiet hours (default: 9pm–7am local time).
- During quiet hours, all notifications except Immediate tier are held for the next active window.
- Quiet hours are respected in both in-app and Discord delivery.

#### Escalation Logic

- **Yellow → Red escalation:** If a KPI has been yellow for 2+ weeks with no owner action, it escalates from Daily Digest to Urgent tier.
- **Blocker aging:** Blockers unresolved for 3+ days escalate from Urgent to Immediate tier and notify the blocker owner's manager (if role hierarchy exists).
- **Pulse drift:** If a user misses 3 consecutive pulses, the notification escalates from Daily Digest to a Discord DM.
- **Commitment miss:** If a commitment due date passes with no status update, it escalates to the weekly sync agenda with "missed" status.

#### Discord vs. In-App Signal Differentiation

- **Discord** is the ambient awareness layer: broadcasts, digests, team-wide signals, and lightweight input (slash commands).
- **In-app** is the decision and action layer: approving AI recommendations, editing entities, formal reviews, and deep work in the editor.
- A notification delivered to Discord always includes a deep link back to the in-app context for action.

---

## 5. Feature Specifications

### 5.1 North Star: Vision Board (Pillar 1)

**Overview**

A dedicated, visually prominent single-page view displaying the BHAG, strategic filters, annual outcomes, and the Not Doing list. This is the "true north" that every other feature references.

**Venture scoping**

The Vision Board is venture-scoped. Each venture has its own BHAG, its own strategic filters, and its own Not Doing list. In multi-venture organizations, the venture switcher in the navigation determines which Vision Board is displayed. The strategic filters for a given venture are used by the Filter Guardian AI agent when evaluating ideas submitted to that venture's Idea Vault.

**Key behaviors**

- **Edit gating:** The Vision Board is read-only by default. It unlocks for editing only during Quarterly Summit or Annual Vision Refresh cadence windows, or via an explicit admin "Unlock Vision" action that logs the change with timestamp and author. The Policy & Constraint Engine enforces this gate.

- **Strategic filter cards:** Filters render as a horizontal card deck. Each card is referenceable throughout the system (ideas, bets, and the AI evaluation engine link to specific filter IDs).

- **Not Doing list:** Rendered with visual gravitas. Items are visually distinct from regular lists to convey their "sacred" status per the TrueNorth philosophy.

- **Annual outcomes table:** Three outcomes max (enforced), each with structured constraint fields (team size, budget cap, timeline, complexity).

- **Version history:** Every edit to the Vision Board creates an immutable snapshot. The team can browse prior versions to see how strategic direction has evolved.

### 5.2 Idea Landmine Defense: The Vault (Pillar 2)

**Overview**

A Kanban-style board with enforced stages that implements the Idea Quarantine Protocol. Ideas progress through a pipeline with hard-coded timing and filter gates.

**Venture scoping**

The Idea Vault is venture-scoped. Each venture has its own vault, and ideas are evaluated against that venture's strategic filters. When an idea is submitted via Discord (/idea), the user is prompted to select a venture if they belong to multiple. In single-venture orgs, the venture is auto-assigned.

**Idea Classification (required)**

Before an idea can be scored, it must be classified into one of three categories per the TrueNorth philosophy:

- **More:** Doing more of what already works (scaling existing systems).
- **Better:** Improving an existing system or process (optimization).
- **New:** Building something that does not exist yet (innovation).

This classification is required by the Policy & Constraint Engine. The classification influences scoring weights and surfaces in the Quarterly Summit agenda to ensure the team maintains a balanced portfolio of more/better/new initiatives.

**Stages**

| Stage | Behavior | Exit Criteria |
|-------|----------|---------------|
| Quarantine | Idea captured with name, 1-sentence description, submitter. 14-day cooling timer starts. Card is visually "frozen." | 14 days elapse (automatic) |
| Filter Review | Strategic filter checklist appears. Each filter is a pass/fail toggle. AI pre-evaluation populates recommended results. | All filters pass (any failure returns to Vault) |
| Scoring | Classification (More/Better/New) required. Alignment (40%), Revenue Potential (35%), Effort (25%) scores entered. Weighted total auto-calculated. | Score exceeds configurable threshold |
| Candidate | Idea is eligible for selection at next Quarterly Summit. | Selected as a bet or returned to vault |
| Archived | Not dead; preserved and searchable. AI periodically resurfaces relevant archived ideas. | Manual reactivation or AI suggestion |

**AI integration: Auto-Filter Evaluation**

When an idea exits the cooling period, the Claude Agent SDK evaluates it against every active strategic filter. The agent receives the idea description plus the full text of each filter, and returns a structured pass/fail assessment with reasoning for each filter. This pre-populates the Filter Review stage. The human reviewer can override any AI recommendation, but the AI's reasoning is preserved as an audit trail. AI evaluations display confidence levels and source inputs per the AI Trust Model (Section 6.4).

**WIP limit enforcement**

The Policy & Constraint Engine enforces the hard constraints from the TrueNorth document: maximum 3 active bets per quarter, maximum 2 active projects per person, maximum 1 new initiative per week. When any limit would be exceeded, the UI blocks the action and displays the specific constraint being violated with the policy explanation.

**Biweekly Kill Switch**

A scheduled job runs every two weeks. For each active project, it queries linked KPI data and pulse history. If a project has not moved any scoreboard KPI in the configured window (default 12 days), the system generates a kill/pause recommendation delivered to the project owner via in-app notification and Discord DM.

### 5.3 Quarterly Bets: The War Room (Pillar 3)

**Overview**

Each quarter gets a dedicated "War Room" view showing exactly 3 bet cards (hard max enforced by the Policy & Constraint Engine). Each bet card displays all 7 anatomy elements defined in the TrueNorth document.

**Venture scoping**

Bets are venture-scoped. The 3-bet maximum is enforced per venture, not per organization. An operator running Fullstack Ag and Nerd Out can have 3 active bets in each venture (6 total). The War Room view shows one venture's bets at a time, selected via the venture switcher. The Portfolio Dashboard (Section 5.12) provides a cross-venture summary of all active bets.

**Bet card structure**

- **Outcome:** The measurable change in the business. Free text with optional KPI linkage.
- **Mechanism:** The thesis for why this bet will produce the outcome.
- **Lead indicators:** 2–3 KPIs selected from the scoreboard. Live values display on the card.
- **Owner:** Single accountable person (dropdown from team roster).
- **Proof by Week 6:** Structured evidence criteria. The system surfaces a mandatory checkpoint at the quarter midpoint.
- **Kill criteria:** Conditions for abandonment. Referenced by the AI kill-switch agent.
- **Resource cap:** Time (hours/week), money (budget), people (headcount).
- **Moves:** The execution layer beneath the bet. See Section 5.17 for full specification.

**Moves progress summary on bet cards**

Each bet card in the War Room displays a compact Moves progress summary: a progress bar showing status distribution (e.g., "8 of 12 Moves: 5 shipped, 2 in progress, 1 blocked, 2 not started, 2 cut") and small health indicators for each Recurring Move rhythm. Clicking the progress summary expands into the full Move list view. This provides an execution health signal alongside the KPI-based health already shown on the card.

**70/30 Capacity visualization**

A capacity bar per team member shows allocated hours vs. the 70% cap. The remaining 30% renders as explicitly reserved "flex" capacity. If someone attempts to allocate more than 70%, the system displays a warning referencing the TrueNorth capacity rule.

**Week-6 Checkpoint workflow**

At the midpoint of each quarter, the system triggers a formal review workflow for each active bet. The owner receives a structured prompt to present lead indicator data and proof-by-week-6 evidence. The team then assigns a status: Green (continue), Yellow (pivot, with new proof criteria for week 9), or Red (kill, reallocate resources). The decision is captured as a formal Decision object (see Section 5.15) and logged immutably. Killed bets move to the Bet Graveyard.

**Bet Graveyard**

Killed bets are not deleted. They move to a visual "graveyard" that celebrates smart kills: "The system worked. You saved X hours by killing this early." Each tombstone shows the bet name, how long it ran, what was learned, and the resources recovered. This reinforces the TrueNorth philosophy that killing a bet is the system working, not a failure.

### 5.4 KPI Command Center: The Scoreboard (Pillar 4)

**Overview**

The scoreboard is the centerpiece of the daily experience. It displays a real-time dashboard with lagging indicators (Tier 1, monthly) across the top and leading indicators (Tier 2, weekly) below, with R/Y/G health status auto-calculated from target thresholds.

**Venture scoping**

The scoreboard is venture-scoped. Each venture has its own set of 5–15 KPIs with its own owners and targets. The venture switcher determines which scoreboard is displayed. The Portfolio Dashboard (Section 5.12) provides a cross-venture health summary. KPI owners must be members of the venture whose KPI they own.

**Scoreboard rules (enforced via Policy & Constraint Engine)**

- **5–15 KPI limit:** The system prevents creating more than 15 KPIs per venture (not per organization). Adding a 16th requires archiving an existing one.

- **Single ownership:** Every KPI must have exactly one owner. The owner field is required and singular.

- **Required update cadence:** Every KPI has a defined update frequency (daily, weekly, monthly). The Policy Engine tracks compliance and escalates stale KPIs.

- **Auto-status calculation:** R/Y/G health status is computed from the target value and configurable thresholds (e.g., Green = within 10%, Yellow = 10–25% below, Red = >25% below or trending down for 2+ weeks).

- **Red metric escalation:** If a KPI is red for 2 consecutive weeks, the system blocks the owner from marking it as "reviewed" until they attach a written corrective action plan. The action plan becomes a Commitment object tracked in the weekly sync.

- **Vanity Metric Test:** A one-click AI prompt asks the owner "If this dropped 20%, what would you do differently?" The response is stored. KPIs with no actionable answer get flagged for removal.

**KPI Structured Metadata**

Every KPI includes structured metadata fields beyond its name and value:

- **Unit:** The unit of measurement (dollars, percentage, count, hours, etc.).
- **Directionality:** Whether "up is good" or "down is good" for this metric.
- **Aggregation window:** The time period over which the KPI is calculated (daily, weekly, monthly, trailing-30).
- **Threshold logic:** Configurable rules for green/yellow/red status boundaries, including support for percentage-of-target and absolute-value thresholds.
- **Linked driver KPIs:** Required linkage from every lagging KPI to at least one leading KPI that drives it. This relationship powers the KPI Linkage Map and the anomaly correlation engine.

**KPI Action Playbook**

Every KPI has an associated action playbook — a structured set of responses to status changes:

- **If yellow:** Predefined actions the owner should take (e.g., "Review weekly content output," "Schedule 1:1 with sales lead").
- **If red:** Escalation actions (e.g., "Create formal corrective action plan," "Escalate to weekly sync," "Trigger resource reallocation review").

The playbook is configured by the KPI owner during creation and surfaces automatically when the KPI changes status. This transforms the scoreboard from observational ("we see it's red") to operational ("we know what to do about it").

**KPI Linkage Map**

An interactive visualization showing causal chains between lagging and leading KPIs. Click a lagging KPI and its leading drivers highlight. This implements the KPI Linkage Map from the TrueNorth document as an interactive graph, not just a static table. The linked_driver_kpis field ensures every lagging KPI is connected to its causal chain.

**Data ingestion**

| Source | Method | v1 Scope |
|--------|--------|----------|
| Manual entry | Form input per KPI with date stamp | Full support |
| Stripe | API integration via Supabase Edge Function | MRR, active customers, churn rate |
| ConvertKit / Beehiiv | API integration | Subscriber count, open rate, click rate |
| Webhook | Generic POST endpoint per KPI | Any external system can push data |
| CSV upload | Bulk import for historical data | Backfill and migration support |

**AI integration: Anomaly Detection**

A scheduled agent (daily) analyzes KPI time-series data for anomalies: sudden drops, trend reversals, and deviation from seasonal patterns. Alerts are delivered to the KPI owner via in-app notification and Discord, with a plain-language explanation of what changed and possible causes based on correlated data (e.g., "Newsletter open rate dropped 15% this week. This correlates with a shift in send time from Tuesday to Thursday. This is a leading driver for Revenue/MRR."). The agent uses the KPI Linkage Map to trace anomalies through causal chains and provide early warnings on lagging indicators.

### 5.5 Async-First Rhythm: The Pulse Engine (Pillar 5)

**Daily Pulse**

The daily pulse is the primary daily touchpoint with the application. It is a structured, fast-input form with four fields matching the TrueNorth document:

**Venture scoping**

The pulse is organization-scoped — a user posts one pulse per day, not one per venture. Each line item within the pulse (Shipped, Focus, Blockers, Signal) can be optionally tagged with a venture when the user links it to a venture-scoped entity (a bet, KPI, or content piece). In single-venture orgs, the venture tag is auto-applied and invisible. In multi-venture orgs, the entity picker shows which venture each linkable item belongs to. When a pulse is viewed in a venture's scoreboard context, only line items tagged to that venture appear. The Portfolio Dashboard shows all line items.

| Field | Input Type | Behavior |
|-------|-----------|----------|
| ✅ Shipped | Free text with entity auto-suggest | Tag completed work to bets and KPIs |
| 🎯 Focus | Free text + single bet selector | Must tie to an active quarterly bet |
| 🚧 Blockers | Free text + @mention team members | Creates a Blocker object and notification for mentioned person |
| 📈 Signal | KPI selector + optional note | Links to scoreboard; surfaces in weekly sync |

- **2-minute target:** The form is designed for speed. Auto-suggestions, recent entity shortcuts, and keyboard navigation ensure completion under 2 minutes.

- **Drift Detector:** If a team member's pulses do not connect to any active bet or KPI for 5 consecutive days, the system sends a private notification: "Your last 5 days of work haven't connected to a quarterly bet. Want to review your focus?"

- **Pulse streak:** Visual streak tracking on the user's profile: "You've posted 14 consecutive pulses. Your focus consistency score is 92%."

- **Blocker auto-creation:** When a user mentions a blocker in their pulse with an @mention, the system automatically creates a Blocker object (Section 5.15) with the mentioned person as the owner and links it to the relevant bet or KPI.

- **Move auto-suggest:** When the user types in the Shipped field, the system suggests matching their text to open Moves on their assigned bets. Selecting a Move auto-links the pulse item and (for Milestone Moves) offers to update the Move status to "shipped." For Recurring Moves, crediting a pending instance is offered. A compact sidebar shows the user's active Recurring Move cycle progress (e.g., "Newsletter: 1/1 ✅ | Community topics: 1/3 🟡").


**Weekly Scoreboard Sync: Meeting Mode**

A dedicated meeting interface with a 30-minute countdown timer and auto-advancing segments. The agenda is auto-generated from system state, pulling data from KPIs, bets, blockers, commitments, and decisions:

- **Scoreboard Review (10 min):** Auto-populated from current KPI data. Only red and yellow items shown by default. Green collapsed to a summary line. Each red KPI shows its action playbook.

- **Focus Check (5 min):** Each team member's current bet assignment shown with active Moves and status. Recurring Move rhythm health is reviewed — red rhythms are called out for discussion. Quick alignment view.

- **Blockers & Decisions (10 min):** Unresolved Blocker objects from the week, pre-sorted by age and severity. Open Decision objects requiring team input. Issues triaged from the issue queue.

- **Commitments (5 min):** Last week's Commitment objects reviewed (completed/missed/at-risk). Each person enters their single most important commitment for next week, which becomes a new Commitment object tracked to next sync.

**Meeting output:** The Weekly Sync produces structured output: new Decision objects, resolved Blockers, new Commitments, and updated Issue statuses. These feed directly into the Operator Cockpit and the next week's sync agenda.

**Monthly Operating Review and Quarterly Summit**

The system generates pre-populated agendas for both cadences using AI. The Monthly Operating Review agenda includes: wins/losses with root causes, system fixes, pipeline health summary, capacity rebalance data, and Idea Vault scan. The Quarterly Summit agenda includes: BHAG progress, team assessment prompts, outgoing bet grades, Idea Vault candidate bets (with More/Better/New classification distribution), scoreboard adjustments, and Not Doing list updates.

### 5.6 Accountability Architecture: Role Cards (Pillar 6)

**Overview**

Every team member's profile page is their Role Card. It displays structured fields matching the TrueNorth document: outcomes owned, metrics moved (live-linked to scoreboard), decision authority, interfaces, and commitments standard.

**Key behaviors**

- **Live KPI linkage:** The "Metrics Moved" section pulls real-time R/Y/G health status from the scoreboard. A team member can see at a glance whether their KPIs are healthy.

- **Quarterly review prompt:** Before each Quarterly Summit, the system prompts the team lead to review each Role Card. The Keeper Test ("Would you fight to keep them?") is a private, confidential workflow with structured follow-up actions.

- **Agent role cards:** AI agents have identical Role Card structure but are rendered in a distinct visual style (different color, "AI Agent" badge) and appear in a separate section of the team roster. Agent role cards include AI-specific fields: acceptance rate, override rate, and error patterns (see Section 6.4).

### 5.7 Media Engine: Content Machines & Funnels (Pillar 7)

**Venture scoping**

Content machines, funnels, and the media calendar are venture-scoped. Each venture has its own set of content pipelines and funnel registry. The Shared Audience Map (see below) operates across ventures within the same organization to prevent audience overlap when multiple ventures target similar segments.

**Content Machines**

Four content machines run on predictable cadences, each with its own pipeline view. The four machines map to the TrueNorth document: Flagship Newsletter (weekly), Deep Content Piece (weekly), Short-Form Daily (daily), and Monthly Live Event (monthly).

Each machine is a Kanban pipeline with stages: Ideation, Drafting, Review, Scheduled, Published. Content pieces flow through these stages with the owner, due date, and linked funnel visible on each card.

**Collaborative Rich Text Editor**

The content drafting experience is a production-grade, collaborative rich text editor built on Tiptap (ProseMirror core) with Yjs for real-time multiplayer collaboration. This is a central feature — not a side tool — that serves as the narrative layer of the operating system.

| Capability | Implementation | Notes |
|-----------|----------------|-------|
| Rich text formatting | Bold, italic, headings, blockquotes, code blocks, horizontal rules | Standard Tiptap extensions |
| Media embeds | Images (drag-and-drop upload to Supabase Storage), video embeds, tweet embeds | Custom Tiptap nodes |
| Tables | Full table support with resizable columns | Tiptap table extension |
| Slash commands | Type / to insert blocks, embeds, or trigger AI assistance | Custom suggestion plugin |
| Markdown toggle | Switch between WYSIWYG and raw Markdown editing | Dual-mode rendering |
| HTML export | One-click export to clean, publishable HTML | Custom serializer |
| Markdown export | One-click export to Markdown for CMS or GitHub | Tiptap Markdown extension |
| Real-time collaboration | Multiple users editing simultaneously with presence cursors | Yjs + Supabase Realtime as transport |
| Version history | Every save creates a snapshot; diff view between versions | Stored as Tiptap JSON in content_versions table |
| AI writing assistant | Inline AI drafting, rewriting, expansion, and summarization via slash command | Claude Agent SDK integration; see Section 6.2 |
| Structured object embeds | Embed live-linked bets, KPIs, decisions, and commitments inline | Custom Tiptap nodes that render live data |
| Funnel and media calendar links | Direct linkage to funnels and media calendar entries | Bidirectional linking via entity picker |
| Template support | Templates tied to processes in the Process Library | Reusable document structures |
| Queryable content | Full-text search across all editor content | Indexed in Supabase for search and AI retrieval |

The editor feeds AI memory and retrieval: all content created in the editor is indexed and available to AI agents for context (brand voice analysis, content performance correlation, topic suggestion). This makes the editor the system's knowledge capture surface, not just a drafting tool.

**Rich Commenting on Content**

Comments on content pieces support inline annotation (highlight text, add comment), threaded replies, @mentions (which trigger Discord notifications), and resolved/unresolved status tracking. Comments are rendered in a sidebar panel alongside the editor, synchronized in real-time for all active collaborators. This uses the universal commenting system described in Section 5.10, but with the additional capability of anchoring comments to specific text ranges in the document.

**Funnel Registry**

Every active funnel in the business is registered with all five required elements from the TrueNorth document: entry point, capture mechanism, nurture sequence, conversion event, and scoreboard tie. A funnel cannot be saved without all five elements completed. Additionally, every funnel must be linked to an approved idea from the Idea Vault or the creator must provide an explicit justification (logged via the Policy & Constraint Engine override mechanism).

**Funnel Health Check (automated)**

Monthly, the system auto-grades each funnel based on KPI data and time-since-last-result: Healthy, Underperforming, Stalled, or Orphaned. The grades pre-populate the Monthly Operating Review agenda. Funnels with no measurable result in 60+ days are auto-flagged for kill-or-fix decisions.

**Media Calendar**

The Media Calendar is a venture-scoped calendar view that provides visibility into content output vs. plan across all content machines. It is tied directly to:

- **One-Ask Rule:** The calendar prevents scheduling competing CTAs for the same audience within the configured exclusion window (default 30 days). Violations are blocked by the Policy & Constraint Engine with a clear explanation.
- **Funnels:** Each calendar entry can be linked to a funnel, showing which funnel each piece of content serves.
- **Campaigns:** Content pieces can be grouped into campaigns with aggregate performance tracking.

The calendar supports drag-and-drop rescheduling, gap detection (highlighting days with no scheduled content for active machines), and AI-suggested content topics based on funnel performance and seasonal patterns.

**Cross-funnel coordination**

- **Shared Audience Map:** When funnels are created, the system maps audience overlaps based on the entry point and capture mechanism. If two funnels share an audience segment and their conversion events are scheduled within 30 days, the system warns the operators.

- **One-Ask Rule enforcement:** The media calendar prevents scheduling competing CTAs for the same audience within the configured exclusion window (default 30 days).

### 5.8 Automation & AI Agent Layer (Pillar 8)

**Agent Roster UI**

AI agents are displayed in a dedicated section of the team roster. Each agent has a profile page with: name, category (sensing/synthesis/production/execution), role card, current automation level (L0–L4), task history, performance metrics, escalation path, and AI trust metrics (acceptance rate, override rate, error patterns — see Section 6.4).

**Automation Ladder Tracker**

Every documented process in the organization is a row in the Automation Ladder view. Each process shows its current level (L0: Manual through L4: Autonomous) as a visual progress bar. The monthly automation audit is a structured workflow where the team reviews the ladder and identifies candidates for advancement. The target: move at least one process up the ladder every month.

**Human-Only Work protection**

The system maintains a "Sacred Work" list that explicitly protects domains from automation: strategic direction, brand voice approval, partnership development, product vision, and team culture decisions. These are marked in the process library and cannot be assigned to agents. The Policy & Constraint Engine enforces this protection.

### 5.9 Core Artifacts & Operational Modules (Pillar 9)

The seven core artifacts from the TrueNorth document are first-class objects in the system. Each artifact has a designated owner, a fixed update cadence, and staleness detection. If an artifact has not been updated within its cadence window, the system alerts the owner and surfaces the staleness in the Monthly Operating Review.

| Artifact | Owner Role | Update Cadence | Staleness Alert |
|----------|-----------|----------------|-----------------|
| Vision Page | CEO / Operator | Annually | 13 months since last update |
| Quarterly Bets Page | CEO / Operator | Quarterly | 100 days since last update |
| Scoreboard | Operations | Weekly | 10 days since last entry |
| Meeting Cadence Doc | Operations | Quarterly | 100 days since last update |
| Role Cards | Each person | Quarterly | 100 days since last update |
| Process Library | Operations | Ongoing | 60 days since any process updated |
| Media Calendar | Content Lead | Monthly | 35 days since last update |

#### Process Library Module

The Process Library is a full module, not just a list of documents. Each process in the library includes:

- **Versioned content:** Processes are version-controlled. Every edit creates a new version with diff tracking and author attribution.
- **Ownership:** Each process has a single designated owner responsible for maintenance and improvement.
- **Trigger conditions:** Structured definition of when the process is used (e.g., "When a new team member joins," "When a bet is killed," "When a KPI turns red").
- **KPI and bet linkages:** Processes are linked to the KPIs they impact and the bets they support. This enables impact analysis: "If we change this process, which KPIs might be affected?"
- **Automation level:** Current position on the L0–L4 Automation Ladder, with history of level changes.
- **AI-assisted improvement suggestions:** Monthly, an AI agent reviews process performance data (linked KPI trends, frequency of use, time-since-last-update) and suggests improvements or automation candidates.
- **Template generation:** Processes can generate editor templates — when a team member starts a task governed by a process, the editor pre-populates with the process template.

#### Meeting Cadence System Module

The Meeting Cadence System is a structured module that defines, enforces, and automates the three core TrueNorth cadences:

- **Weekly Sync:** Defined agenda structure (see Section 5.5), 30-minute hard cap, auto-generated agenda from system state. Output: Decision objects, resolved Blockers, new Commitments.
- **Monthly Operating Review:** Defined agenda structure, AI-generated pre-read document, structured output capturing wins/losses, root causes, system fixes, and pipeline decisions. Output: updated funnel grades, new Issues, process improvement tickets.
- **Quarterly Summit:** Defined agenda structure with BHAG progress review, team assessment (Keeper Test), outgoing bet grades, incoming bet selection from Idea Vault candidates, scoreboard recalibration, and Not Doing list updates. Output: new Vision Board snapshot, new quarterly bets, updated Role Cards.

Each cadence has:

- **Scheduled triggers:** The system knows when each cadence is due based on the calendar and quarter boundaries.
- **Auto-generated agendas:** Agendas are populated from live system data (KPIs, bets, blockers, commitments, decisions, funnel health, stale artifacts).
- **Structured output capture:** Every meeting produces structured objects (Decisions, Commitments, Blockers, Issues) that feed back into the system, not just meeting notes.
- **Attendance and completion tracking:** The system tracks whether cadence events are happening on schedule and alerts when they are missed.

### 5.10 Universal Commenting System

**Overview**

Comments are available on every entity in the system: bets, KPIs, ideas, funnels, content pieces, pulses, agent profiles, decisions, blockers, commitments, and issues. The commenting system is polymorphic (entity_id + entity_type) and supports threading, @mentions, rich text (basic formatting only), and resolution tracking.

**Key behaviors**

- **@mentions:** Typing @ surfaces a team member picker. Mentioned users receive an in-app notification and a Discord DM with a deep link back to the comment.

- **Threading:** Comments support single-level threading (reply to a comment). Deep nesting is not supported to keep conversations scannable.

- **Resolution:** Any comment can be marked "Resolved" by the entity owner or the comment author. Resolved comments collapse but remain visible.

- **Activity feed:** All comments across the system feed into a unified activity stream, filterable by entity type, author, and time range.

- **Content-specific anchoring:** On content pieces, comments can be anchored to specific text ranges (inline annotation). This is rendered as highlights in the editor sidebar.

### 5.11 Personal To-Do System

**Overview**

Every user has a private to-do list that is visible only to them. To-dos can be standalone or linked to any entity in the system via the polymorphic linking system (bets, KPIs, ideas, funnels, content pieces, pulses, agents, decisions, blockers, commitments, issues).

**Key behaviors**

- **Universal linking:** When creating a to-do, the user can search and link to any entity. The linked entity's name, type, and current status appear on the to-do card.

- **Private by default:** To-dos are visible only to the creator. No team visibility unless the user explicitly shares a to-do (future feature).

- **Due dates and priority:** Optional due date and priority level (high/medium/low). Overdue to-dos surface in the user's daily pulse reminder.

- **Quick capture:** To-dos can be created from anywhere in the app via a global keyboard shortcut (Cmd+T) or from the context menu on any entity ("Add to my to-dos").

- **Discord integration:** To-dos can be created via Discord slash command: `/todo "Write Q2 bet proposal" --linked bet:acre-almanac-launch`. The bot confirms and syncs to the app.

- **Pulse integration:** During daily pulse entry, the user's to-do list is visible in a sidebar. Completed to-dos can be dragged into the "Shipped" field.

### 5.12 Portfolio Dashboard (Multi-Venture Only)

**Overview**

The Portfolio Dashboard is a cross-venture summary view available only in organizations with two or more ventures. It is the operator's single screen for answering the question: "Across everything I'm running, where do I need to focus today?"

**Visibility rules**

> *The Portfolio Dashboard is completely hidden from navigation when only one venture exists. It appears automatically when a second venture is created. It is never the default landing page — the default is always the Operator Cockpit.*

**Layout**

The Portfolio Dashboard displays one card per venture. Each venture card shows:

- **Venture name and health score:** An aggregate R/Y/G indicator derived from the venture's KPIs. Green if >70% of KPIs are green, Yellow if any KPIs are red but <30%, Red if >30% of KPIs are red.

- **Active bets summary:** Count and status (e.g., "3 bets: 2 green, 1 yellow") with a link to the venture's War Room.

- **Top alert:** The single most urgent item requiring the operator's attention: a red KPI, a stale artifact, an overdue Week-6 checkpoint, or an unresolved blocker older than 3 days.

- **Pulse activity:** How many team members posted pulses today in this venture. Visual indicator of team engagement.

- **Quick navigation:** Each card links directly into the venture's scoreboard, bets, idea vault, and content pipeline.

**Cross-venture aggregations**

Below the venture cards, the Portfolio Dashboard optionally shows:

- **Unified blocker list:** All unresolved Blocker objects across all ventures, sorted by age. This surfaces cross-venture dependencies.

- **Combined pulse feed:** The most recent pulses from all team members across all ventures, filterable by venture.

- **Commitment tracker:** All team members' weekly Commitment objects in one view, regardless of which venture the commitment relates to.

- **Decision log:** Recent Decision objects across all ventures for the operator's review.

**Discord integration**

A cron job template ("portfolio_summary") is available that posts the Portfolio Dashboard as a Discord embed — one compact card per venture with health score, bet status, and top alert. This is designed for the operator's private #operator-briefing channel.

### 5.13 Operator Cockpit: The Today View

**Overview**

The Operator Cockpit is the default home screen for the operating system. It is the first thing an operator sees when they open TrueNorth, and it answers the question: "What needs my attention right now?" This is not a dashboard buried in navigation — it is the OS's primary operating surface.

**Two cockpit variants**

The system provides two cockpit configurations based on the user's role:

**Operator Cockpit (CEO/founder view across ventures)**

The Operator Cockpit is the default for admin users. It pulls data from all ventures and all operational objects to surface the most important information immediately:

- **What is drifting:** Red and yellow KPIs across all ventures, with days-in-status and trend direction. Stale artifacts past their update cadence.
- **What decisions are required today:** Open Decision objects awaiting the operator's input, sorted by age and linked-entity urgency.
- **Which bets are at risk:** Active bets with red health status or approaching Week-6 checkpoint without evidence submitted. Bets where no Move has progressed in 10+ days are flagged as "execution stalled."
- **Blocked Moves:** Moves linked to unresolved blockers, sorted by bet priority. Recurring Moves that are red (below 50% completion rate) or will miss the current cycle target.
- **Upcoming Milestone due dates:** Milestone Moves due in the next 7 days across all bets.
- **Who is blocked:** Open Blocker objects sorted by severity and age, with the blocked person and the entity affected.
- **What commitments are due or overdue:** Commitment objects due today or past due, with status indicators.
- **What pulse signals are missing:** Team members who have not posted a pulse today, with their streak status.
- **What cadence event is next:** The next scheduled meeting (weekly sync, monthly review, quarterly summit) with days until and prep status.
- **The single most important action:** An AI-generated recommendation for the operator's highest-leverage action today, based on system state analysis.

In multi-venture orgs, the Operator Cockpit shows data across all ventures with venture badges on each item. The operator can filter to a single venture or view the cross-venture aggregate.

**Team Member Cockpit (role-scoped, commitment-driven view)**

The Team Member Cockpit is the default for non-admin users. It is scoped to the ventures the team member belongs to and focuses on their personal accountability:

- **My commitments:** This week's Commitment objects with status.
- **My Moves:** Active Moves assigned to this person, organized by bet, with health indicators and due dates. Recurring Move instances expected today or this week with completion status. Overdue Milestone Moves highlighted.
- **My KPIs:** The KPIs owned by this team member with current health status.
- **My bets:** Active bets where this person is the owner, with lead indicator status.
- **My blockers:** Blockers assigned to or reported by this person.
- **My pulse status:** Whether today's pulse has been submitted, with streak counter.
- **Team signals:** Recent blockers and red KPIs from the team that may affect this person's work.

### 5.14 Launch Mode: Guided Onboarding System

**Overview**

The 30-day TrueNorth implementation path is not just documentation — it is a product experience. Launch Mode is a structured onboarding system that walks a new workspace through the complete TrueNorth setup, reducing time-to-value and making the system feel alive from day one.

**Launch Mode Workflow**

When a new organization is created, Launch Mode activates automatically. It presents a guided, step-by-step implementation checklist that mirrors the TrueNorth philosophy's recommended setup sequence:

| Step | Content | Target Completion |
|------|---------|-------------------|
| 1. Name your venture | Company name, venture creation (behind the scenes) | Day 1 |
| 2. Define your BHAG | Guided BHAG creation with examples and AI-assisted suggestions | Day 1–2 |
| 3. Set strategic filters | Filter card creation with templates and coaching prompts | Day 2–3 |
| 4. Define annual outcomes | Three outcomes with constraint fields, AI-assisted structuring | Day 3–4 |
| 5. Build your scoreboard | KPI definition with guardrails (5–15 limit coaching), import from existing spreadsheets | Day 4–7 |
| 6. Choose your first 3 bets | Bet creation with all 7 anatomy fields, guided by strategic filters | Day 7–10 |
| 7. Create role cards | Team member role card creation with AI-assisted suggestions based on bets and KPIs | Day 10–12 |
| 8. Set up your pulse | Pulse configuration, test pulse, team invitations | Day 12–14 |
| 9. Run your first weekly sync | Meeting Mode walkthrough with sample agenda | Day 14–15 |
| 10. Complete your first monthly review | Monthly review walkthrough with pre-populated data | Day 28–30 |

**Key capabilities**

- **Import existing docs/spreadsheets:** At each step, users can upload existing documents (Google Sheets, CSVs, Word docs) and the system uses AI to auto-structure the content into TrueNorth objects. For example, uploading an existing KPI spreadsheet auto-populates the scoreboard with suggested KPIs, owners, and targets.

- **Templates and AI-assisted suggestions:** Every step provides templates, examples, and AI-generated suggestions based on the venture's industry and the information entered in previous steps. The AI builds on context progressively — by step 6, it knows the BHAG, filters, outcomes, and KPIs, so bet suggestions are highly relevant.

- **Progress visualization:** A build checklist shows overall progress with milestone celebrations: "Week 1 complete: Vision Board live." "Week 2 complete: Scoreboard active." The checklist is visible in the navigation sidebar until Launch Mode is completed or dismissed.

- **Non-blocking:** Launch Mode is a guide, not a gate. Users can skip steps, return later, or dismiss Launch Mode entirely. However, the system gently re-surfaces incomplete steps (e.g., "You haven't set up your strategic filters yet. Ideas can't be properly evaluated without them.").

- **Re-entry:** Any completed step can be revisited and re-run. Adding a second venture triggers a venture-specific Launch Mode that skips organization-level steps.

### 5.15 Operational Objects: Decisions, Blockers, Commitments & Issues

**Overview**

Comments and discussions are not sufficient for accountability loops. TrueNorth introduces four first-class operational objects that power the cadence system, surface in the Cockpit, and create an auditable trail of how the team operates.

**Decision**

A Decision is a structured record of a choice made by the team or an individual.

- **Fields:** Title, context (what prompted this decision), options considered (list of alternatives), final decision, owner (who made the call), linked entity (bet/KPI/artifact/venture), decided_at timestamp, audit trail.
- **Creation triggers:** Week-6 checkpoint, weekly sync blocker resolution, monthly review output, quarterly summit bet selection, or manual creation.
- **Behavior:** Decisions are immutable once recorded. They can be superseded by a new Decision that references the original. All decisions surface in the weekly sync review, the monthly operating review, and the Operator Cockpit.
- **AI integration:** The Agenda Builder agent surfaces pending decisions in meeting prep documents.

**Blocker**

A Blocker is a structured record of something preventing progress.

- **Fields:** Description, owner (who is responsible for resolving), severity (low/medium/high/critical), linked entity (commitment or bet), resolution state (open/in_progress/resolved), resolved_at, resolution notes.
- **Creation triggers:** Pulse blocker field (auto-created when @mention is used), Discord `/blocker` command, manual creation, or AI detection (Signal Watch identifies KPI drops correlated with team capacity issues).
- **Escalation:** Blockers follow the Async Attention Model escalation rules: 3+ days unresolved → escalate from Urgent to Immediate tier. Critical blockers notify the operator immediately.
- **Behavior:** Unresolved blockers surface in every weekly sync agenda. The Operator Cockpit shows all open blockers sorted by severity and age.

**Commitment**

A Commitment is a structured promise made by a team member, typically during a weekly sync.

- **Fields:** Description, owner, due date, linked entity (bet/KPI/meeting), status (on_track/at_risk/missed/completed), created_in (which cadence event produced this commitment).
- **Creation triggers:** Weekly sync commitments segment, monthly review action items, or manual creation.
- **Tracking:** Commitments are tracked week-over-week. At each weekly sync, the previous week's commitments are reviewed and marked completed or missed. Missed commitments generate an Issue if repeated.
- **Behavior:** The commitment tracker is visible in the Operator Cockpit, Team Member Cockpit, and Portfolio Dashboard.

**Issue**

An Issue is a general-purpose record of operational friction that doesn't fit neatly into blocker or decision categories.

- **Fields:** Description, owner, severity, category (operational/strategic/interpersonal), linked entity, status (open/investigating/resolved), resolution notes.
- **Creation triggers:** Manual creation, repeated missed commitments, AI-detected patterns (e.g., "Three blockers this month all relate to the same integration"), or monthly review triage.
- **Triage:** Issues are triaged during the weekly sync. They can be promoted to Decisions (if they require a choice), Blockers (if they are preventing specific progress), or resolved directly.

### 5.16 Cadence Intelligence System

**Overview**

The Cadence Intelligence System monitors adherence to TrueNorth's prescribed operating rhythm and alerts when cadences are missed, delayed, or producing low-quality output.

**Tracked cadences**

| Cadence | Frequency | Compliance Metric | Alert Threshold |
|---------|-----------|-------------------|-----------------|
| Daily Pulse | Daily per user | % of team posting daily | <80% team compliance for 3+ days |
| KPI Updates | Per KPI cadence | % of KPIs updated on schedule | Any KPI 2+ periods stale |
| Weekly Sync | Weekly | Held on schedule with structured output | Missed or >3 days late |
| Monthly Review | Monthly | Held with AI-generated agenda and structured output | Missed or >7 days late |
| Quarterly Summit | Quarterly | Held with full agenda completion | Missed |
| Automation Audit | Monthly | Review completed with at least one advancement candidate | Missed |

**Cadence compliance score:** A per-venture and per-organization aggregate score showing what percentage of prescribed cadence events are being completed on schedule. This score surfaces in the Operator Cockpit and the Monthly Operating Review.

### 5.17 Moves: Bet-Scoped Execution Tracking

**Overview**

Moves are the execution layer beneath quarterly bets. A Move is a discrete action or sustained rhythm that advances a bet's lead indicators. Moves fill the structural gap between strategic bets (quarterly, outcome-oriented) and personal to-dos (private, ad hoc) by providing a shared, team-visible view of what needs to happen to move a bet forward.

Moves are not tickets, tasks, or subtasks. They represent the meaningful work items and essential rhythms that connect daily execution to quarterly outcomes. The system is deliberately constrained to prevent TrueNorth from becoming a project management tool — if a team needs Gantt charts, sprint planning, or dependency graphs, they should use a dedicated tool and let TrueNorth stay at the strategic operating layer.

**Design philosophy:** A bet with well-defined Moves should let any team member answer three questions at a glance: "What has shipped?", "What is in progress?", and "What is blocked?" If the Move list doesn't answer those questions simply, it's either too granular or too vague.

**Venture scoping**

Moves are venture-scoped, inheriting scope from their parent bet. A Move belongs to exactly one bet, which belongs to exactly one venture. RLS policies enforce data isolation through the bet → venture chain.

#### Move Types

Moves come in two types, reflecting the two fundamental modes of execution in a digital business: building discrete things and sustaining ongoing rhythms.

**Milestone Moves**

A Milestone Move is a one-time deliverable that ships and is done. It has a clear definition of "shipped" and advances a bet through a discrete, measurable contribution. Examples: "Publish the Farm Succession Planning Guide as a lead magnet," "Launch the Herbicide Program Builder beta," "Ship Stripe integration for MRR tracking."

Milestone Moves progress through a simple lifecycle: **not_started → in_progress → shipped → cut**. A shipped Move is a completed contribution. A cut Move is a conscious decision to drop it — the equivalent of a bet kill at the Move level, logged with a reason.

**Recurring Moves**

A Recurring Move is a cadence-bound rhythm that generates trackable instances on a schedule. It represents a sustained commitment to a content machine, community practice, or operational habit that compounds over time. Recurring Moves acknowledge that many bets — especially those involving audience growth, community building, and content — are not advanced by shipping discrete things but by consistently executing rhythms.

Examples: "Publish weekly Fullstack Ag newsletter (1x/week)," "Create community discussion topics across the six disciplines (3x/week)," "Daily engagement responses in Discourse, target <4hr first response time (daily)."

Each Recurring Move has:
- **Cadence:** How often the rhythm repeats (daily, weekly, biweekly, monthly).
- **Target quantity per cycle:** How many instances are expected per cadence period (e.g., 3 topics per week, 1 newsletter per week).
- **Instance tracking:** The system generates expected instances each cycle and tracks completion against the target.

Recurring Moves persist for the life of the bet. They do not get marked "shipped" — instead, each cycle's instances are individually tracked. The Recurring Move itself carries an aggregate health status based on recent cycle completion rates.

#### Health Status Calculation

**Milestone Move Health**

| Health | Condition |
|--------|-----------|
| Green | On track: not_started or in_progress with due date >5 days away and no linked blockers. |
| Yellow | At risk: due date within 5 days, or in_progress with a linked blocker, or in_progress for >14 days without status change. |
| Red | Blocked or overdue: past due date, or linked to a critical/high-severity blocker, or not_started with due date <3 days away. |

**Recurring Move Health**

Recurring Move health is based on rolling completion rate over the last 3 cycles:

| Health | Condition |
|--------|-----------|
| Green | ≥80% of target instances completed across last 3 cycles. |
| Yellow | 50–79% completion rate across last 3 cycles, or current cycle is behind pace. |
| Red | <50% completion rate across last 3 cycles, or current cycle will mathematically miss target given remaining days. |

**Rollup to Bet Health**

A bet's Moves contribute to the bet's overall health assessment as an execution health signal alongside KPI-based health:

- **Execution health score:** Percentage of active Moves in green status. Surfaced alongside KPI-based health on the bet card.
- **Stall detection:** If no Milestone Move has changed status in 10+ days and no Recurring Move instances have been completed in the current cycle, the bet is flagged as "execution stalled" regardless of KPI movement. This feeds into the biweekly Kill Switch assessment.

#### Auto-Crediting: Content Machine Integration

Recurring Moves linked to a Content Machine (via content_machine_id) benefit from automatic instance crediting. When a ContentPiece in the linked machine's Kanban pipeline transitions to "Published" status, the system:

1. Identifies the active Recurring Move linked to that content machine on the relevant bet.
2. Finds the current cadence cycle's pending MoveInstance(s).
3. Credits the oldest pending instance by setting status = completed, completed_at = now, and linking the ContentPiece as the evidencing entity.

This means a content creator working in the editor — drafting a newsletter, moving it through Review → Scheduled → Published — automatically advances the corresponding Recurring Move without any extra data entry. The chain is fully connected: editor → content machine → Recurring Move → bet → lead indicator → scoreboard.

#### Auto-Crediting: External Content Hooks

Not all content is produced inside TrueNorth. Discourse topics, social media posts, podcast episodes, and other external outputs need a path to credit Recurring Move instances without requiring manual logging.

Each Recurring Move can optionally configure an external_source definition (e.g., webhook type, platform, match rules for author/category/tags). When the external system fires a webhook to TrueNorth's generic webhook endpoint, the system matches the payload against active Recurring Moves' external_source configurations and credits the appropriate MoveInstance.

**Supported external source types (v1):**

| Platform | Webhook Trigger | Match Criteria |
|----------|----------------|----------------|
| Discourse | Topic created, Post created | Author, category, tag, min word count |
| Instagram (via Zapier/Make) | Post published | Account, hashtag, post type |
| YouTube (via Zapier/Make) | Video published | Channel, playlist |
| Podcast host (via RSS) | Episode published | Feed URL, keyword match |
| Generic webhook | POST to endpoint | Custom JSON path matching |

**Manual crediting fallback:** When webhooks are not configured, the Move owner can manually credit an instance from: the Move detail view, the daily pulse (matching shipped work to open Moves/instances), or Discord via `/move-done`.

#### Move List View

The full Move list for a bet displays:

- Milestone Moves sorted by status (in_progress first, then not_started by due date, then shipped, then cut).
- Recurring Moves sorted by health status (red first).
- Each Move shows: title, owner avatar, health badge, due date (Milestone) or rhythm indicator with current cycle progress (Recurring), linked KPI badges, and blocker indicator.
- Quick actions: change status, assign owner, link blocker, add comment.

#### What Moves Explicitly Excludes

The following capabilities are intentionally out of scope to keep TrueNorth at the operating system layer:

- **Subtasks under Moves.** If a Move needs decomposition, the sub-work lives in personal to-dos or an external tool.
- **Dependencies between Moves.** No blocking relationships, no critical path analysis. Cross-Move coordination uses blockers and communication.
- **Custom fields on Moves.** Title, owner, dates, effort, and KPI links are sufficient.
- **Sprint planning or velocity tracking.** Moves track "did it ship?" and "is the rhythm holding?", not team velocity curves.
- **Gantt charts or timeline views.** The War Room progress bar and the Media Calendar are the visualization surfaces.
- **Cross-bet Move dependencies.** Moves belong to one bet. Cross-bet coordination happens through Blockers and the Operator Cockpit.

---

## 6. AI and Agent Layer

### 6.1 Claude Agent SDK Integration

The AI layer is powered by the Claude Agent SDK from Anthropic. All AI features are implemented as discrete agents with defined roles, inputs, outputs, and escalation paths. Agents are orchestrated via Supabase Edge Functions that call the Claude Agent SDK.

**Agent architecture**

Each AI capability is implemented as a named agent with a system prompt that includes the active venture's current Vision (BHAG, strategic filters, annual outcomes) and relevant context. Agents always operate within a venture scope — the Filter Guardian evaluates against one venture's filters, the Signal Watch monitors one venture's KPIs. For agents that serve the whole organization (e.g., Agenda Builder pulling cross-venture data for a portfolio-level meeting), the system prompt includes all ventures' context.

| Agent Name | Type | Trigger | Input | Output |
|-----------|------|---------|-------|--------|
| Filter Guardian | Evaluation | Idea exits cooling period | Idea description + all strategic filters | Pass/fail per filter with reasoning + confidence level |
| Content Copilot | Drafting | User invokes via slash command in editor | Prompt + content context + brand voice guidelines | Draft text, rewrite, expansion, or summary |
| Signal Watch | Monitoring | Daily cron (6am) | All KPI time-series data for trailing 30 days + KPI linkage map | Anomaly alerts with plain-language explanation + correlated KPI warnings |
| Agenda Builder | Synthesis | 48 hours before scheduled meeting | Red/yellow KPIs, open blockers, pending decisions, pulse data, bet status, commitment tracker | Pre-populated meeting agenda document with structured sections |
| Kill Switch | Evaluation | Biweekly cron | Active projects, linked KPI movement, pulse mentions, Move velocity, Recurring Move rhythm compliance, blocker density on Moves | Kill/pause/continue recommendation per project + confidence level + execution health signal |
| Vault Archaeologist | Discovery | Monthly cron | Archived ideas + current strategic context | Resurfaced ideas that may now be relevant + reasoning |
| Cockpit Advisor | Synthesis | Daily cron (7am) | All operational objects, KPI status, bet health, commitment status, blocker age, Milestone Moves due within 48h, Recurring Moves at risk of missing cycle target | Single most important action recommendation for the operator |

### 6.2 Content Copilot: AI in the Editor

The Content Copilot is the second-highest priority AI feature. It lives inside the Tiptap editor as a slash command (/ai) and an inline selection action. Capabilities:

- **Draft from prompt:** User types /ai draft and provides a topic or outline. The agent generates a first draft in the user's brand voice (configured per organization as a system prompt template).

- **Rewrite selection:** Select text, choose "Rewrite" from the floating toolbar. Options: simplify, expand, make more persuasive, adjust tone.

- **Continue writing:** Place cursor at end of content, invoke /ai continue. The agent reads the existing content and generates the next logical section.

- **Summarize:** Select a long section, choose "Summarize." The agent produces a concise version.

- **SEO optimization:** For deep content pieces, the agent suggests title tags, meta descriptions, and keyword placement based on the content topic.

All AI-generated content is visually tagged with a subtle sage indicator, shows a confidence level, and is always editable. The human author retains full control. This aligns with the TrueNorth "Human-Only Work" principle: AI assists with production, but brand voice approval remains human.

### 6.3 AI Anomaly Detection

The Signal Watch agent runs daily at 6am (configurable). It performs statistical analysis on all KPI time-series data:

- **Threshold alerts:** Value crosses below the yellow or red threshold.

- **Trend reversal:** A KPI that was trending up reverses direction for 2+ consecutive periods.

- **Correlation detection:** When a leading KPI drops, the agent checks whether correlated lagging KPIs are likely to be affected (using the KPI Linkage Map) and provides an early warning.

- **Seasonality awareness:** For KPIs with 6+ months of data, the agent adjusts expectations for seasonal patterns.

Alerts are delivered to the KPI owner via in-app notification and Discord, with a deep link to the KPI detail page and the agent's analysis.

### 6.4 AI Trust, Approval & Audit System

All AI-generated output in TrueNorth includes explicit trust mechanics to ensure operators maintain confidence in and control over AI contributions.

**Display requirements for all AI output**

Every AI-generated recommendation, draft, evaluation, or alert must display:

- **Source inputs:** What data the agent used to generate this output (e.g., "Based on 30 days of KPI data for MRR, subscriber count, and open rate").
- **Confidence level:** A qualitative indicator (high/medium/low) based on data completeness, historical accuracy, and input quality. Displayed as a sage-tinted badge.
- **Suggested vs. auto-applied:** Clear indication of whether the output is a recommendation awaiting human approval or an action that was auto-applied.

**Approval requirements**

| Action Category | Approval Required | Who Approves |
|----------------|-------------------|--------------|
| AI-generated content drafts | Always (suggested, never auto-published) | Content owner |
| Filter Guardian idea evaluations | Optional (pre-populated, human can override) | Idea reviewer |
| KPI anomaly alerts | No (informational only) | N/A |
| Kill Switch recommendations | Always (recommendation only, human decides) | Bet owner |
| Agenda Builder output | No (pre-populated, editable) | Meeting facilitator |
| Cockpit Advisor daily action | No (suggestion only) | Operator |
| AI-initiated KPI changes | Always | KPI owner |
| AI-initiated bet creation | Always | Operator |
| AI-initiated decision records | Always | Decision owner |

**Audit tracking**

The system tracks per-agent performance metrics over time:

- **Acceptance rate:** What percentage of AI suggestions are accepted without modification.
- **Override rate:** What percentage are modified or rejected by the human reviewer.
- **Error patterns:** Recurring categories of AI output that are consistently overridden, enabling system prompt refinement.
- **Time-to-action:** How long AI suggestions sit before being acted on (indicating trust or friction).

These metrics are displayed on each agent's Role Card and in a system-wide AI Performance Dashboard accessible to admins. Trends in acceptance/override rates inform whether AI trust levels should be increased (moving toward more autonomous operation) or decreased (requiring more human approval).

**Autonomy levels per agent**

Each agent operates at a defined autonomy level:

- **Suggest only:** Agent produces output that requires explicit human approval before any system change occurs. (Default for all agents in v1.)
- **Auto-apply with notification:** Agent applies changes automatically but sends an immediate notification to the responsible human, who can reverse the change. (Future, requires demonstrated high acceptance rate.)
- **Autonomous:** Agent operates without notification for routine actions. (Future, reserved for low-risk, high-accuracy operations only.)

Autonomy level changes require admin approval and are logged in the Policy Engine audit trail.

---

## 7. Discord Integration and Cron Broadcast Engine

### 7.1 Discord as a First-Class Operating Surface

Since Discord is a permanent interaction surface for TrueNorth teams, it is treated as a first-class UI — not just an integration. The goal: someone could operate most of TrueNorth from Discord if needed.

**Channel = Function**

Discord channels map to TrueNorth functions. Each channel serves a specific operational purpose with dedicated bot behaviors:

| Channel | Function | Bot Behaviors |
|---------|----------|---------------|
| #daily-pulse | Async daily updates | Pulse submission, streak tracking, drift detection |
| #scoreboard | KPI status | Morning scoreboard, anomaly alerts, red KPI escalation |
| #bets | Quarterly bet discussions | Kill Switch reports, Week-6 checkpoints, bet status updates |
| #blockers | Blocker escalation | Blocker creation, aging alerts, resolution tracking |
| #ideas | Idea Vault | New idea capture, filter evaluation results, vault archaeology |
| #marketing | Content and funnel pipeline | Funnel health, content pipeline status, media calendar gaps |
| #operations | System health | Stale artifact alerts, cadence compliance, automation ladder |
| #general | Team-wide | Weekly priorities, commitments, decisions |
| #operator-briefing | Operator private | Portfolio summary, cross-venture alerts, AI advisor daily action |

**Slash Commands**

| Command | Action | Response |
|---------|--------|----------|
| /pulse | Submit daily pulse via modal form | Formatted pulse posted to #daily-pulse + saved to app |
| /idea "description" | Capture a new idea to the Vault | Confirmation + 14-day timer started |
| /scoreboard | View current KPI status | Embed showing R/Y/G for all active KPIs |
| /bets | View quarterly bet status | Embed showing 3 active bets with progress |
| /todo "task" --linked entity | Create a personal to-do | Confirmation + entity linkage |
| /blocker @person "description" | Flag a blocker and notify | Creates Blocker object, posted to #blockers + DM to tagged person |
| /commit "commitment" | Log weekly commitment | Creates Commitment object, saved and tracked to next sync |
| /focus | Show your current assignments | Your role card summary + active bets |
| /update-kpi [kpi-name] [value] | Update a KPI value | KPI updated, confirmation with new status |
| /decision "title" --context "..." | Log a decision | Creates Decision object with context |
| /cockpit | View your today summary | Cockpit embed with top alerts, due commitments, blockers |
| /moves | Show your active Moves across all bets | Embed grouped by bet with status, health, and due dates |
| /moves [bet-name] | Show all Moves for a specific bet | Full Move list for the bet with progress summary |
| /move-done [move-name] | Credit a Recurring Move instance or mark a Milestone shipped | Confirmation with updated cycle progress or status change |
| /move-add [bet-name] "title" | Quick-create a Milestone Move | Move created with owner = command invoker, linked to specified bet |

**Automated Summaries**

- **Daily cockpit summary (7am):** Posts the operator's Cockpit Advisor daily action recommendation to #operator-briefing.
- **Weekly sync prep (48 hours before):** Posts the AI-generated meeting agenda to #general with action items for each team member.
- **Cadence reminders:** Automated reminders for upcoming cadence events (weekly sync, monthly review, quarterly summit).

**Agent Participation in Discord**

AI agents actively participate in Discord channels:

- **Drift detection:** The Signal Watch agent posts in #scoreboard when it detects anomalies, tagging the KPI owner.
- **Missing update requests:** When KPIs are past their update cadence, the agent DMs the owner asking for the update.
- **Discussion summarization:** When a Discord thread reaches 20+ messages, the agent offers to summarize the discussion into a structured object (Decision, Blocker, Issue) via a reaction-triggered workflow.

### 7.2 Cron Broadcast Engine

**Philosophy**

The cron system is a general-purpose "scheduled broadcast" engine that can pull any data from the TrueNorth system, format it into a Discord message, and deliver it to any channel on any schedule. It is designed for full flexibility: admins and power users can create custom cron jobs that combine data queries, formatting templates, and delivery schedules.

**Architecture**

Each cron job is a record in the cron_jobs table with four components:

- **Schedule:** A standard cron expression (e.g., "0 9 * * 1-5" for 9am weekdays) plus timezone. The UI provides a human-readable builder ("Every weekday at 9:00 AM CT") alongside raw cron input for power users.

- **Data query:** A reference to one or more data sources. Queries are defined as named templates with parameters. Users select from a library of available queries and configure parameters. This is not raw SQL; it is a structured query builder that maps to predefined Supabase views and functions. Every query template accepts an optional venture_id parameter. When set, the query returns data for that venture only. When null, the query spans all ventures in the organization (cross-venture mode). In single-venture orgs, the venture parameter is auto-populated and hidden.

- **Format template:** A Handlebars-style template that converts the query results into a Discord embed. Users can customize the title, description, color, fields, and footer. A live preview shows how the message will render.

- **Delivery target:** One or more Discord channels (selected from connected server channels) and/or DM recipients (selected from team roster).

**Pre-Built Query Library**

v1 ships with a library of ready-to-use query templates that cover the most common broadcast needs. Power users can compose them into custom cron jobs with custom formatting.

| Query Template | Description | Parameters |
|---------------|-------------|------------|
| kpi_scoreboard | All KPIs with current value, target, R/Y/G status, trend | venture_id (optional), filter_by_status (all/red/yellow), tier (leading/lagging/all) |
| kpi_single | Detailed view of a single KPI with sparkline data | kpi_id |
| weekly_priorities | Each team member's stated commitment for the current week | venture_id (optional) |
| daily_work_summary | Aggregated pulse data for the day | venture_id (optional), date (default: today), user_id (optional) |
| bet_status | Active bets with owner, status, lead indicator values | venture_id (optional), quarter (default: current) |
| idea_vault_new | Ideas submitted in the past N days | venture_id (optional), days (default: 7) |
| funnel_health | Funnel registry with health grades | venture_id (optional), status_filter (optional) |
| blocker_report | Unresolved blockers sorted by age | venture_id (optional), min_age_days (default: 0) |
| pulse_streaks | Team pulse consistency leaderboard | period (default: week) |
| automation_ladder | Processes and their current automation level | venture_id (optional), min_level, max_level (optional) |
| commitment_tracker | Last week's commitments vs. completion status | venture_id (optional) |
| agent_performance | AI agent activity summary: tasks handled, escalations | period (default: week) |
| content_pipeline | Content pieces by status across all machines | venture_id (optional), machine_type (optional) |
| kill_switch_report | Biweekly project assessment results | venture_id (optional) |
| stale_artifacts | Core artifacts past their update cadence | venture_id (optional) |
| portfolio_summary | Cross-venture health summary (multi-venture orgs only) | none (always cross-venture) |
| decision_log | Recent decisions with context and linked entities | venture_id (optional), days (default: 7) |
| cadence_compliance | Cadence adherence scores by venture and user | venture_id (optional), period (default: month) |
| cockpit_summary | Operator cockpit data: top alerts, due commitments, at-risk bets | venture_id (optional) |
| moves_progress | Move status distribution per active bet with progress bars, overdue Milestones, and Recurring Move cycle completion rates | venture_id (optional), bet_id (optional), include_shipped (boolean, default false) |
| rhythm_health | Recurring Move health summary across all active bets, highlighting red and yellow rhythms with current cycle status | venture_id (optional), min_health_status (optional, default yellow) |

**Custom Query Composition**

Power users can compose multiple query templates into a single cron job. For example, a "Monday Morning Briefing" could combine kpi_scoreboard (red/yellow only) + weekly_priorities + blocker_report (age > 3 days) into a single formatted Discord embed posted to #general at 8:00 AM every Monday.

**Conditional Logic**

Cron jobs support optional conditions that control whether the broadcast fires:

- **Only if data exists:** Skip the broadcast if the query returns empty results.
- **Threshold trigger:** Only fire if a specific value crosses a threshold.
- **Day-of-quarter logic:** Fire only on specific days relative to the quarter start.

**Example Cron Configurations**

| Name | Schedule | Queries | Channel | Condition |
|------|----------|---------|---------|-----------|
| Morning Scoreboard | Weekdays 8am | kpi_scoreboard (red+yellow only) | #scoreboard | Only if any KPI is red or yellow |
| Weekly Priorities | Monday 9am | weekly_priorities | #general | Always |
| Daily Recap | Weekdays 5pm | daily_work_summary | #daily-pulse | Only if any pulses posted today |
| Blocker Nag | MWF 10am | blocker_report (age > 3 days) | #blockers | Only if stale blockers exist |
| Kill Switch | 1st & 15th, 9am | kill_switch_report | #bets | Always |
| Funnel Check | 1st of month, 9am | funnel_health | #marketing | Always |
| Pulse Reminder | Weekdays 4pm | pulse_streaks | DM to users with no pulse today | Only if someone hasn't pulsed |
| Idea Digest | Friday 9am | idea_vault_new (days=7) | #ideas | Only if new ideas submitted |
| Stale Artifact Alert | 1st of month | stale_artifacts | #operations | Only if any artifacts stale |
| Week-6 Checkpoint | Dynamic (quarter midpoint) | bet_status + commitment_tracker | #bets | Day-of-quarter = Week 6 Day 1 |
| Portfolio Briefing | Monday 7am | portfolio_summary | DM to operator | Always (multi-venture only) |
| Cockpit Daily | Weekdays 7am | cockpit_summary | DM to operator | Always |

**Management UI**

The cron management interface provides: a list view of all configured cron jobs with on/off toggles, a venture scope selector, a visual schedule builder, query parameter forms, a Handlebars format editor with live Discord embed preview, test-fire capability, and execution history with delivery status logs.

### 7.3 Multi-Venture Channel Strategy

Organizations with multiple ventures have two recommended channel strategies:

- **Shared server with venture prefixes:** One Discord server with channels like #fullstack-scoreboard, #nerdout-scoreboard, etc. Cross-venture channels (#daily-pulse, #general, #operator-briefing) have no prefix. This works well when the ventures share some team members.

- **Separate servers per venture:** Each venture has its own Discord server with the standard channel structure. The operator joins both. Cross-venture cron jobs deliver to the operator's DMs or a private #operator-briefing channel.

The cron engine supports both strategies. Each cron job targets a specific Discord channel ID, so the same query template can post to different channels in different servers.

---

## 8. Engagement and Gamification Layer

Business operating systems fail when people stop using them. TrueNorth software includes deliberate engagement mechanics that make the right behavior satisfying, not just productive.

**Pulse Streaks**

Consecutive daily pulse submissions build a visible streak on the user's profile. Streak milestones (7, 14, 30, 60, 90 days) earn badges. Broken streaks reset but historical best streak is preserved. The team's aggregate streak consistency is displayed on the scoreboard as a meta-KPI.

**Bet Graveyard**

Killed bets move to a visual graveyard with a positive framing: each "tombstone" shows the bet name, duration, lessons learned, and resources recovered. A counter tracks "Total hours saved by smart kills." This reinforces the philosophy that killing a bet is the system working.

**North Star Distance**

A persistent visual in the app header shows progress toward the BHAG as a journey metaphor. Key metrics feed into an aggregate progress score. Quarterly milestones are marked along the path. This creates an emotional connection to the long-term vision.

**Quarterly Retrospective Timeline**

At the end of each quarter, the system generates an animated timeline showing: content shipped, bets completed or killed, KPIs that improved, decisions made, and team highlights from pulses. This is shareable and designed to be celebratory.

**Idea Vault Archaeology**

The Vault Archaeologist agent periodically resurfaces archived ideas that have become newly relevant based on changes in strategic context, team capacity, or market conditions. These resurface as a notification: "You submitted 'Build mobile app' 8 months ago. Your distribution has grown 300% since then. Worth re-scoring?"

---

## 9. Progressive Web App (PWA)

The application ships as a PWA with a service worker for offline capability. The primary mobile use cases are:

- **Daily Pulse:** Full pulse submission form optimized for mobile input. Offline-first: pulse is saved locally and synced when connectivity returns.

- **To-Do management:** View, create, complete, and link to-dos from mobile.

- **Scoreboard:** Read-only KPI dashboard optimized for portrait orientation.

- **Cockpit:** Simplified Operator or Team Member Cockpit view with top alerts and due commitments.

- **Notifications:** Push notifications via service worker for @mentions, KPI alerts, blocker escalations, and pulse reminders.

- **Quick capture:** Idea vault capture and blocker creation via minimal forms accessible from the PWA home screen.

Desktop-optimized features (content editor, meeting mode, cron management, funnel registry) are accessible on mobile but not optimized for small screens in v1.

---

## 10. Phased Rollout Plan

> *Build the daily heartbeat first. If people are checking KPIs and posting pulses, the system has traction. Everything else compounds on top of that habit.*

### 10.1 Phase 1: The Heartbeat (Weeks 1–6)

Goal: Establish the daily and weekly operating rhythm. If the team is using the Scoreboard and Pulse daily by end of Phase 1, the product has achieved initial traction. Launch Mode guides new workspaces through setup.

- **Operator Cockpit:** Today view with KPI health, active blockers, due commitments, pulse status, and next cadence event. Team Member Cockpit with personal accountability view.

- **Launch Mode:** Guided onboarding system walking new workspaces through BHAG → filters → outcomes → KPIs → bets → role cards → pulse setup. Import from existing docs/spreadsheets. Progress checklist with milestone celebrations.

- **Scoreboard:** KPI CRUD, manual data entry, R/Y/G auto-calculation, Tier 1/Tier 2 views, single ownership enforcement, 5–15 KPI limit, structured metadata (unit, directionality, aggregation window, threshold logic), KPI action playbooks, linked driver KPIs.

- **Daily Pulse:** Four-field form with entity auto-suggest, bet linkage, blocker @mentions (auto-creates Blocker objects), pulse streak tracking.

- **Quarterly Bets:** Bet CRUD with all 7 anatomy fields, 3-bet max enforcement, basic War Room view.

- **Moves (Milestone type):** Move CRUD for Milestone Moves, Move list view on bet cards in War Room, pulse auto-suggest matching to Moves, Commitment → Move linkage in weekly sync. Discord /moves and /move-done commands. Policy Engine: 15 Move max, ownership required, cut reason required.

- **Operational Objects:** Decision, Blocker, Commitment, and Issue CRUD with polymorphic linking. Basic views in Cockpit.

- **Policy & Constraint Engine (core):** 3-bet limit, 5–15 KPI range, single KPI ownership, idea quarantine timer, classification requirement. Override logging for admin users.

- **Discord bot (basic):** /pulse, /scoreboard, /bets, /blocker, /commit, /cockpit, /moves, /move-done, /move-add slash commands.

- **Auth & multi-tenancy:** Supabase Auth, organization model, venture model (single venture auto-created during onboarding), invite-based team join, role-based permissions (admin/member/viewer). Data model supports multi-venture from day one; UI is single-venture only.

- **PWA shell:** Service worker, install prompt, offline pulse capture.

### 10.2 Phase 2: The Strategic Layer (Weeks 7–12)

Goal: Add the planning and idea management capabilities that make TrueNorth more than a dashboard.

- **Idea Vault:** Kanban board with enforced stages, 14-day cooling timer, More/Better/New classification requirement, filter review checklist, scoring framework, WIP limit enforcement.

- **AI: Filter Guardian:** Auto-evaluation of ideas against strategic filters via Claude Agent SDK. Confidence levels and source input display per AI Trust Model.

- **Vision Board:** BHAG, strategic filters as cards, annual outcomes, Not Doing list, edit gating via Policy Engine.

- **Role Cards:** Profile-as-role-card for all team members, live KPI linkage, agent role cards with AI trust metrics.

- **Funnel Registry:** Five-element registration, approved idea linkage requirement, single ownership, basic health grading.

- **Universal commenting:** Polymorphic comments on all entities (including operational objects), @mentions, threading, Discord notification delivery.

- **Personal to-dos:** Universal linking, quick capture shortcut, Discord /todo command.

- **Meeting Cadence System:** Weekly sync meeting mode with auto-generated agendas from operational objects. Structured output capture (Decisions, Commitments, Blockers).

- **Moves (Recurring type):** Recurring Move type with instance tracking and cadence management. Content Machine → Recurring Move auto-crediting. Recurring Move health calculation. Rhythm indicator on bet cards and Cockpit views. Move-aware weekly sync agenda (Focus Check expansion, rhythm review). moves_progress and rhythm_health cron templates. KPI linkage encouragement (soft policy warning).

- **Process Library (basic):** Versioned processes, ownership, trigger conditions, KPI linkages, automation level tracking.

- **Cron engine (basic):** Pre-built query templates, cron schedule builder, Discord channel targeting. Ship the 5 core cron jobs: morning scoreboard, weekly priorities, daily recap, blocker nag, cockpit daily.

- **Multi-venture UI:** Venture CRUD in Settings, venture switcher in navigation (hidden for single-venture orgs), venture-scoped data isolation on all venture-level entities. Venture rollups in Portfolio Dashboard. All single-venture simplification rules active.

- **Async Attention Model:** Notification tiers, quiet hours, escalation logic implemented for all notification types.

### 10.3 Phase 3: The Intelligence Layer (Weeks 13–20)

Goal: Add AI capabilities, the content engine, and the full cron broadcast system that make TrueNorth a genuinely intelligent operating system.

- **Content Machines:** Four-machine pipeline UI, Kanban stages, media calendar with One-Ask Rule enforcement and funnel linkage.

- **Collaborative editor:** Tiptap + Yjs, rich text, embeds, tables, slash commands, HTML/Markdown export, version history, structured object embeds, funnel/calendar links, process templates, full-text search indexing.

- **AI: Content Copilot:** Inline drafting, rewriting, expansion, and summarization in the editor. Confidence levels and AI trust indicators on all output.

- **AI: Signal Watch:** Daily KPI anomaly detection, trend reversal alerts, correlation analysis using KPI Linkage Map.

- **AI: Agenda Builder:** Auto-generated agendas for Weekly Sync, Monthly Review, and Quarterly Summit with structured data from operational objects.

- **AI: Cockpit Advisor:** Daily single-action recommendation for the operator based on full system state analysis.

- **AI Trust & Audit Dashboard:** Agent acceptance/override rates, error patterns, time-to-action metrics, autonomy level management.

- **Content commenting:** Inline text-anchored annotations, sidebar panel, resolved/unresolved tracking.

- **Meeting Mode (full):** 30-minute timer, auto-advancing segments, pre-populated agenda from operational objects, structured output capture for all three cadence types.

- **KPI integrations:** Stripe and ConvertKit API integrations, generic webhook endpoint, CSV bulk import.

- **Agent Roster:** Agent profiles, automation ladder tracker, monthly audit workflow, AI trust metrics per agent.

- **Process Library (full):** AI-assisted improvement suggestions, template generation, impact analysis.

- **Cron engine (full):** Custom query composition, conditional logic, threshold triggers, day-of-quarter scheduling, format editor with live preview, test-fire, execution logs. All new query templates (decision_log, cadence_compliance, cockpit_summary).

- **Engagement:** Bet Graveyard, North Star Distance, quarterly retrospective timeline, Vault Archaeologist.

- **Week-6 Checkpoint:** Formal review workflow with Green/Yellow/Red decision capture as Decision objects.

- **Biweekly Kill Switch:** Automated project assessment with kill/pause recommendations and confidence levels. Move velocity and rhythm compliance as primary input signals.

- **Moves (external hooks & AI):** External content hooks (Discourse webhook, generic webhook, Zapier/Make patterns). Media Calendar gap detection based on Recurring Move targets. Kill Switch enhancement with Move execution data. Cockpit Advisor enhancement with Move-aware daily recommendations. Content Copilot proactive suggestions based on Recurring Move gaps. Full Discord automation: rhythm alerts, stall detection in Kill Switch reports. Move execution health rollup on bet cards alongside KPI-based health.

- **Portfolio Dashboard:** Cross-venture health summary (multi-venture orgs only), venture health cards, unified blocker list, combined pulse feed, decision log, portfolio_summary cron template.

- **Cadence Intelligence System:** Compliance tracking, cadence scores, automated alerts for missed cadences.

- **Discord deepening:** Full slash command set, agent participation in channels, discussion summarization, automated summaries.

- **Policy Engine (full):** Policy dashboard, violation/override analytics, all v1 policies active, venture-specific policy overrides.

---

## 11. Success Metrics

TrueNorth software measures its own success using the same framework it provides to its users. These are the KPIs for the product itself:

### 11.1 Usage Metrics

| KPI | Type | Target (Phase 1) | Target (Phase 3) |
|-----|------|-------------------|-------------------|
| Daily Pulse completion rate | Leading | >80% of team posts daily | >90% |
| Weekly Sync attendance | Leading | 100% (it's the one required meeting) | 100% |
| Scoreboard review frequency | Leading | 3+ views per user per week | 5+ (daily habit) |
| Ideas evaluated through full pipeline | Leading | N/A (Phase 2) | 100% of ideas follow protocol |
| Bets with formal Week-6 checkpoint | Lagging | N/A (Phase 3) | 100% |
| Cron jobs configured and active | Leading | 5 core jobs running | 10+ custom jobs |
| Time from idea to bet decision | Lagging | N/A (Phase 2) | <21 days (14 cooling + 7 review) |
| Red KPIs with action plans | Lagging | 100% within 2 weeks | 100% within 1 week |

### 11.2 System Quality Metrics

These metrics assess whether TrueNorth is actually improving how teams operate, not just whether the product is being used:

| KPI | Type | Target (Phase 1) | Target (Phase 3) |
|-----|------|-------------------|-------------------|
| Time to first value (days to first live scoreboard + bets) | Lagging | <7 days | <3 days (with Launch Mode) |
| % of work linked to a bet or KPI | Leading | >60% of pulse items linked | >85% |
| Decision latency (time from issue → decision) | Lagging | N/A (Phase 2) | <5 business days |
| Blocker resolution time (median) | Lagging | N/A (Phase 1) | <3 business days |
| % of ideas killed before execution | Lagging | N/A (Phase 2) | >50% (system is filtering effectively) |
| Meeting time reduction (weekly sync actual vs. 30-min target) | Lagging | Within 5 min of target | Within 2 min of target |
| Pulse completion time (median) | Leading | <3 minutes | <2 minutes |
| Cadence compliance score (org-wide) | Lagging | >70% | >90% |
| AI suggestion acceptance rate (across all agents) | Leading | N/A (Phase 3) | >70% (indicating trust calibration) |
| 30-day retention by persona | Lagging | >80% (Operator), >60% (Team Member) | >90% (Operator), >80% (Team Member) |
| 90-day retention by persona | Lagging | >60% (Operator), >40% (Team Member) | >80% (Operator), >70% (Team Member) |

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Collaborative editor complexity (Tiptap + Yjs) | High — this is the single hardest feature to build well | Phase 3 delivery; use Liveblocks or Hocuspocus as Yjs backend to reduce custom infrastructure |
| Cron engine scope creep | Medium — full flexibility could become an engineering rabbit hole | Ship pre-built templates in Phase 2; custom composition in Phase 3 |
| AI cost management | Medium — Claude API costs scale with usage | Cache frequent evaluations; batch daily analyses; set per-org monthly AI budget caps |
| Discord bot reliability | Medium — bot downtime blocks pulse input for Discord-first users | Implement retry logic; ensure web app is always the fallback; health monitoring |
| Multi-tenancy data isolation | High — RLS policy errors could leak data between orgs | Comprehensive RLS test suite; security audit before productization |
| Adoption friction | High — the system requires daily habit formation | Phase 1 focuses on daily habit (pulse + scoreboard); Launch Mode guides setup; gamification reinforces consistency |
| Multi-venture UX complexity | Medium — venture switching and cross-venture views could confuse single-venture users | Single-venture simplification rules hide all multi-venture UI until second venture is created; progressive disclosure |
| Policy Engine rigidity | Medium — overly strict enforcement could frustrate teams before they internalize the philosophy | Override mechanism for all hard-block policies; admin audit log for visibility; policy violation messaging is explanatory, not punitive |
| Notification noise | Medium — async-first system with Discord integration could become overwhelming | Async Attention Model with explicit tiers, quiet hours, and escalation rules; digest-first default |
| AI trust calibration | Medium — too much AI autonomy erodes trust; too little adds friction | Suggest-only default for all agents; acceptance/override tracking informs autonomy advancement; transparent confidence levels |
| Operational object overhead | Low-Medium — Decisions, Blockers, Commitments, Issues could feel like bureaucracy | Auto-creation from natural workflows (pulse → blocker, sync → commitment); minimal required fields; structured output from meetings reduces manual entry |

---

## 13. Appendix

### 13.1 Glossary

| Term | Definition |
|------|-----------|
| BHAG | Big Hairy Audacious Goal. A 3–10 year horizon milestone that defines ultimate victory. |
| Bet | A quarterly initiative with a thesis, kill criteria, and proof-by-week-6 evidence. Not a goal or OKR. |
| Pulse | A daily async status update: Shipped, Focus, Blockers, Signal. Takes under 2 minutes. |
| War Room | The quarterly view showing exactly 3 active bets with full anatomy. |
| Idea Vault | The quarantine zone for new ideas. 14-day cooling period enforced. |
| Kill Switch | Biweekly assessment: does this project still advance a bet or move a KPI? |
| Role Card | An individual's accountability contract: outcomes owned, metrics moved, decision authority. |
| Content Machine | A repeatable content production pipeline with owner, cadence, and KPI. |
| Automation Ladder | The L0–L4 progression from manual process to fully autonomous. |
| Cron Job | A scheduled broadcast that queries TrueNorth data and posts formatted messages to Discord. |
| Venture | An operational unit within an Organization. Each venture has its own BHAG, bets, KPIs, idea vault, and content machines. Single-venture orgs never see the venture abstraction. |
| Portfolio Dashboard | Cross-venture summary view showing health scores, active bets, and top alerts per venture. Visible only in multi-venture organizations. |
| Operator Cockpit | The default home screen for admins/operators. Surfaces the most important action items across all ventures. |
| Team Member Cockpit | The default home screen for individual contributors. Shows personal commitments, KPIs, and blockers. |
| Launch Mode | The guided onboarding system that walks new workspaces through TrueNorth setup. |
| Decision | A first-class record of a choice made, with context, options, and audit trail. |
| Blocker | A first-class record of something preventing progress, with severity and resolution tracking. |
| Commitment | A structured promise made during a cadence event, tracked to completion or miss. |
| Issue | A general-purpose record of operational friction, triaged in weekly syncs. |
| Policy Engine | The central system that enforces TrueNorth philosophy rules as executable constraints with override logging. |
| Filter Guardian | AI agent that evaluates ideas against strategic filters. |
| Content Copilot | AI assistant embedded in the content editor for drafting and rewriting. |
| Signal Watch | AI agent that monitors KPIs for anomalies and trend reversals. |
| Cockpit Advisor | AI agent that synthesizes system state into a daily action recommendation. |
| Async Attention Model | The system-wide rules governing notification priority, quiet hours, and escalation logic. |
| Cadence Intelligence | The subsystem that monitors adherence to prescribed operating rhythms. |

### 13.2 Reference Documents

- **TrueNorth Business Operating System v1.1** (March 2026) — The source framework document. All pillar numbers, cadences, and rules in this PRD reference the canonical TrueNorth document.

- **EOS (Entrepreneurial Operating System)** — Foundation framework for vision, traction, and accountability concepts.

- **Scaling Up (Verne Harnish)** — Foundation framework for people, strategy, execution, and cash disciplines.

### 13.3 Changelog (v1 → v2)

| Change | Section(s) Affected | Source |
|--------|---------------------|--------|
| Added Operator Cockpit ("Today" view) as default home screen | 5.13, 2.1, 2.2, 10.1 | Feedback: First-class operating surface needed |
| Added Team Member Cockpit (role-scoped view) | 5.13, 2.2 | Feedback: Role-scoped default view |
| Added Launch Mode guided onboarding system | 5.14, 10.1 | Feedback: 30-day implementation as product experience |
| Added Decision, Blocker, Commitment, Issue as first-class entities | 4.3, 5.15, 5.5 | Feedback: Operational objects power accountability loops |
| Added Policy & Constraint Engine | 4.5, 5.1–5.4 | Feedback: Philosophy rules as executable constraints |
| Expanded Process Library into full module | 5.9 | Feedback: Versioning, triggers, AI suggestions |
| Expanded Meeting Cadence System into full module | 5.9, 5.5 | Feedback: Structured meeting definitions and output |
| Expanded Media Calendar with funnel/campaign linkage | 5.7 | Feedback: Calendar as operational tool, not just dates |
| Separated lifecycle state from health state | 4.3 | Feedback: Independent state dimensions prevent ambiguity |
| Added Async Attention Model | 4.7 | Feedback: Explicit notification tiers, quiet hours, escalation |
| Deepened Discord as first-class operating surface | 7.1 | Feedback: Full slash command set, agent participation, summaries |
| Added AI Trust, Approval & Audit System | 6.4 | Feedback: Confidence levels, approval workflows, acceptance tracking |
| Strengthened KPI system with metadata, linkage, and playbooks | 5.4 | Feedback: Action playbooks, driver linkage, structured metadata |
| Added system quality success metrics | 11.2 | Feedback: Metrics beyond usage that measure operational improvement |
| Added multi-scale architecture section | 4.6 | Feedback: Role-based views, aggregation layers, performance design |
| Strengthened editor as narrative layer of the OS | 5.7 | Feedback: Structured embeds, queryable content, template/funnel links |
| Required More/Better/New idea classification | 5.2 | Feedback: Classification before scoring |
| Required funnel-to-idea linkage | 5.7 | Feedback: Funnel creation requires approved idea or override |
| Added Cockpit Advisor AI agent | 6.1, 5.13 | Feedback: AI-generated daily action recommendation |
| Added Cadence Intelligence System | 5.16 | Feedback: Cadence compliance tracking and alerting |
| Added venture rollups and cross-venture comparisons | 4.2 | Feedback: Aggregation for multi-venture operators |

*End of Document*
