# Shared Knowledge Layer + Agent Catalog Implementation Plan

## Purpose

Translate the approved design into an execution-ready engineering plan for:

- shared knowledge layer with citations
- member-facing agent catalog
- approved skill visibility in the catalog

This plan assumes:

- external sources and connectors are in scope from day one
- the catalog is visible to every signed-in org member
- citations should appear on AI-derived surfaces where users are expected to trust or act on the output

## Scope Summary

### In scope

- new knowledge storage and retrieval schema
- internal entity projection into knowledge documents
- external source ingestion framework
- URL and PDF support in the first external release
- member-facing `/library/agents`
- agent detail pages with approved skills
- reusable citation UI and response contract
- citation support for knowledge search, agent responses, narratives, content drafts, and cockpit/review AI recommendations

### Out of scope for the first implementation wave

- broad connector catalog beyond the first small set
- embeddings-first retrieval
- knowledge collections and saved searches
- exposing raw session memory to members
- full inline citation retrofit across every existing record view

## Delivery Strategy

Deliver in five milestones.

Each milestone should leave the product in a shippable state.

## Milestone 1: Knowledge Foundation

### Goal

Create the underlying schema and backend primitives for normalized knowledge storage, sync tracking, retrieval, and citation payloads.

### Work items

#### 1. Add schema

Create a new migration for:

- `knowledge_sources`
- `knowledge_documents`
- `knowledge_chunks`
- `knowledge_sync_runs`
- `agent_knowledge_access`

Also add:

- indexes for org, venture, source, and document lookups
- full-text search support on `knowledge_chunks`
- RLS policies aligned with organization membership and source visibility

Suggested migration file:

- `app/supabase/migrations/00038_shared_knowledge_layer.sql`

#### 2. Add TypeScript types

Extend [database.ts](/Users/nickhorob/Documents/TrueNorth/app/src/types/database.ts) with:

- `KnowledgeSource`
- `KnowledgeDocument`
- `KnowledgeChunk`
- `KnowledgeSyncRun`
- `AgentKnowledgeAccess`
- `Citation`

#### 3. Add knowledge library modules

Create:

- `app/src/lib/knowledge/types.ts`
- `app/src/lib/knowledge/citations.ts`
- `app/src/lib/knowledge/search.ts`
- `app/src/lib/knowledge/chunking.ts`
- `app/src/lib/knowledge/permissions.ts`

Responsibilities:

- chunk raw content into displayable/searchable chunks
- build reusable citation objects
- run retrieval queries
- enforce source visibility

#### 4. Add knowledge APIs

Create:

- `app/src/app/api/knowledge/search/route.ts`
- `app/src/app/api/knowledge/sources/route.ts`
- `app/src/app/api/knowledge/sources/[sourceId]/route.ts`
- `app/src/app/api/knowledge/documents/[documentId]/route.ts`

API responsibilities:

- authenticated search
- source listing and creation
- document detail fetch
- citation-ready result payloads

### Testing

- migration smoke test locally
- route tests for auth and org scoping
- search result contract tests
- citation serialization tests

### Exit criteria

- internal empty knowledge layer exists and is queryable
- authenticated members can call search without permission leaks
- citation payload shape is stable enough for UI integration

## Milestone 2: Internal Knowledge Projection

### Goal

Make TrueNorth’s existing business data retrievable through the new knowledge layer.

### Work items

#### 1. Build projectors

Create:

- `app/src/lib/knowledge/projectors/`

Suggested projector modules:

- `vision-projector.ts`
- `kpi-projector.ts`
- `bet-projector.ts`
- `move-projector.ts`
- `decision-projector.ts`
- `blocker-projector.ts`
- `commitment-projector.ts`
- `issue-projector.ts`
- `process-projector.ts`
- `meeting-log-projector.ts`
- `narrative-projector.ts`
- `content-piece-projector.ts`
- `comment-projector.ts`

Each projector should:

- normalize an entity into document title + body + metadata
- provide canonical links back into the app
- return source freshness fields

#### 2. Add indexing service

Create:

- `app/src/lib/knowledge/index-internal-entity.ts`
- `app/src/lib/knowledge/reindex-organization.ts`

Add org-level reindex support for:

- initial backfill
- repair runs

#### 3. Decide write trigger strategy

Use application-layer indexing first.

On create/update flows for supported entities:

- queue or trigger lightweight reindex logic

Do not start with DB triggers unless necessary.

#### 4. Add admin/system reindex endpoint

Create:

- `app/src/app/api/knowledge/reindex/route.ts`

This should be protected to admin/manager or cron usage.

### Testing

