# Phase 0 Parallel Execution Delegation

Last updated: 2026-02-13  
Scope window: Phase 0 only (contract freeze + control-plane foundations)

## Objective
Ship a strict, testable Phase 0 baseline without touching high-risk runtime behavior prematurely.

This plan is split so work can run in parallel with minimal merge conflicts:
- Junior Engineer: schema/config/eval scaffolding (high precision, low runtime risk)
- Senior Engineer: execution-policy integration and validator/failure-state wiring

## Delegation Policy (Junior-First)
- Default assignment rule: any task that is deterministic, spec-driven, and reversible goes to junior.
- Senior only handles architecture-critical, cross-cutting, or high-blast-radius changes.
- Target allocation for Phase 0:
  - Junior: 75-85% of total implementation work
  - Senior: 15-25% (complex control-plane and risk-critical decisions)

Complexity rubric:
- `L0/L1` (straightforward): junior by default
- `L2` (moderate, bounded): junior with senior review
- `L3/L4` (complex, architectural, high risk): senior owner

Examples junior-owned by policy:
- schema authoring
- JSON examples
- config files
- validation/eval scaffolding
- CI plumbing
- deterministic unit tests
- docs/runbooks

Examples senior-only by policy:
- failure-state semantics and runtime behavior
- orchestration node ordering and retry budgets
- validator hard-gate logic and claim-modality enforcement
- temporal conflict resolution policy when legal ambiguity exists
- final sign-off on audit trace contracts

## Hard Boundaries
In scope:
- versioned contracts and examples
- machine-readable source policy
- retrieval policy spec and failure-state matrix
- evaluation harness scaffolding + CI entrypoint
- audit run-trace contract

Out of scope:
- model swaps
- deep crawler expansion
- full LangGraph rollout
- production PII compliance rollout (policy definition only in Phase 0)
- broad frontend changes

Phase 0 guardrail:
- Junior PRs must not modify `server/**` runtime behavior.
- Exception: adding tests or loading config behind a feature flag with explicit senior approval.

## Parallel Ownership Map
Junior owns:
- `contracts/v1/**`
- `config/source_policy.v1.json`
- `eval/**` (scaffold + starter gold set + runner)
- `docs/phase0_contracts.md`
- `docs/phase0_testplan.md`
- `docs/phase0_runbook.md`
- CI wiring for eval/report artifacts

Senior owns:
- `docs/RCIC_AGENTIC_RESEARCH_ROADMAP.md` (policy finalization)
- runtime failure-state enforcement plan + integration tickets
- validator gate behavior definitions and response templates
- audit trace emission contract wiring plan

Shared (review only, no concurrent edits):
- `docs/PHASE0_PARALLEL_EXECUTION_DELEGATION.md`

## Junior Tracks (Precise Directions)

### Track J1: Contract Pack (Schemas + Examples)
Goal:
- create versioned, machine-validated contracts used by all later phases.

Deliverables:
- `contracts/v1/INDEX.md` (single source of truth for v1 contracts)
- `contracts/v1/metadata.schema.json`
- `contracts/v1/evidenceBundle.schema.json`
- `contracts/v1/claimLedger.schema.json`
- `contracts/v1/validationResult.schema.json`
- `contracts/v1/auditRunTrace.schema.json`
- `contracts/v1/examples/*.json` (1-2 canonical examples per schema)

Required fields to include:
- canonical identifiers:
  - `doc_id = sha256(canonical_url)` (64 hex chars)
  - `content_hash = sha256(content)` (64 hex chars)
  - `content_hash_prefix = first 12 hex chars of content_hash`
  - `artifact_id = doc_id + ":" + content_hash_prefix`
  - `chunk_id = artifact_id + ":" + chunk_index`
  - `run_id = ulid()` (26 chars)
- temporal fields:
  - required always:
    - `observed_at`, `ingested_at`, `retrieved_at`
  - optional:
    - `published_at`, `effective_from`, `effective_to`
  - required-if (best effort):
    - if `doc_family` in `{MI, PUBLIC_POLICY, OINP, BC_PNP, AAIP}` require `effective_from`; `effective_to` nullable
- claim validation fields:
  - `modality`, `assertion_type`, `source_id`, `source_hash`, `canonical_url`, `quote_span`, `quote_text`, `in_force_check`

Constraints:
- do not add runtime logic in this track.
- schema version stays `v1`; breaking changes require review before merge.
- `contracts/v1/INDEX.md` must include:
  - version string `v1.0.0`
  - schema filenames
  - required field list per schema
  - example filenames

Acceptance:
- all examples validate against schemas in CI.
- schema lints pass.

---

### Track J2: Source Policy (Allowlist/Blocklist as Code)
Goal:
- eliminate policy ambiguity by encoding scope controls as machine-readable config.

Deliverables:
- `config/source_policy.v1.json` containing:
  - `allowed_hosts[]`
  - `allowed_host_paths{ host: [prefixes...] }`
  - `blocked_hosts[]`
  - `blocked_path_prefixes[]`
  - `doc_family_allow_map`
  - `max_live_fetches_by_doc_family`
- tests:
  - one in-scope URL accepted
  - one blocked host rejected
  - one blocked path rejected

Constraints:
- no direct edits to crawler runtime in this track.
- keep config declarative and environment-agnostic.

Acceptance:
- deterministic pass/fail tests for scope policy.

---

### Track J3: Eval Harness Scaffold (Retrieval + Validator Gates)
Goal:
- ship CI-runnable evaluation scaffold before full model orchestration.

Deliverables:
- `eval/gold/gold_set_template.jsonl` with fields:
  - `query`, `as_of`, `expected_doc_families`, `must_cite_authority_levels`, `must_not_cite_doc_families`, `expected_failure_state`
