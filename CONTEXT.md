# Project Context

Last updated: 2026-02-19

## 1) Project Identity
- Name: `rcic-case-law-assistant`
- Domain: RCIC-focused Canadian immigration research assistant
- Frontend: React 19 + TypeScript + Vite + Tailwind (CDN config in `index.html`)
- Backend: Node.js + Express (`server/index.js`)
- Core retrieval/generation: Pinecone grounding + Groq response generation
- Optional case law retrieval: A2AJ REST search/fetch orchestration
- Persistence: Optional Postgres (`DATABASE_URL`) for users/sessions/messages/documents

## 2) Current Operational Reality (Important)
- The chat runtime is active and implemented end-to-end in `server/index.js`.
- Citation validation and clickable citation UX are implemented and working.
- Tiered retrieval, failure-state resolution, analysis-date headers, and audit trace scaffolding are implemented.
- `POST /api/ingest/pdi` is implemented.
- `POST /api/ingest` remains a placeholder and returns `{"ok":false,"message":"Ingest not implemented yet."}`.
- Several governance/eval artifacts exist and are useful, but parts of them are scaffolding rather than strict runtime enforcement.

## 3) Repository Map (High-Level)

### Runtime app
- Frontend entry: `index.tsx`, `App.tsx`
- Main pages: `pages/ChatPage.tsx`, `pages/CasesPage.tsx`, `pages/SettingsPage.tsx`, `pages/LandingPage.tsx`, `pages/LoginPage.tsx`, `pages/TermsPage.tsx`, `pages/CRSCalculatorPage.tsx`
- UI components: `components/chat/*`, `components/layout/Sidebar.tsx`, `components/shared/ExportMemoModal.tsx`, `components/ui/Generic.tsx`
- State/api/auth: `lib/store.tsx`, `lib/api.ts`, `lib/neonAuth.ts`, `lib/types.ts`

### Backend runtime
- API entrypoint: `server/index.js`
- RAG modules: `server/rag/*`
- Clients: `server/clients/*`
- DB layer: `server/db.js`, migration `server/db/migrations/phase2_documents.sql`
- PDI ingestion endpoint pipeline: `server/ingest/pdi/*`

### Governance and eval
- Contracts: `contracts/v1/*`
- Source policy: `config/source_policy.v1.json`, `config/sourcePolicy.js`
- Eval harness and matrix: `eval/*`

### Data + scripts
- Scraper pipeline: `scripts/scraper/*`
- Markdown ingestion: `scripts/ingest_md/*`
- PDF ingestion: `scripts/ingest_pdf/*`
- XML legislation chunking: `scripts/ingest_xml/*`
- Local manuals corpus: `manuals/*.pdf` (21 files)
- Scraped markdown corpus: `scripts/scraper/ircc_data_clean/*.md` (284 files)

## 4) Backend API Surface (`server/index.js`)
- `GET /api/health`
- `GET /api/history`
- `GET /api/documents`
- `POST /api/documents/text`
- `POST /api/chat`
- `POST /api/ingest`
- `POST /api/ingest/pdi`

Server defaults:
- Host: `127.0.0.1`
- Port: `3001`

## 5) `/api/chat` Runtime Flow (Implemented)

### Request setup
- Validates `message`.
- Resolves identity via headers/body/query with fallback dev identity.
- Session handling:
  - If DB enabled, enforces user-session ownership.
  - On ownership mismatch, creates a new session UUID.

### Input safety
- `detectPromptInjection()` + `sanitizeUserMessage()` + `isRcicRelatedQuery()`.
- If prompt-injection blocking is enabled and query is out-of-scope:
  - returns blocked response,
  - prepends analysis date header,
  - sets failure state `OUT_OF_SCOPE_SOURCE`,
  - optionally persists assistant message if DB is enabled.

### Retrieval and routing
1. Tiered Pinecone retrieval via `retrieveGrounding()`.
2. Route decision via `routeIntent()` (heuristic first, Groq router fallback).
3. Optional A2AJ case-law search + detail enrichment.
4. Optional user-document chunk ranking (`rankDocumentChunks()`) when DB docs exist.

### Prompt build and generation
- Prompt assembled by `buildPrompt()` with source blocks:
  - `P#` Pinecone
  - `C#` A2AJ case-law
  - `D#` user documents
