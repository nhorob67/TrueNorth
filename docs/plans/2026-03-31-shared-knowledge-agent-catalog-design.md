# Shared Knowledge Layer + Agent Catalog Design

## Goal

Add two linked product capabilities:

1. A shared knowledge layer that unifies internal TrueNorth data and external sources, and returns grounded results with citations.
2. A non-admin agent catalog visible to every signed-in org member, including the approved skills each agent uses.

The intended outcome is that agent outputs become more trustworthy, more legible, and more reusable across the product.

## Why This Fits TrueNorth

TrueNorth already has:

- Strong internal operating data: visions, KPIs, bets, moves, blockers, decisions, commitments, issues, processes, meeting logs, narratives, content, comments.
- An agent runtime model: agents, tasks, memory, skills, workflows, costs, drift, autonomy controls.
- Early search infrastructure via `api/entities/search`.

What is missing is the shared retrieval and provenance layer that lets agents ground outputs in business context, plus a member-facing surface that explains what each agent actually knows and does.

## Product Scope

### Shared knowledge layer

The first version should support:

- Internal sources:
  - visions
  - kpis
  - bets
  - moves
  - blockers
  - decisions
  - commitments
  - issues
  - processes
  - meeting_logs
  - generated_narratives
  - content_pieces
  - comments
- External sources:
  - uploaded files
  - PDFs
  - URLs / crawled web pages
  - connector-backed sources

The layer should provide:

- normalized knowledge documents
- chunked retrieval records
- sync status and freshness
- source ownership and access scope
- citation payloads that can be rendered consistently in the UI

### Agent catalog

The first version should be visible to every signed-in org member and should show:

- agent identity and purpose
- status and automation level
- scope, boundaries, and capabilities
- linked workflows
- approved skills in active use
- knowledge access summary
- trust/performance summary
- example tasks or use cases

It should not expose unapproved skills, raw session memory, or sensitive internals meant only for admins.

## Design Principles

- Retrieval should be source-aware, not just full-text search.
- Citations should be attached to AI claims, summaries, and recommendations.
- Approved skills are product value and should be surfaced to members.
- External connectors are in scope from day one, so provenance and sync lifecycle must be designed now.
- The member catalog should explain agents in business language, not infrastructure language.

## Information Architecture

### Navigation

Add two library tabs:

- `Agents` at `/library/agents`
- `Knowledge` at `/library/knowledge`

Rationale:

- Both features are reusable organizational assets, similar to processes and artifacts.
- They should be discoverable by all members, not buried in Admin.

Update:

- `app/src/app/(dashboard)/library/layout.tsx`
- command palette navigation items

### Primary surfaces

#### Library -> Agents

Member-facing list of all org agents with filters:

- category
- status
- automation level
- Hermes enabled

Each card shows:

- name
- short description
- role or category label
- automation level
- key capabilities
- approved skill count
- linked workflow count
- trust summary

Agent detail page shows:

- overview
- what it is allowed to do
- where it is used
- approved skills
- knowledge sources it can access
- recent reviewed outputs or examples

#### Library -> Knowledge

Unified search and source management surface for members.

Main views:

- search results
- source explorer
- source detail page

Search results should show:

- result title
- source type
- source location
- freshness
- matching snippet
- citation link target

## Citation UX

Citations should appear anywhere the UI presents AI-derived content that a user may rely on.

Include citations in v1 on:

- knowledge search results
- agent response panels
- generated narratives
- generated content drafts
- AI recommendation surfaces in Cockpit and Reviews

Do not try to retrofit citations into every screen immediately.

Standard citation object for UI rendering:

- source title
- source type
- source id
- source href
- snippet
- anchor label
- freshness label
- confidence label

The UI should support:

- inline citation pills like `[1] [2]`
- expandable citation drawer
- “open source” action

## Data Model

### New tables

#### `knowledge_sources`

Represents a logical source configured for an organization.

Fields:

- `id`
- `organization_id`
- `venture_id nullable`
- `name`
- `source_type`
  - `internal_entity`
  - `upload`
  - `web_page`
  - `connector`
- `connector_type nullable`
  - initial candidates: `google_drive`, `notion`, `slack`, `github`, `web`, `pdf_upload`
- `external_ref nullable`
- `config jsonb`
- `status`
  - `active`
  - `paused`
  - `error`
- `visibility`
  - `org`
  - `venture`
  - `restricted`
- `last_synced_at nullable`
- `last_sync_status nullable`
- `last_sync_error nullable`
- `created_by`
- `created_at`
- `updated_at`

#### `knowledge_documents`

Represents a normalized document or record retrievable by the system.

Fields:

