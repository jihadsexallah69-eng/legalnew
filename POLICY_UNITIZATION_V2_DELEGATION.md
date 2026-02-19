# Delegation: Policy Unitization V2 (Mid-Level Engineer)

Last updated: 2026-02-19
Owner: Mid-Level Engineer
Reviewer: Senior Engineer

## Goal
Upgrade `policy_mode` unitization so legal-policy chunks are structurally coherent, retrieval-safe, and compatible with statute-first legal RAG behavior.

## Why This Work Is Required
- Current policy chunks fragment bullet lists and lead-in stubs.
- `heading_path` often degrades to `["Document"]`, losing retrieval signal.
- Scope noise (glossary/links/toc) can pollute default legal retrieval.
- Missing numeric authority causes fragile filtering/ranking behavior.

## Hard Requirements (Must Implement)
1. Add `authority_level_num` to `LegalUnit` while keeping human-readable `authority_level`.
2. Add `non_embed` to `LegalUnit`.
3. Fix heading propagation:
- primary from `Title`
- fallback heading detection with regex when title tags are missing
- no fake `"Document"` fallback; use `heading_path=[]`.
4. Add deterministic token estimate and document formula:
- `estimated_tokens = ceil(len(text) / 4)`.
5. Add policy merge engine for bullets/stubs/continuations with strict stop rules.
6. Add `unit_type` and `scope` tagging for retrieval-safe filtering.
7. Add policy cross-reference extraction (`A63(5)`, `R200(1)(b)`, `IRPR 200(1)(b)`, `IRPA s.63(5)`, `s.63(5)` with inference).

## Scope Boundaries
In scope:
- `pipeline/schemas.py`
- `pipeline/element_tree.py`
- `pipeline/normalize.py`
- `pipeline/unitize.py`
- `pipeline/emit_artifacts.py`
- `pipeline/nodes.py`
- new helper modules if needed (`pipeline/policy_signals.py`, `pipeline/references.py`)
- retrieval scope filtering in `server/rag/grounding.js`
- related tests and snapshots

Out of scope:
- embedding model changes
- Pinecone schema migration outside metadata fields above
- full graph DB implementation
- french legal reference parser (`art.`) beyond basic placeholders

## Data Contract Changes
Update `LegalUnit` with:
- `authority_level` (string, keep existing)
- `authority_level_num` (int)
- `non_embed` (bool, default `false`)
- `unit_type` (`policy_rule | glossary | directory | toc | outline | table`)
- `scope` (`default | glossary | links | toc`)
- `cross_references` (`list[str]`, canonical keys)

Backward compatibility rules:
- If `scope` missing in older records, treat as `default`.
- If `unit_type` missing in older records, treat as `policy_rule`.
- If `authority_level_num` missing, derive from `authority_level`.

## Policy Merge Rules
Merge only when:
- same `heading_path`
- same language
- one trigger exists:
- lead-in stub (`:` or phrases like `the following`, `includes`, `take into account these factors`)
- bullet/list continuation (`•`, `-`, `*`, `1.`, `a)`, `(a)`)
- next starts lowercase continuation or sentence fragment

Stop merge when:
- heading changes
- numbered heading detected with strict regex: `^(?:\d+)(?:\.\d+){1,}\s+\S+`
- language changes
- hard page gap (`>1`) without continuation marker
- cap reached (`max_paragraphs`, `max_tokens`)

Caps:
- `max_paragraphs`: default `8`
- `max_tokens`: default `900` using deterministic estimate formula above

Important:
- Merge on pre-render block text data.
- Render `display_text` once after merge finalization.

## Heading Propagation Rules
- Use `Title` nodes as primary heading signal.
- If heading tags are missing, infer heading from text pattern:
- `^(?:\d+)(?:\.\d+){1,}\s+\S+`
- Persist `heading_path` through normalization and unitization.
- `heading_path` must contain real headings or be empty (`[]`), never fake placeholders.

## Scope Tagging Rules
Classify policy units:
- glossary/acronym tables -> `unit_type=glossary`, `scope=glossary`
- useful links/resources/wiki -> `unit_type=directory`, `scope=links`
- table of contents/outline -> `unit_type=toc|outline`, `scope=toc`
- ordinary guidance/rules -> `unit_type=policy_rule`, `scope=default`
- table content that is legal guidance -> `unit_type=table`, `scope=default`

