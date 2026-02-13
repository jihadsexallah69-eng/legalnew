# Phase 0 S3 Audit Trace Wiring Plan

Last updated: 2026-02-13  
Owner: Senior Engineer  
Status: Started

## Goal
Define exactly how to emit and persist `AuditRunTrace` records for `/api/chat` without destabilizing runtime behavior.

## Scope (Phase 0)
In scope:
- runtime insertion points for trace capture
- payload shape mapping to `contracts/v1/auditRunTrace.schema.json`
- redaction defaults
- persistence strategy (feature-flagged)
- deterministic acceptance tests

Out of scope:
- full legal semantic verification
- production retention enforcement implementation
- tenant-level access control implementation

## Runtime Insertion Points
Primary flow: `server/index.js` `POST /api/chat`.

Capture points:
1. `run_start`
- after request validation and session resolution.
- capture: `run_id`, `session_id`, request metadata, `as_of` mode basis.

2. `input_safety`
- after prompt injection and RCIC scope checks.
- capture: safety flags, sanitized-input hash.

3. `retrieval_complete`
- after `retrieveGrounding(...)` and `routeIntent(...)`.
- capture: tier filters, counts, top source IDs, routing decision.

4. `live_fetch_complete` (conditional)
- after A2AJ/case-law enrichment and any volatile live-fetch steps.
- capture: fetched URLs, `retrieved_at`, `content_hash`, allowlist decision.

5. `prompt_built`
- after `buildPrompt(...)` and before `groqAnswer(...)`.
- capture: prompt hashes, prompt versions, model/version metadata.

6. `validation_complete`
- after `validateCitationTokens(...)` and `enforceAuthorityGuard(...)`.
- capture: citation IDs, guard issues, failure-state decisions.

7. `run_end`
- before response emit and in error handler.
- capture: output hash, status, error code (if any), duration.

## Trace Payload Contract (Target)
Top-level fields:
- `run_id`
- `schema_version` (`v1.0.0`)
- `created_at`
- `status` (`ok` | `error`)
- `analysis_date_basis` (`today` | `application_date` | `explicit_as_of`)

Core blocks:
- `inputs`
  - `message_hash`
  - `session_id`
  - optional `redacted_message`
- `plan`
  - `route_decision`
  - `budgets` (`max_tool_calls`, `max_live_fetches`, `max_retries`)
- `retrieval`
  - tier filters, counts, source IDs/scores
- `live_fetches`
  - `canonical_url`, `retrieved_at`, `content_hash`, `allowlist_result`
- `validation`
  - `guard_issues`
  - `failure_state` (nullable)
  - `citation_ids`
- `outputs`
  - `response_hash`
  - `citation_count`
- `meta`
  - `model_version`
  - `prompt_version`
  - `policy_version`

## Redaction Defaults (Phase 0)
Default storage:
- hashes and metadata only
- no raw uploaded file bytes
- no full prompt text by default

Allowed optional fields (feature flagged):
- `redacted_message` (masked entities)
- short citation excerpts only

Hard rules:
- never store secrets or auth tokens
- do not persist raw PII unless explicit policy toggle is enabled

## Persistence Strategy
Primary:
- include trace summary in existing debug object when `DEBUG_MODE=true`

Optional persistence (feature flag):
- database table `audit_run_traces` (new migration in later phase)
- columns:
  - `run_id` (PK)
  - `session_id`
  - `user_id` (nullable in stateless mode)
  - `status`
  - `created_at`
  - `trace_json` (JSONB)

Fallback:
- structured log sink (JSON line) for non-DB environments

## Feature Flags
- `AUDIT_TRACE_ENABLED` (default `false`)
- `AUDIT_TRACE_INCLUDE_REDACTED_PROMPT` (default `false`)
- `AUDIT_TRACE_PERSIST_DB` (default `false`)
- `AUDIT_TRACE_PERSIST_LOG` (default `true` when enabled)
- `AUDIT_TRACE_SAMPLE_RATE` (default `1.0` in dev, lower in prod)

## Implementation Steps
S3.1:
- create trace builder utility (`server/rag/auditTrace.js`) with:
  - `startTrace(...)`
  - `appendTraceEvent(...)`
  - `finalizeTrace(...)`
  - `redactTrace(...)`

S3.2:
- wire events into `/api/chat` flow at insertion points above.
- keep behavior non-blocking: trace failures must not fail user response.

S3.3:
- add response debug hook:
  - `debug.auditTrace` summary (when debug enabled)

S3.4:
- add tests:
  - trace emitted on success
  - trace emitted on guarded/failure response
  - trace emitted on exception path
  - redaction assertions (no raw prompt/PII fields)

## Acceptance Criteria
- every `/api/chat` request produces deterministic trace object when flag is enabled.
- trace validates against `auditRunTrace` schema.
- failures include explicit failure-state code where applicable.
- redaction defaults verified in tests.
- no measurable regression in chat endpoint success path when tracing disabled.

## Dependencies
Required before full enforcement:
- J1 contracts (`auditRunTrace` schema + example)
- J2 source policy config for `allowlist_result` classification
- J4 CI contract validation hooks

## Open Decisions
- final persistence location in Phase 0 (`debug-only` vs `DB+debug`)
- retention duration for persisted traces in non-production environments
- whether `run_id` is generated in API layer or shared middleware once middleware is introduced