- Generation via `groqAnswer()`.

### Post-generation guard/validation
- `validateCitationTokens()` removes invalid citation tokens.
- `enforceAuthorityGuard()` adds notices for:
  - no binding authority,
  - binding claims without binding citations,
  - temporal claims without effective date metadata.
- `extractCitations()` parses `[P#]/[C#]/[D#]`.
- `buildCitationFromSource()` maps citation objects for frontend.
- `resolveFailureState()` determines runtime failure state.
- `applyFailureStateNotice()` prepends user-visible notice for selected states.
- `prependAnalysisDateHeader()` prepends `Analysis date basis: YYYY-MM-DD (basis)`.

### Debug payload
When `DEBUG_MODE=true`, response may include:
- route decision
- prompt safety
- analysis date basis
- failure state/info
- budget counters
- retrieval diagnostics (tiers/filters/source IDs)
- A2AJ diagnostics
- audit trace summary + contract + contract validation

## 6) Retrieval, Citation, and Guard Details

### Tiered retrieval (`server/rag/grounding.js`)
- Query profiling infers mode/instrument/doc family/jurisdiction.
- Tier A (binding) + Tier B (guidance) queries with metadata filters.
- Optional compare mode runs additional doc-family comparison queries.
- Stable ranking sorts by score, authority rank, effective date, ID.
- `RAG_NO_SILENT_FALLBACK_ENABLED=true` default disables fallback broadening.

### Citation system
- Prompt map built for `P#`, `C#`, `D#` IDs.
- Output citation tokens validated before final answer.
- UI receives normalized citation objects (including legacy fields used by components).

### Failure states (`server/rag/failureStates.js`)
Precedence:
1. `OUT_OF_SCOPE_SOURCE`
2. `BUDGET_EXCEEDED`
3. `CITATION_MISMATCH`
4. `STALE_VOLATILE_SOURCE`
5. `NO_BINDING_AUTHORITY`
6. `INSUFFICIENT_EVIDENCE`
7. `INSUFFICIENT_FACTS`
8. `NONE`

### Analysis date policy (`server/rag/responsePolicy.js`)
Supported request basis:
- `today`
- `explicit_as_of` (`asOf`/`as_of`)
- `application_date` (`applicationDate` / `application_date` / `lockInDate` / `lock_in_date`)

## 7) Audit Trace Runtime (`server/rag/auditTrace.js`)
- Feature flag: `AUDIT_TRACE_ENABLED`.
- Captures phases: `RETRIEVAL`, `ROUTING`, `GROUNDING`, `GENERATION`, `VALIDATION`, `RESPONSE_GUARD`.
- Builds contract-shaped trace payload + runtime validator.
- Optional log persistence via `AUDIT_TRACE_PERSIST_LOG` and sampling.

## 8) Data Persistence Model (`server/db.js`)

### Optional DB mode
- Enabled only when `DATABASE_URL` is set.
- If DB is not configured:
  - history endpoint returns empty sessions,
  - document listing returns empty,
  - text document upload endpoint returns 400,
  - chat still works in stateless mode.

### Tables used by runtime
- `users`
- `sessions`
- `messages` (with `citations` JSONB)
- `documents` (Phase 2)
- `document_chunks` (Phase 2)

### Migration state
- Repo includes migration for documents/chunks only: `server/db/migrations/phase2_documents.sql`.
- Base schema for `users/sessions/messages` is assumed to exist externally.

## 9) PDI Ingestion Endpoint (`server/ingest/pdi/*`)
- Endpoint: `POST /api/ingest/pdi`.
- Accepts `url` or nested `urls[]`; resolves and deduplicates wrappers/tracking params.
- Pipeline:
  1. `fetchPdiHtml()` via `got-scraping`
  2. `parsePdiHtml()` main content extraction + last-updated detection
  3. `extractSectionsFromContainer()` with heading hierarchy and table linearization
  4. `chunkSections()` with overlap and table-boundary protection
  5. `embedChunks()` with retry/backoff
  6. `upsertPineconeVectors()` with batch size + request byte limits + retry/backoff
- Canonical metadata enrichment includes:
  - `authority_level`, `doc_family`, `instrument`, `jurisdiction`
  - optional `effective_date`, `section_id`, `program_stream`, `noc_code`, `teer`, `table_type`