Default retrieval behavior:
- include `scope=default` plus records missing scope (legacy)

Intent overrides:
- acronym/definition intent -> include `scope=glossary`
- navigation/resources intent -> include `scope=links`
- section list/toc intent -> include `scope=toc`

## Cross-Reference Extraction
Extract canonical refs from policy chunks:
- `A63(5)` -> `IRPA:63(5)`
- `R200(1)(b)` -> `IRPR:200(1)(b)`
- `IRPR 200(1)(b)` -> `IRPR:200(1)(b)`
- `IRPA s.63(5)` -> `IRPA:63(5)`
- `s.63(5)` -> infer instrument from local heading/context when possible

Store in:
- `LegalUnit.cross_references`

Optional artifact:
- `reference_edges.jsonl` with `from_unit_id`, `to_canonical_key`.

## Checkpoint Plan and Task Boundaries

### Checkpoint 1: Contract and Serialization
Files:
- `pipeline/schemas.py`
- `pipeline/emit_artifacts.py`
- `pipeline/nodes.py`

Deliverables:
- add new fields and defaults
- serializer and node metadata parity
- tests for schema validation and backward compatibility

Boundary:
- No merge logic changes in this checkpoint.

### Checkpoint 2: Heading Path Fix
Files:
- `pipeline/element_tree.py`
- `pipeline/unitize.py`

Deliverables:
- `Title`-first heading propagation
- regex fallback heading detection
- remove `"Document"` fallback
- tests proving realistic heading paths

Boundary:
- Do not implement scope tagging yet.

### Checkpoint 3: Merge Engine
Files:
- `pipeline/unitize.py`
- optional `pipeline/policy_signals.py`

Deliverables:
- lead-in stub merge
- bullet aggregation mode
- strict stop rules + deterministic caps
- tests for fragmentation cases and cap behavior

Boundary:
- Do not wire retrieval filters yet.

### Checkpoint 4: Scope and Unit Typing
Files:
- `pipeline/unitize.py`

Deliverables:
- classify `unit_type` and `scope`
- set `non_embed` at unit level
- tests for glossary/links/toc routing behavior

Boundary:
- Keep parser and merge behavior stable.

### Checkpoint 5: Cross-References
Files:
- `pipeline/references.py` (new)
- `pipeline/unitize.py`

Deliverables:
- regex extraction + canonicalization
- attach `cross_references` to units
- tests for all required patterns

Boundary:
- No server retrieval changes in this checkpoint.

### Checkpoint 6: Retrieval Filter Integration
Files:
- `server/rag/grounding.js`
- retrieval tests

Deliverables:
- default policy retrieval includes `scope=default` or missing scope
- intent-based overrides for glossary/links/toc
- regression tests for filtering behavior

Boundary:
- No prompt/composer logic changes.

### Checkpoint 7: Snapshot and Full Validation
Files:
- `pipeline/tests/test_golden_snapshot.py`
- `pipeline/tests/fixtures/golden_legal_units.snapshot.jsonl`

Deliverables:
- regenerate snapshot intentionally
- record schema/behavior diffs
- full test run pass

## Test Requirements
Add/extend tests for:
- heading fallback detection without `Title` tags
- lead-in stub merge
- bullet continuation merge
- lowercase continuation merge
- strict stop at numbered heading regex
- deterministic token cap splitting
- scope tagging classification
- cross-reference extraction patterns
- backward compatibility defaults
- glossary exclusion by default for statute-like retrieval query

## Commands
Pipeline tests:
```bash
python3 -m pytest -q pipeline/tests
```

Targeted server retrieval tests:
```bash
node --test server/rag/__tests__/*.test.js
node --test server/rag/graph/__tests__/*.test.js
```

## Handoff Requirements
- PR per checkpoint or logically grouped checkpoints.
- For each PR:
- files changed
- behavior changes
- tests added/updated
- known risks
- before/after example units (at least 3 examples)

Include one short migration note:
- how old records without `scope`, `unit_type`, or `authority_level_num` are handled.

## Escalation Rules
Stop and ask reviewer before proceeding if:
- merge rules collapse distinct headings unexpectedly
- heading regex creates high false positives
- retrieval filter breaks legacy records without scope
- snapshot drift exceeds intended schema/merge changes