- `id`
- `organization_id`
- `venture_id nullable`
- `source_id`
- `document_type`
  - `entity`
  - `file`
  - `web_page`
  - `message_thread`
  - `generated_artifact`
- `entity_type nullable`
- `entity_id nullable`
- `title`
- `canonical_url nullable`
- `content_text`
- `metadata jsonb`
- `permissions_scope jsonb`
- `checksum`
- `updated_from_source_at nullable`
- `indexed_at`
- `created_at`

#### `knowledge_chunks`

Chunked retrieval units for search and citations.

Fields:

- `id`
- `organization_id`
- `venture_id nullable`
- `document_id`
- `chunk_index`
- `content_text`
- `snippet_text`
- `token_count nullable`
- `embedding nullable`
- `search_vector`
- `anchor_label nullable`
- `metadata jsonb`
- `created_at`

Notes:

- Start with Postgres full-text and trigram search.
- Add embeddings in the same table or a sibling table once ranking quality needs it.

#### `knowledge_sync_runs`

Tracks ingestion/sync jobs.

Fields:

- `id`
- `organization_id`
- `source_id`
- `status`
  - `queued`
  - `running`
  - `completed`
  - `failed`
- `documents_created`
- `documents_updated`
- `documents_deleted`
- `error_message nullable`
- `run_metadata jsonb`
- `started_at`
- `completed_at nullable`

#### `agent_knowledge_access`

Controls what knowledge an agent can use.

Fields:

- `id`
- `organization_id`
- `agent_id`
- `source_id`
- `access_mode`
  - `read`
  - `read_citations_only`
- `created_at`

This gives a durable answer to “which sources can this agent use?”

### Optional later tables

- `knowledge_saved_searches`
- `knowledge_collections`
- `agent_examples`
- `knowledge_feedback`

### Existing tables to reuse

- `agents`
- `agent_skills`
- `agent_memory`
- `workflow_templates`
- `workflow_executions`
- `agent_tasks`
- domain entity tables already present in Supabase

## Internal Knowledge Ingestion

Internal entities should be projected into `knowledge_documents` and `knowledge_chunks`.

Recommended projection strategy:

- Each major entity becomes one document.
- Rich text fields, descriptions, summaries, and structured fields are flattened into normalized text.
- For large entities, generate multiple chunks.
- Comments and meeting outputs can either become standalone documents or append to parent entity documents depending on type.

Examples:

- KPI document includes name, description, formula, target, current value, health, playbook.
- Bet document includes outcome, rationale, health, linked moves.
- Process document includes name, description, content, automation level, linked KPI and bet references.

Implementation note:

- Start with server-side projection functions in TypeScript.
- Trigger reindex on create/update via route handlers and cron jobs before moving to DB triggers.

## External Sources And Connectors

### Day one source types

V1 should support:

- file upload
- PDF upload
- URL ingestion
- connector abstraction

### Connector model

Do not hardcode product logic to a connector.

Use:

- one source registry table
- one sync execution table
- connector adapters in `app/src/lib/knowledge/connectors`

Connector adapter contract:

- validate config
- list documents
- fetch document
- extract normalized metadata
- return canonical source URL and timestamps

### Initial connector rollout

Ship in phases:

1. `web` and `pdf_upload`
2. `google_drive` and `notion`
3. `slack` and `github`

This keeps day one scope aligned with the request while avoiding overcommitting the first release.

## Retrieval And Citations

### Retrieval API

Add a dedicated knowledge API family:

- `GET /api/knowledge/search`
- `GET /api/knowledge/sources`
- `POST /api/knowledge/sources`
- `POST /api/knowledge/sources/:id/sync`
- `GET /api/knowledge/documents/:id`
- `GET /api/agents/catalog`
- `GET /api/agents/catalog/:agentId`

### Search response shape

Return:

- result identity
- display metadata
- snippet
- score
- source metadata
- citation payload

Example response item:

- `documentId`
- `chunkId`
- `title`
- `snippet`
- `sourceType`
- `sourceTitle`
- `sourceHref`
- `entityType`
- `entityId`
- `freshness`
- `citation`

### Citation object

Every citation object should be serializable and reusable across product surfaces.

Suggested shape:

- `id`
- `title`
- `href`
- `sourceType`
- `sourceId`
- `documentId`
- `chunkId`
- `snippet`
- `anchorLabel`
- `retrievedAt`

### AI integration

Where AI routes currently generate summaries or recommendations, retrieval should happen before model invocation.

Model prompts should receive:

- user request
- retrieved context blocks
- citation ids and source metadata

Persist AI outputs with citations in structured form where possible.

Suggested additions:

- add `citations jsonb` to `generated_narratives`
- add citation support in AI recommendation payloads stored in notifications or derived output tables
- add citation support to content draft/version metadata

## Agent Catalog Design

### List page

Page: `/library/agents`

Filters:

- category
- status
- automation level
- Hermes enabled
- has approved skills

Sorting:

- name
- most used
- highest trust
- most recently updated

### Detail page

Page: `/library/agents/[agentId]`

Sections:

- Overview
- Capabilities
- Approved Skills
- Knowledge Access
- Workflows
- Trust & Performance
- Example Uses

### Skills section

This is important enough to treat as a first-class section, not a footnote.

Show:

- approved skill name
- description
- source
- version
- shared or private
- updated date

Hide by default:

- full raw `skill_content`

Instead:

- show a concise summary by default
- allow expansion for members if the skill is approved and safe to reveal

Rationale:

- members should understand what Hermes has learned
- the UI should not dump raw SKILL.md walls by default

### Knowledge access section

Show which knowledge sources the agent is grounded in:

- internal sources available
- external sources connected
- last refresh status

This turns “trust me” into inspectable grounding.

## Permissions

### Member access

Every signed-in org member can:

- browse the agent catalog
- view approved skills
- search knowledge they have access to
- view citations on AI outputs

### Admin/manager access

Admins and managers additionally can:

- manage connectors
- edit source scopes
- approve skills
- manage agent knowledge access
- inspect raw memory and sync operations

### Sensitive data rule

Do not expose:

- unapproved skills
- session memory
- review notes not meant for members
- restricted connector content outside allowed scope

## Implementation Plan

### Phase 1: Foundations

- Add `Library -> Agents` and `Library -> Knowledge` navigation
- Add schema for sources, documents, chunks, sync runs, and agent knowledge access
- Build internal document projection for core TrueNorth entities
- Build initial search API backed by Postgres full-text/trigram
- Build citation object and shared citation UI primitives

Deliverable:

- searchable internal knowledge with citations
- member-facing agent catalog shell

### Phase 2: Skills + agent catalog depth

- Build `/library/agents`
- Build `/library/agents/[agentId]`
- Surface approved skills per agent
- Surface workflow and trust summaries
- Add knowledge access section per agent

Deliverable:

- members can understand what each agent does and what it has learned

### Phase 3: External sources and sync

- Add source management UI
- Add URL and PDF ingestion
- Add sync runner and source status
- Normalize external docs into documents/chunks
- Add citation rendering for external sources

Deliverable:

- internal and external source retrieval in one search experience

### Phase 4: AI surface integration

- Add retrieval and citations to agent response panels
- Add citations to narratives
- Add citations to content draft flows
- Add citations to cockpit and review recommendations

Deliverable:

- agent-derived recommendations become inspectable and grounded

### Phase 5: Connector expansion and ranking quality

- Add first real connectors
- improve ranking
- add embeddings if needed
- add saved searches / collections if product demand is strong

## Key File And Module Additions

Suggested new modules:

- `app/src/lib/knowledge/`
- `app/src/lib/knowledge/connectors/`
- `app/src/lib/knowledge/projectors/`
- `app/src/lib/knowledge/search.ts`
- `app/src/lib/knowledge/citations.ts`

Suggested new routes:

- `app/src/app/api/knowledge/search/route.ts`
- `app/src/app/api/knowledge/sources/route.ts`
- `app/src/app/api/knowledge/sources/[id]/sync/route.ts`
- `app/src/app/api/agents/catalog/route.ts`
- `app/src/app/api/agents/catalog/[agentId]/route.ts`

Suggested new UI:

- `app/src/app/(dashboard)/library/agents/page.tsx`
- `app/src/app/(dashboard)/library/agents/[agentId]/page.tsx`
- `app/src/app/(dashboard)/library/knowledge/page.tsx`
- `app/src/components/citations/`
- `app/src/components/agents/`
- `app/src/components/knowledge/`

## Risks

### Connector complexity

External connectors can expand scope quickly. Keep the connector contract strict and the initial set small.

### Permissions leakage

The shared knowledge layer must preserve org and venture boundaries and respect source visibility.

### Citation quality

If chunks are too coarse or metadata is weak, citations will feel vague. Chunking and anchor labels matter.

### Skill exposure

Approved skills should be visible, but raw internal prompt mechanics may be noisy or sensitive. Summaries by default are safer.

## Recommendation

Start with:

- internal search + citations
- member-facing `/library/agents`
- approved skills surfaced in catalog
- URL/PDF external sources

That sequence creates visible user value quickly while establishing the foundation needed for deeper Hermes self-improvement and trustworthy AI outputs across the app.