- projector unit tests for representative entities
- canonical link tests
- update/reindex idempotency tests
- organization boundary tests

### Exit criteria

- major internal entities are searchable from the knowledge layer
- search results deep-link back into existing app pages
- freshness and citation metadata render correctly

## Milestone 3: Member-Facing Agent Catalog

### Goal

Expose a Library-native catalog for all members and make approved skills visible as product value.

### Work items

#### 1. Add library navigation

Update:

- [library/layout.tsx](/Users/nickhorob/Documents/TrueNorth/app/src/app/(dashboard)/library/layout.tsx)
- [command-palette.tsx](/Users/nickhorob/Documents/TrueNorth/app/src/components/command-palette.tsx)

Add tabs/items:

- `/library/agents`
- `/library/knowledge`

#### 2. Build catalog routes

Create:

- `app/src/app/(dashboard)/library/agents/page.tsx`
- `app/src/app/(dashboard)/library/agents/[agentId]/page.tsx`

Create supporting views:

- `agents-view.tsx`
- `agent-detail-view.tsx`

#### 3. Build catalog API

Create:

- `app/src/app/api/agents/catalog/route.ts`
- `app/src/app/api/agents/catalog/[agentId]/route.ts`

Return:

- agent basics
- role card summary when present
- approved skills
- workflow counts
- trust summary
- knowledge access summary

#### 4. Surface approved skills

Use [agent_skills](/Users/nickhorob/Documents/TrueNorth/app/supabase/migrations/00033_agent_skills.sql) as the source of truth.

Member rules:

- show only `approved = true`
- show `skill_name`, `skill_description`, `source`, `version`, `updated_at`, `shared`
- do not show unapproved skills

UI pattern:

- skills summary chips on the list page
- dedicated Approved Skills section on detail page
- optional expandable detail for approved skill content only if it reads well enough

#### 5. Surface knowledge access

Use `agent_knowledge_access` to show which source groups an agent can draw from.

Example labels:

- Internal operating system data
- Web knowledge
- Uploaded docs
- Connected Notion workspace

### Testing

- member access tests
- approved skill filtering tests
- catalog payload contract tests
- route-level auth tests

### Exit criteria

- every org member can browse the catalog
- approved skills are visible and legible
- admins still retain richer management surfaces under Admin

## Milestone 4: External Sources And Sync Lifecycle

### Goal

Bring external knowledge into the same retrieval layer with sync tracking and provenance.

### Work items

#### 1. Build connector framework

Create:

- `app/src/lib/knowledge/connectors/types.ts`
- `app/src/lib/knowledge/connectors/registry.ts`
- `app/src/lib/knowledge/connectors/base.ts`

Connector interface should support:

- source validation
- list documents
- fetch document
- normalize metadata
- report sync timestamps and external ids

#### 2. Build day-one connectors

Implement first:

- `web`
- `pdf_upload`

Then prepare the contract for:

- `notion`
- `google_drive`

Do not block the release on the second pair unless they are nearly complete.

#### 3. Add source management UI

Create:

- `app/src/app/(dashboard)/library/knowledge/page.tsx`
- `knowledge-view.tsx`
- source creation dialog/components

Capabilities:

- list sources
- show source status
- trigger sync
- show last synced time
- show error state

#### 4. Add sync execution endpoint

Create:

- `app/src/app/api/knowledge/sources/[sourceId]/sync/route.ts`

Add a service module:

- `app/src/lib/knowledge/sync-source.ts`

#### 5. Consider background execution path

If sync duration becomes meaningful:

- use cron or Hermes-backed async work
- record progress in `knowledge_sync_runs`

### Testing

- connector contract tests
- malformed URL/file input tests
- sync status transition tests
- duplicate document/upsert tests

### Exit criteria

- members can search both internal and external sources
- admins/managers can add and sync at least web and PDF sources
- citation provenance remains stable across external content

## Milestone 5: Citation Integration Across AI Surfaces

### Goal

Make citations appear where AI output is trusted or acted on.

### Work items

#### 1. Add reusable citation UI primitives

Create:

- `app/src/components/citations/citation-pill.tsx`
- `app/src/components/citations/citation-list.tsx`
- `app/src/components/citations/citation-drawer.tsx`

#### 2. Integrate into knowledge search

Search results should show:

- source title
- snippet
- freshness
- open source action

#### 3. Integrate into agent response surfaces

Where there are dedicated agent panels or structured AI results, attach citations to the returned payload and render them below the answer.

#### 4. Integrate into narratives and content

Likely file targets:

- [reviews/narratives/page.tsx](/Users/nickhorob/Documents/TrueNorth/app/src/app/(dashboard)/reviews/narratives/page.tsx)
- content draft/editor flows under `execution/content`

