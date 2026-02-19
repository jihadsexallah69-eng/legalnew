# Pipeline Checkpoint Summary (1-7)

Last updated: 2026-02-19  
Scope: `pipeline/*` implementation status against delegation checkpoints.

## Overall Status

- Checkpoints `1-7`: Completed
- Pipeline tests: `90 passed`
- Command run: `python -m pytest -q pipeline/tests`

## Checkpoint Status

### 1) Schemas + Validation

Status: Done

Implemented:

- `pipeline/schemas.py`
- Fail-fast stage schemas: `RawElement`, `StructuredElement`, `NormalizedElement`, `LegalUnit`
- Language normalization (`eng/fra/fre/en-US/fr-CA -> en/fr`)
- Legislation-required field validation in `LegalUnit`

Evidence:

- `pipeline/tests/test_schemas.py`

### 2) Section Parser + Fixtures

Status: Done

Implemented:

- `pipeline/section_parser.py`
- Structural parsing as primary authority
- Canonical key generation with instrument prefix (`IRPA:` / `IRPR:`)
- Parse-error emission for unparsed text without section context

Evidence:

- `pipeline/tests/test_section_parser.py`
- Fixtures:
  - `pipeline/tests/fixtures/irpa_irpr_sample.json`
  - `pipeline/tests/fixtures/enf_sample.json`

### 3) Element Tree + Normalize

Status: Done

Implemented:

- `pipeline/element_tree.py`
  - order-independent parent linking
  - deterministic roots/parent chains
  - duplicate ID fail-fast
  - cycle guard
- `pipeline/normalize.py`
  - type-based normalization
  - deterministic table HTML parsing
  - `get_table_html()` priority support for multiple input shapes

Evidence:

- `pipeline/tests/test_tree_normalize.py`

### 4) Unitization (Legislation + Policy)

Status: Done

Implemented:

- `pipeline/unitize.py`
- Mode selector: `legislation_mode` / `policy_mode`
- Legislation:
  - clause units
  - required aggregate units (section/subsection)
  - consolidation snapshot stamping
- Policy:
  - heading + 1-3 paragraph grouping
  - standalone table units
  - language-split block behavior

Evidence:

- `pipeline/tests/test_unitize.py`

### 5) Bilingual Split/Pair

Status: Done

Implemented:

- `pipeline/bilingual.py`
- Pairing by canonical key / bilingual group
- Support for multiple units per key
- Mixed-language mismatch validation

Evidence:

- `pipeline/tests/test_bilingual.py`

### 6) Artifact Emission (Deterministic JSONL)

Status: Done

Implemented:

- `pipeline/emit_artifacts.py`
- Deterministic emission by `source_index`
- Required record fields include `schema_version` and `source_index`
- Error artifact support
- Order verification helper

Evidence:

- `pipeline/tests/test_emit_artifacts.py`

### 7) Node Conversion (`LegalUnit -> TextNode`)

Status: Done

Implemented:

- `pipeline/nodes.py`
- `unit_to_node()` and `units_to_nodes()`
- Deterministic node ordering
- Metadata parity mapping from `LegalUnit`

Evidence:

- `pipeline/tests/test_nodes.py`

## Remaining Work (Post Checkpoint 7)

- Integration wiring from pipeline outputs into ingestion execution path.
- End-to-end JSONL generation runbook command in repo docs.
- Golden-data regression snapshots for `tmp/legal_units.jsonl` and `tmp/legal_unit_errors.jsonl`.

## Known Risks / Watch Items

- Language detection is heuristic-based and may require formal language ID later.
- Legislation parsing edge cases may increase with broader real-world corpora.
- Bilingual pairing quality depends on canonical-key consistency upstream.
