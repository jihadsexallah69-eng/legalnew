# Delegation: Legal Unit Pipeline (Mid-Level Engineer)

Last updated: 2026-02-19  
Owner: Mid-Level Engineer  
Reviewer: Senior Engineer

## Goal
Implement a staged legal ingestion pipeline that converts JSON elements into validated legal units for LlamaIndex `TextNode` emission, with strict legislation handling, bilingual symmetry, and auditable artifacts.

## Required Libraries

Use only these libraries unless reviewer approves an exception:

- `pydantic`
- `beautifulsoup4`
- `lxml`

Optional (nice to have, not required):

- `ftfy`
- `regex`

Language ID:

- Start with deterministic EN/FR heuristics.
- Add `langdetect` later only if heuristics are insufficient.

## Folder Layout (Implement Exactly)

```text
pipeline/
  schemas.py
  element_tree.py
  normalize.py
  section_parser.py
  unitize.py
  bilingual.py
  emit_artifacts.py
  nodes.py
  tests/
    test_tree.py
    test_normalize.py
    test_section_parser.py
    test_unitize_legislation.py
    test_unitize_policy.py
    fixtures/
      enf_sample.json
      irpa_irpr_sample.json
```

## Scope Boundaries

In scope:

- Schema validation with fail-fast behavior at each stage.
- Structure pass, normalization pass, unitization pass, bilingual split/pair pass.
- JSONL artifact emission with stable ordering.
- LlamaIndex node conversion from validated legal units.
- Unit tests for all core modules.

Out of scope:

- Runtime retrieval/composer changes in `server/rag/*`.
- Graph DB implementation.
- Embedding provider/model changes.
- Non-JSON corpus onboarding.

## Stage Contracts

All stage outputs must include:

- `schema_version`
- `source_index` (original array index; primary ordering key)

### 1) `RawElement` (`pipeline/schemas.py`)

Purpose:

- Validate input shape and required presence/types.

Minimum fields:

- `element_id`
- `type`
- `text` (nullable only when table content exists via HTML)
- `metadata` (object; can be empty)

### 2) `StructuredElement`

Add fields:

- `root_id`
- `source_index`
- `parent_chain` (list of parent ids)
- `heading_path` (list of title texts)

### 3) `NormalizedElement`

Add fields:

- `norm_text`
- `non_embed`
- `flags` (list)
- `metadata_candidates` (object)

### 4) `LegalUnit` (quality gate)

Must fail validation if required fields are missing.

Minimum required:

- `unit_id`
- `canonical_key`
- `embed_text`
- `display_text`
- `language`
- `authority_level`
- `instrument`
- `doc_type`
- `filename`
- `page_start`
- `page_end`
- `element_ids`
- `heading_path`

Legislation-required fields:

- `bilingual_group_id`
- `translation_role` (`primary` or `parallel`)
- `consolidation_date`
- `last_amended_date`
- `source_snapshot_id`

## Module Interfaces (Do Not Change Without Review)

`pipeline/element_tree.py`

```python
def build_tree(raw: list[RawElement]) -> list[StructuredElement]:
    ...
```

`pipeline/normalize.py`

```python
def normalize_elements(structured: list[StructuredElement]) -> list[NormalizedElement]:
    ...
```

`pipeline/section_parser.py`

```python
class LegislationParser:
    def feed(self, el: NormalizedElement) -> list[ParsedClause]:
        ...
```

`pipeline/unitize.py`

```python
def build_units(elements: list[NormalizedElement], mode: str) -> list[LegalUnit]:
    ...
```

`pipeline/bilingual.py`

```python
def split_and_pair_units(units: list[LegalUnit]) -> list[LegalUnit]:
    ...
```

`pipeline/nodes.py`

```python
def units_to_nodes(units: list[LegalUnit]) -> list[TextNode]:
    ...
```

## Mode Selector (Pure Function)

Implement:

```python
def select_mode(filename: str, instrument_hint: str | None) -> str:
    ...
```

Rules:

- `legislation_mode` for IRPA/IRPR corpus.
- `policy_mode` for ENF/PDI/manual family.
- Stamp `instrument` early; use `UNKNOWN` if unresolved.

## Implementation Requirements by Pass

### Structure pass (`pipeline/element_tree.py`)

- Build:
  - `node_map[element_id] = element`
  - `children_map[parent_id] = list[child]`
  - `roots = no parent_id or missing parent`
- Compute `parent_chain` and `heading_path` for every element.
- Deterministic order uses `source_index` as primary key.
- Handle cycles with guard and explicit error artifact.

### Clean pass (`pipeline/normalize.py`)