- `eval/run_eval.(js|ts|py)` runner with:
  - retrieval-only checks
  - validator checks on stubbed response payload
- CI hook to execute eval runner and publish report artifact.

Constraints:
- runner must be deterministic and runnable without live model dependency.
- keep starter gold set small (10-15) but structurally complete.
- validator scope in Phase 0:
  - include:
    - schema conformance checks
    - authority/modality compatibility checks
    - allowlist/out-of-scope checks
    - `binding` claim requires binding authority source (stub payload check)
  - exclude:
    - LLM semantic quote verification (Phase 1+)

Acceptance:
- CI produces pass/fail report artifact.
- at least one failure-state test case per enum scaffolded.

---

### Track J4: CI + Validation Tooling
Goal:
- make Phase 0 contracts/eval enforceable in CI with minimal manual review.

Deliverables:
- schema validation script (`contracts/v1/examples` against schemas)
- CI job to run:
  - schema validation
  - scope-policy tests
  - eval harness
- machine-readable report artifact (json/markdown)

Constraints:
- avoid touching runtime retrieval/orchestration code.

Acceptance:
- CI fails when any schema/example mismatch occurs.
- CI publishes an eval report artifact on every run.

---

### Track J5: Failure-State Test Matrix (Non-runtime)
Goal:
- provide deterministic test vectors for every failure state before runtime wiring.

Deliverables:
- `eval/failure_state_matrix.json`
- stubbed validator tests for:
  - `NO_BINDING_AUTHORITY`
  - `STALE_VOLATILE_SOURCE`
  - `CITATION_MISMATCH`
  - `OUT_OF_SCOPE_SOURCE`
  - `BUDGET_EXCEEDED`
  - `INSUFFICIENT_FACTS`
  - `INSUFFICIENT_EVIDENCE`

Constraints:
- no production endpoint behavior changes.
- no runtime quote-semantic checks in Phase 0 test matrix.

Acceptance:
- one deterministic pass/fail test per failure-state code.

---

### Track J6: Documentation + Runbooks
Goal:
- eliminate implementation ambiguity and improve handoff velocity.

Deliverables:
- `docs/phase0_contracts.md` (schema guide + examples index)
- `docs/phase0_testplan.md` (what CI validates and how to interpret failures)
- `docs/phase0_runbook.md` (local execution commands + expected outputs)

Constraints:
- docs only; no policy redefinition.

Acceptance:
- reviewer can execute all Phase 0 checks with runbook only.

---

### Track J7: Seed Gold Set Expansion
Goal:
- increase junior workload on high-value but bounded eval data work.

Deliverables:
- expand starter gold set from 10-15 to 30-40 curated entries
- include at least:
  - TRV/study/work/EE basics
  - hierarchy edge cases (policy vs law)
  - temporal cases (`as_of` required)
  - expected failure-state cases

Constraints:
- no model tuning; dataset and assertions only.
- no answer-correctness grading in Phase 0.

Acceptance:
- gold set passes schema and eval runner format checks.
- each major intent family has coverage.
- minimum assertions in Phase 0:
  - URL scope decision correctness
  - expected `failure_state` enum correctness
  - expected `doc_family` allow/disallow correctness (stub retrieval outputs)

## Senior Tracks (Parallel)

### Track S1: Execution-Control Spec Finalization
- finalize failure-state behavior matrix:
  - `NO_BINDING_AUTHORITY`, `STALE_VOLATILE_SOURCE`, `CITATION_MISMATCH`, `OUT_OF_SCOPE_SOURCE`, `BUDGET_EXCEEDED`, `INSUFFICIENT_FACTS`, `INSUFFICIENT_EVIDENCE`
- define for each:
  - user-facing message contract
  - retry policy
  - required audit fields

### Track S2: Retrieval/Temporal Policy Integration Plan
- finalize Tier A/B/C quotas and no-silent-fallback behavior.
- lock `as_of` switching logic:
  - default `today`
  - auto-switch to application/lock-in date when present
  - output header requirement: `Analysis date basis: YYYY-MM-DD`

### Track S3: Audit Trace Contract Wiring Plan
- define required runtime trace payload shape and insertion points.
- define redaction defaults for audit package persistence.

### Track S4: Final Arbitration + Sign-Off
- resolve cross-track conflicts (schema vs runtime feasibility).
- approve or reject any junior request that changes core policy semantics.
- own final Phase 0 release readiness decision.

## Merge Order (to avoid conflicts)
1. J1 (contracts) merges first.
2. J2 (source policy) merges second.
3. J4 (CI + validation tooling) merges third.
4. J3 (eval scaffold) merges fourth.
5. J5 (failure-state matrix tests) merges fifth.
6. J6 (docs/runbooks) merges sixth.
7. J7 (gold set expansion) merges seventh.
8. Senior tracks merge after J1/J2/J4 baseline is available.

## Handoff Checklist (Junior PR)
- PR scope references exactly one track (`J1`-`J7`).
- Includes test evidence and command output summary.
- Includes sample payloads demonstrating contract conformance.
- Lists explicit non-goals not touched.

Daily status template (copy/paste):
- Track:
- PR:
- Tests:
- Blocked by:
- Next:

## Commands (minimum)
```bash
npm run test:server
```

If eval runner is Node-based:
```bash
node eval/run_eval.js
```

If eval runner is Python-based:
```bash
python eval/run_eval.py
```

## Phase 0 Exit Criteria (Measurable)
- Contracts versioned and reviewed.
- Schema validation passes for all examples.
- Source allowlist tests pass.
- Retrieval policy tests include `NO_BINDING_AUTHORITY`.
- Audit run trace example validates against schema.
- Eval harness runs in CI and publishes report artifact.
- At least 75% of Phase 0 implementation tickets completed by junior-owned tracks.