Recommended storage change:

- add `citations jsonb` to generated artifact tables that persist AI output

Suggested migration file:

- `app/supabase/migrations/00039_ai_citations.sql`

#### 5. Integrate into cockpit and review recommendations

Primary candidate surfaces:

- [cockpit/page.tsx](/Users/nickhorob/Documents/TrueNorth/app/src/app/(dashboard)/cockpit/page.tsx)
- review AI recommendation panels

Rule:

- if the product is showing an AI-derived recommendation or summary, show citations

### Testing

- citation rendering tests
- artifact persistence tests for citations
- degraded-state tests when citations are unavailable

### Exit criteria

- users can inspect the basis for important AI outputs
- citations feel native rather than bolted on

## Sequencing Dependencies

Recommended order:

1. migration + types
2. search backend + citation contract
3. internal projectors
4. library navigation + catalog list/detail
5. approved skill visibility
6. external source support
7. AI surface citation rollout

Do not start external connector breadth before the internal retrieval layer and citation contract are stable.

## Ticket Breakdown

### Backend tickets

- add shared knowledge schema migration
- add knowledge TS types
- implement knowledge search service
- implement citation contract builder
- implement internal entity projectors
- implement reindex endpoint
- implement knowledge source CRUD
- implement source sync runner
- implement agent catalog API

### Frontend tickets

- add Library tabs and command palette items
- build `/library/knowledge`
- build `/library/agents`
- build agent detail page
- build citation primitives
- integrate citations into knowledge search
- integrate citations into narratives/content/cockpit surfaces

### Data + ops tickets

- org reindex backfill job
- sync monitoring and failure handling
- access review for source visibility rules

## File-Level Change Map

### Existing files likely to change

- [library/layout.tsx](/Users/nickhorob/Documents/TrueNorth/app/src/app/(dashboard)/library/layout.tsx)
- [command-palette.tsx](/Users/nickhorob/Documents/TrueNorth/app/src/components/command-palette.tsx)
- [database.ts](/Users/nickhorob/Documents/TrueNorth/app/src/types/database.ts)
- AI surfaces in cockpit, reviews, and content flows

### New backend modules

- `app/src/lib/knowledge/*`
- `app/src/lib/knowledge/connectors/*`
- `app/src/lib/knowledge/projectors/*`

### New pages

- `app/src/app/(dashboard)/library/agents/*`
- `app/src/app/(dashboard)/library/knowledge/*`

### New API routes

- `app/src/app/api/knowledge/*`
- `app/src/app/api/agents/catalog/*`

## Testing Plan

### Unit

- chunking
- citation building
- source permission filtering
- projector normalization
- connector adapters

### Integration

- authenticated knowledge search
- org/venture visibility
- catalog payloads
- source sync flows

### UI

- Library navigation
- agent catalog filters
- approved skill rendering
- citation drawer interactions

### Regression

- existing admin skills and agents surfaces remain intact
- existing entity search keeps working while the new knowledge search is introduced

## Rollout Plan

### Release 1

- Milestone 1
- internal search backend hidden behind feature flag

### Release 2

- Milestone 2
- member-facing catalog list/detail
- approved skills visible

### Release 3

- Milestone 4 with web + PDF
- `/library/knowledge`

### Release 4

- milestone 5 citation rollout across major AI surfaces

Use feature flags for:

- knowledge search page
- external source management
- citation rendering on AI surfaces

## Risks And Mitigations

### Risk: Connector sprawl

Mitigation:

- strict connector interface
- start with web and PDF
- defer long-tail integrations

### Risk: Citation quality is weak

Mitigation:

- invest early in chunking and canonical links
- render freshness and source metadata prominently

### Risk: Sensitive skill content leaks

Mitigation:

- approved-only visibility
- default to summarized presentation
- keep raw editing/admin review in Admin

### Risk: Search becomes slow

Mitigation:

- start with tight indexes and bounded result sizes
- use chunk-level search only
- add embeddings later only if needed

## Definition Of Done

This initiative is complete when:

- members can browse `/library/agents`
- catalog entries show approved skills in use
- members can search `/library/knowledge`
- results span internal and external sources
- AI-derived search/response/recommendation surfaces render citations
- admins/managers can manage and sync sources without breaking existing agent admin flows

## Recommended First Sprint

First sprint should cover:

- migration `00038`
- knowledge types
- citation contract
- search service skeleton
- internal projector spike for `processes`, `visions`, `kpis`, and `bets`
- Library tab additions
- `/library/agents` list page with approved skills count

This gives the team the smallest slice that proves the architecture and starts surfacing Hermes learning as member-visible value.