## 10) Python Pipelines and Data Ops

### Scraper (`scripts/scraper`)
- `scrape.py` implements recursive BFS crawl with:
  - strict allowlisting
  - canonical URL dedupe + redirect unwrapping
  - local extraction + Jina fallback
  - resumable state (`_crawl_state.json`)
  - outputs (`manifest.json`, `failed_urls.json`, markdown files)
- Current local corpus directory has 284 markdown files.
- Current manifest (`scripts/scraper/ircc_data_clean/manifest.json`) reports:
  - `saved`: 284
  - `fetch_failed`: 13
  - `scrape_failed`: 3

### Markdown ingestion (`scripts/ingest_md`)
- `ingest_md.py` parses frontmatter, cleans/enriches text, chunks, embeds, upserts.
- Includes canonical legal metadata mapping in `legal_metadata.py`.
- Includes namespace validation utility `validate_namespace.py`.

### PDF ingestion (`scripts/ingest_pdf`)
- `ingest_pdf.py` orchestrates discover -> extract -> normalize -> sectionize -> chunk -> embed -> upsert.
- Supports resumable state and chunk artifact output.
- Canonical legal metadata mapping in `legal_metadata.py`.
- Basic Python tests for normalization and state persistence.

### XML legislation chunking (`scripts/ingest_xml`)
- Parser script: `scripts/ingest_xml/parse_irpr_xml.py`.
- Supported sources in workspace:
  - `data/SOR-2002-227.xml` (IRPR)
  - `data/I-2.5.xml` (IRPA)
- Current generated artifacts:
  - `data/SOR-2002-227_chunks.jsonl` (`3854` rows)
  - `data/I-2.5_chunks.jsonl` (`1533` rows)
- Contract-level behavior of generated records:
  - Canonical `section_id` with no double underscores (citation-safe normalization).
  - `citation_key` for exact lexical/metadata lookup (for example `IRPR_179_b`).
  - Required provenance fields on every chunk: `content_hash`, `canonical_url`, `effective_from`, `effective_to`.
  - Direct-addressable records for each section, subsection, and paragraph, with deeper subparagraph/clause expansion where present.
- Exact-lookup capability validation:
  - Query key `IRPR_179_b` resolves directly to `IRPR s.179(b)` from chunk metadata (no vector similarity path required for this cite form).

## 11) Frontend Runtime Behavior

### App shell and routing
- `App.tsx` handles auth-gated routing and app shell.
- Auth bypass via `VITE_BYPASS_AUTH=true` starts directly in chat.
- Sidebar navigation routes to chat/calculator/cases/settings and local recent sessions.

### State management
- `lib/store.tsx` uses React Context + `useReducer` (not Zustand).
- Persists selected state to `localStorage` key `rcic-app-state`.
- Loads server chat history on startup.

### API client
- `lib/api.ts` adds `x-external-auth-id` and optional `x-user-email` headers.
- Chat retries once on 403 if a stale session ID was supplied.
- Document upload/list calls wired to backend document endpoints.

### Chat UI
- `pages/ChatPage.tsx` supports:
  - sending chat messages,
  - `.txt/.md/.markdown` document upload,
  - citation modal,
  - sources panel,
  - memo export modal open action.
- `components/chat/MessageBubble.tsx` parses inline `[P#]/[C#]/[D#]` citation tokens.
- `components/chat/SourcesPanel.tsx` renders citation cards and highlight sync.

### Frontend surfaces that are mostly mock/demo
- `CasesPage` searches local `MOCK_CASES` data.
- `SettingsPage` is largely static form UI.
- `ExportMemoModal` generates template text client-side; Download button is UI-only.

## 12) Current Design Direction (2026-02-19)

### Legal-unit pipeline redesign (planned)
- New plan doc: `docs/LEGAL_UNIT_PIPELINE_REDESIGN_PLAN.md`.
- Direction is to add a staged pipeline for JSON-element corpora:
  1. structure pass (`node_map`, `children_map`, roots, `parent_chain`, `heading_path`)
  2. normalization pass by type (`norm_text`, `non_embed`, table HTML -> row text)
  3. unitization pass with mode selector (`legislation_mode` vs `policy_mode`)
  4. bilingual split/pair pass (no mixed EN/FR units; legislation pairing by canonical key)
  5. validated legal units -> LlamaIndex `TextNode` conversion