- `Title`/`NarrativeText`/`ListItem`: whitespace and OCR cleanup.
- `Table`: parse `text_as_html` to row text via BeautifulSoup + lxml parser.
- `Footer`/page/date lines: set `non_embed=true`; keep metadata candidates.
- Preserve raw table HTML as trace metadata (`raw_table_html`).

### Section parser (`pipeline/section_parser.py`)

- Build and test before full unitizer integration.
- Parser state tracks section/subsection/paragraph/subparagraph.
- Canonical key must be emitted for legislation clause units.
- If canonical parse fails, emit parse-error artifact and skip indexable unit output.

### Unitization pass (`pipeline/unitize.py`)

Legislation mode:

- Emit clause units (`IRPA:34(1)(c)` granularity).
- Emit required aggregates (`IRPA:34(1)`, `IRPA:34`).
- Do not rely only on title merging.

Policy mode:

- Unit = title context + 1 to 3 paragraphs.
- Tables standalone (or row groups for large tables).

All modes:

- Produce `embed_text` (minimal retrieval text).
- Produce `display_text` (richer render text).

### Bilingual pass (`pipeline/bilingual.py`)

Hard rule:

- Never mix EN/FR in one unit.

Legislation pairing:

- Same `canonical_key`
- Same `bilingual_group_id` (equal to canonical key)
- Different `language`
- Translation role stamped (`primary` or `parallel`)

Initial EN/FR heuristics may use:

- French stopwords and legal tokens (`article`, `partie`, `loi`, `a jour`)
- accented-character ratio

## Artifact Emission (`pipeline/emit_artifacts.py`)

Write JSONL in stable order:

- `tmp/elements_structured.jsonl`
- `tmp/elements_normalized.jsonl`
- `tmp/legal_units.jsonl`
- `tmp/legal_unit_errors.jsonl` (required for validation and parser failures)

Each line must include:

- `schema_version`
- `source_index`
- `filename`
- deterministic `id` field

## Task Boundaries and Ownership

Boundary A: Schemas + validation

- Files: `pipeline/schemas.py`
- Done when: all stage objects validate; bad payloads fail fast.

Boundary B: Tree builder

- Files: `pipeline/element_tree.py`, `pipeline/tests/test_tree.py`
- Done when: parent chains and heading paths computed for all fixture elements.

Boundary C: Normalization

- Files: `pipeline/normalize.py`, `pipeline/tests/test_normalize.py`
- Done when: tables normalize deterministically; footer/date elements marked `non_embed=true`.

Boundary D: Legislation parser core

- Files: `pipeline/section_parser.py`, `pipeline/tests/test_section_parser.py`
- Done when: parser fixtures pass for section/subsection/paragraph extraction and canonical key output.

Boundary E: Unitization

- Files: `pipeline/unitize.py`, `pipeline/tests/test_unitize_legislation.py`, `pipeline/tests/test_unitize_policy.py`
- Done when: legislation and policy mode outputs match expected unit boundaries.

Boundary F: Bilingual split/pair

- Files: `pipeline/bilingual.py`
- Done when: legislation units are paired by canonical key with no mixed-language units.

Boundary G: Artifacts + nodes

- Files: `pipeline/emit_artifacts.py`, `pipeline/nodes.py`
- Done when: JSONL artifacts are stable and `LegalUnit -> TextNode` conversion is lossless for required metadata.

## Complex Tasks and Escalation Rules

Mid-level engineer may proceed independently on standard implementation details.

Escalate to reviewer before merging when any of these occur:

- Canonical parser ambiguity affecting key shape (example: conflicting parse for `34(1)(c)`).
- Proposed schema change that breaks existing `LegalUnit` contract.
- Bilingual heuristics produce pairing conflicts across >2% of legislation units.
- Mode selector misclassifies corpus family for IRPA/IRPR or ENF/PDI samples.
- Any decision requiring changes outside `pipeline/*`.

Complex tasks handled at reviewer discretion:

- Final canonical-key grammar decisions.
- Exception policy for malformed legislation records.
- Approval of any new dependencies.

## Test and Validation Requirements

Must pass:

- `pipeline/tests/test_tree.py`
- `pipeline/tests/test_normalize.py`
- `pipeline/tests/test_section_parser.py`
- `pipeline/tests/test_unitize_legislation.py`
- `pipeline/tests/test_unitize_policy.py`

Required quality checks:

- deterministic artifact diff on re-run for unchanged input
- zero mixed-language legal units
- zero indexed legislation units without canonical key
- parse failures captured in `tmp/legal_unit_errors.jsonl`

## Handoff Checklist

- PR with only `pipeline/*` changes unless pre-approved.
- Short run summary:
  - input file count
  - structured element count
  - normalized element count
  - legal unit count by mode
  - parse error count
- 5 sample JSONL lines from each artifact type.
- List of unresolved parser edge cases (if any) with fixture suggestions.