- Legislation-specific constraints in plan:
  - structural parser is primary segmentation authority (not title-merge heuristics),
  - canonical key required for indexable legislation units,
  - required aggregate units (`section`, `subsection`, clause),
  - bilingual pair contract (`bilingual_group_id`, `translation_role`),
  - consolidation snapshot stamping (`consolidation_date`, `last_amended_date`, `source_snapshot_id`).

### Delegation artifact for implementation
- New delegation doc: `LEGAL_UNIT_PIPELINE_MIDLEVEL_DELEGATION.md`.
- Defines bounded implementation scope under a new `pipeline/` package:
  - `schemas.py`, `element_tree.py`, `normalize.py`, `section_parser.py`, `unitize.py`, `bilingual.py`, `emit_artifacts.py`, `nodes.py`
  - required tests + fixtures under `pipeline/tests/*`
- Required Python libs constrained to:
  - `pydantic`, `beautifulsoup4`, `lxml`
  - optional: `ftfy`, `regex`
- Required staged JSONL outputs (stable ordering with `schema_version` and `source_index`):
  - `tmp/elements_structured.jsonl`
  - `tmp/elements_normalized.jsonl`
  - `tmp/legal_units.jsonl`
  - `tmp/legal_unit_errors.jsonl`

### Status note
- These are design/delegation artifacts only at this point.
- No runtime retrieval/composer behavior has been changed yet based on this redesign.
- `ChatPage` includes a `Search Web` button with no bound action.

### Auth integration
- Neon auth client in `lib/neonAuth.ts`.
- Supports email sign-in/sign-up and social sign-in redirects.
- Dev bypass identity stored in localStorage (`rcic-external-auth-id`).

## 13) Build and Tooling
- Frontend dev server: Vite on `3000`, API proxy `/api -> 3001`.
- Backend dev server: `node server/index.js`.
- TypeScript path alias `@/*` configured in `tsconfig.json` and Vite.
- Tailwind is configured via CDN script in `index.html` (no local Tailwind build pipeline).

## 14) Tests and Verified Status (2026-02-17)

### Command outputs verified in this workspace
- `npm run test:server`:
  - Runs only `server/ingest/pdi/__tests__/*.test.js`.
  - Result: 7/7 passing.
- Additional tests executed directly:
  - `node --test server/rag/__tests__/auditTrace.test.js` (pass)
  - `node --test server/rag/__tests__/failureStates.test.js` (pass)
  - `node --test server/rag/__tests__/responsePolicy.test.js` (pass)
  - `node --test server/__tests__/debugPayload.test.js` (pass)

### Test inventory (excluding `node_modules`)
- JS tests: 13 files
  - `config/__tests__/sourcePolicy.test.js`
  - `eval/__tests__/failureStateMatrix.test.js`
  - `server/__tests__/debugPayload.test.js`
  - `server/ingest/pdi/__tests__/*.test.js` (7 files)
  - `server/rag/__tests__/*.test.js` (3 files)
- Python tests:
  - `scripts/scraper/tests/test_url_utils.py`
  - `scripts/ingest_pdf/__tests__/test_normalize.py`
  - `scripts/ingest_pdf/__tests__/test_state.py`

## 15) Contracts, Policy, and Eval Assets

### Contracts (`contracts/v1`)
- Schemas and examples are present for metadata, evidence bundle, claim ledger, validation result, and audit run trace.
- `contracts/v1/validate.js` is a lightweight custom validator (required fields/enums/pattern checks), not a full JSON Schema engine.

### Source policy (`config/source_policy.v1.json`)
- Host/path allow/block policy exists with doc-family allow map and temporal metadata policy.
- Runtime helper available in `config/sourcePolicy.js` with tests.

### Eval (`eval/run_eval.js`)
- Harness exists and loads gold set template (64 lines currently).
- Current implementation is stub-style evaluation with synthetic retrieval/validator behavior and writes reports to `eval/reports/`.

## 16) Key Environment Variables

### Core runtime
- `GROQ_API_KEY`, `GROQ_MODEL`, `ROUTER_MODEL`
- `PINECONE_API_KEY`, `PINECONE_INDEX_HOST`, `PINECONE_NAMESPACE`
- `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_BASE_URL`, `EMBEDDING_DIM`
- `DATABASE_URL`

### Retrieval/routing controls
- `RETRIEVAL_TOP_K`
- `RAG_TIERED_RETRIEVAL_ENABLED`
- `RAG_TOP_K_BINDING`, `RAG_TOP_K_GUIDANCE`
- `RAG_NO_SILENT_FALLBACK_ENABLED`

### A2AJ
- `A2AJ_ENABLED`, `A2AJ_CASELAW_ENABLED`, `A2AJ_LEGISLATION_ENABLED`
- `A2AJ_API_BASE`, `A2AJ_API_KEY`, `A2AJ_TIMEOUT_MS`, `A2AJ_TOP_K`
- `A2AJ_FETCH_DETAILS_TOP_K`, `A2AJ_DECISION_SNIPPET_CHARS`
- `A2AJ_DECISIONS_SEARCH_PATH`, `A2AJ_DECISIONS_SEARCH_METHOD`

### Audit/failure/debug
- `DEBUG_MODE`
- `PROMPT_INJECTION_BLOCK_ENABLED`
- `AUDIT_TRACE_ENABLED`, `AUDIT_TRACE_INCLUDE_REDACTED_PROMPT`, `AUDIT_TRACE_PERSIST_LOG`, `AUDIT_TRACE_SAMPLE_RATE`
- `RAG_MAX_TOOL_CALLS`, `RAG_MAX_LIVE_FETCHES`, `RAG_MAX_RETRIES`

### PDI ingest tuning
- `PDI_CHUNK_*`, `PDI_TABLE_BOUNDARY_BUFFER_CHARS`
- `PDI_EMBED_*`
- `PDI_UPSERT_*`

### Frontend auth
- `VITE_NEON_AUTH_URL`
- `VITE_NEON_AUTH_CALLBACK_URL`
- `VITE_BYPASS_AUTH`

## 17) Known Gaps / Mismatches to Keep in Mind
- `test:server` does not include all server tests by default; it is currently scoped to PDI tests.
- Some docs/runbooks reference broader validation pipelines than what default npm scripts enforce.
- `POST /api/ingest` is not implemented.
- Legacy MCP client (`server/clients/mcp.js`) remains in repo but chat runtime uses A2AJ REST path.
- `pineconeUpsert()` in `server/clients/pinecone.js` is a stub and not the ingestion upsert path.
- Governance schemas/policies and runtime metadata conventions are not fully harmonized yet (contracts use different enum conventions than ingestion/runtime metadata fields).

## 18) Workspace Notes
- Current git working tree includes an unrelated modified file: `package-lock.json`.

## 19) Planned Agentic Graph Constraints (Design Decisions, Not Yet Runtime-Enforced)
- Authoritative plan document: `AGENTIC_GRAPH_RAG_REFACTOR_PLAN.md`.
- Runtime stays on single entrypoint: `POST /api/chat` (internal execution moves to graph-run).

### Evidence metadata contract additions
- Add `scope` with enum:
  - `selection | admissibility | status_grant | procedure | enforcement | citizenship`
- Add `applies_stage` with enum:
  - `provincial_selection | federal_processing | border | appeal | court`
- Validator rules should reject evidence records missing these fields or containing out-of-enum values.

### Cite-first retrieval behavior
- For canonical cite queries (for example `IRPR 179(b)`), run metadata/lexical exact lookup before Pinecone vector retrieval.
- If parsed cite has no Tier A section match, return explicit failure state `CITATION_NOT_FOUND`.

### Verifier hard constraints
- If a claim touches `admissibility` or `status_grant`, require at least one federal binding evidence item.
- Provincial evidence may only support `selection` or `procedure` claims.
- Evidence tagged `applies_stage=provincial_selection` cannot support federal admissibility/status-grant claims.
- Binding-claim validation should require quote support (claim support quote must be present in referenced evidence content).

### Planned minimal graph edges (Postgres acceptable at phase 0/1)
- `SUBORDINATE_TO` (provincial -> federal)
- `GATES` (inadmissibility rules gating programs/rules)
- `APPLIES_AT_STAGE` (rule -> lifecycle stage)
