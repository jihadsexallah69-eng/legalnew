# Legal Unit Pipeline Redesign Plan

Date: 2026-02-19
Status: Proposed
Scope: Independent redesign for JSON-element legal ingestion, chunking, metadata, and retrieval behavior.

## 1) Objective

Build a legal-first ingestion pipeline that converts raw JSON elements into atomic, auditable legal units optimized for:

- Citation precision
- Hierarchy-aware legal retrieval
- Authority-aware answer generation
- Bilingual (EN/FR) recall

## 2) Non-Goals (Initial Rollout)

- Full graph-native legal reasoning in v1
- Automatic legal interpretation quality scoring by LLM judges in production path
- Full amendment history reconstruction across all instruments on day one

## 3) Target Architecture

Pipeline stages:

1. `Raw Elements` (JSON with `element_id`, `type`, `metadata.parent_id`, `text`, `text_as_html`)
2. `Element Tree` (node map + children map + root detection + heading chains)
3. `Normalized Elements` (type-aware cleaned content, noise tagging, table text extraction)
4. `Mode Router` (`policy_mode` vs `legislation_mode`)
5. `Legal Units` (atomic clause/manual/table units with canonical section keys)
6. `Embeddings + Index` (dual text fields + metadata filters)
7. `Retrieval Runtime` (retrieve -> expand refs -> rerank -> compose with authority gate)

## 4) Data Contracts

### 4.1 Raw Element Contract (input)

Required fields:

- `element_id`
- `type`
- `text` (nullable for table-only rows if `text_as_html` exists)
- `metadata` object (optional but expected)

Optional fields:

- `metadata.parent_id`
- `metadata.filename`
- `metadata.page_number`
- `metadata.languages`
- `text_as_html`

### 4.2 Legal Unit Contract (output)

Required fields:

- `unit_id`
- `canonical_key`
- `embed_text`
- `display_text`
- `authority_level_num` (numeric rank)
- `authority_level_label`
- `doc_type`
- `instrument`
- `jurisdiction`
- `language`
- `source.filename`
- `source.page_start`
- `source.page_end`
- `source.element_ids` (array)

Recommended fields:

- `section_canonical` (example: `IRPA:34(1)(c)`)
- `section_display` (example: `A34(1)(c)`)
- `heading_path`
- `parent_chain`
- `publication_date_candidate`
- `effective_date_candidate`
- `doc_date_inferred` (boolean)
- `non_embed` (boolean)

Required for legislation units:

- `bilingual_group_id`
- `translation_role` (`primary` | `parallel`)

### 4.3 Bilingual Pair Contract (Legislation)

Legislation units must be emitted as parallel language pairs with semantic symmetry:

- English and French units are separate records
- Same `canonical_key` and same `bilingual_group_id`
- Same `authority_level_num` and legal rank
- Different `language` and `unit_id`
- Retrieval must not treat French as fallback

Example:

| canonical_key | language | bilingual_group_id | translation_role |
| --- | --- | --- | --- |
| `IRPA:34(1)(c)` | `eng` | `IRPA:34(1)(c)` | `primary` |
| `IRPA:34(1)(c)` | `fra` | `IRPA:34(1)(c)` | `parallel` |

### 4.4 Citation Edge Contract (optional in v1, ready by v2)

Required fields:

- `edge_id`
- `edge_type` (`REFERENCES`, `VERSION_OF`, `INTERPRETED_BY`)
- `from_unit_id`
- `to_key` (canonical section key or unit id)
- `evidence_text`

### 4.5 Consolidation Snapshot Contract (Legislation)

Every legislation unit is stamped with batch-level consolidation metadata:

- `consolidation_date` (example: `2026-01-19`)
- `last_amended_date` (example: `2025-12-15`)
- `source_snapshot_id` (example: `C-29-2026-01-19`)

On new consolidations:

- diff by `canonical_key`
- create `VERSION_OF` edges
- mark changed/added/removed clauses

## 5) Core Processing Rules

### 5.1 Structure reconstruction

- Build `node_map: element_id -> element`
- Build `children_map: parent_id -> child[]`
- Roots are elements with no `parent_id` or missing parent
- Compute `parent_chain` and `heading_path` for each element

### 5.2 Normalization rules by type

- `Footer`: store metadata; default `non_embed=true`
- `Title`, `NarrativeText`, `ListItem`: normalize whitespace and OCR artifacts
- `Table`: convert `text_as_html` into readable row text; keep raw HTML in metadata
- Preserve original text in metadata for traceability

### 5.3 Mode-specific legal unitization rules

| Feature | Policy Mode | Legislation Mode |
| --- | --- | --- |
| Chunking | heading + 1 to 3 paragraphs | clause boundaries only |
| Max span | soft cap | strict clause-level |
| Canonical key | optional | mandatory |
| Section aggregates | recommended | required |
| Bilingual symmetry | optional | required |

Policy mode rules:

- Merge `Title + child NarrativeText/ListItem` when semantically linked
- Use heading-context windows for manuals and PDIs
- Small tables: one unit; large tables: split by row groups

Legislation mode rules:

- Do not rely on PDF heading detection alone
- Use structural clause boundaries as segmentation authority
- Emit clause units plus required aggregate units

### 5.4 Structural parser for legislation (primary authority)

For `IRPA`/`IRPR`, structural parsing is primary and title merging is secondary fallback.

Parser extracts:

- `part`
- `division`
- `section`
- `subsection`
- `paragraph`
- `subparagraph`

Example parse:

- `34. (1) A permanent resident...`
- `(c) engaging in terrorism.`

Produces:

- `section=34`
- `subsection=1`
- `paragraph=c`

### 5.5 Canonical section parsing

Normalize variants:

- `A34(1)(c)`
- `34. (1) (c)`
- `s.34(1)(c)`

To canonical key:

- `IRPA:34(1)(c)` (or `IRPR:179(b)`)

Legislation requirement:

- canonical parsing is mandatory before indexing
- if parser fails, record a parse failure and block index for that unit

### 5.6 Legislation aggregate units (required)

For each legislation section family, emit:

- Clause-level units (`IRPA:34(1)(a)`, `IRPA:34(1)(b)`, `IRPA:34(1)(c)`)
- Subsection aggregate (`IRPA:34(1)`)
- Section aggregate (`IRPA:34`)

### 5.7 Authority model

Ranking policy:

- `5`: Constitution / SCC binding principles
- `4`: Statute/Regulation (`IRPA`, `IRPR`)
- `3`: Ministerial instructions / orders
- `2`: Policy manuals (`ENF`, PDIs)
- `1`: Secondary commentary

## 6) Retrieval and Agent Runtime Rules

Runtime loop:

1. `retrieve(query, filters)` (dense + sparse hybrid)
2. `expand_refs(chunks)` (regex/canonical key expansion)
3. `rerank(chunks, query)` (cross-encoder or LLM rerank)
4. `compose_answer(chunks)` with explicit citations

Hard hierarchy gate:

- For legal requirement questions, prioritize binding sources first:
  `IRPA/IRPR > MI > policy > case law commentary`.
- If policy is cited, label as policy (non-binding).

Binding-source completeness check (mandatory):

- If a binding claim is requested and no statute/regulation unit is cited, mark retrieval incomplete
- Rerun retrieval with `authority_level_num=4` filter
- Only compose final legal-requirement answer after binding retry is evaluated

## 7) Better-Than-Baseline Design Choices

1. Dual-granularity indexing is mandatory for legislation:
   clause-level + subsection aggregate + section aggregate, retrieved together and reranked.
2. Hybrid retrieval baseline before graph DB:
   dense embeddings + BM25/FTS + metadata filters + regex reference expansion.
3. Deterministic parser for section normalization:
   parser is first-class, fixture-tested, and blocks malformed legislation units from indexing.

## 8) Two-Week Implementation Backlog

### Week 1: Ingestion and unit construction

T1. Define schemas and validators

- Deliverable: JSON schema or typed validators for raw element, legal unit, citation edge.
- Acceptance criteria: invalid payloads fail with explicit field errors.

T2. Build element tree module

- Deliverable: `node_map`, `children_map`, `roots`, `parent_chain`, `heading_path`.
- Acceptance criteria: 100% of elements assigned deterministic root + chain.

T3. Implement normalization module

- Deliverable: type-specific cleaning pipeline with trace fields.
- Acceptance criteria: footer/date/page noise tagged; table HTML transformed to readable text.

T4. Implement section parser and canonicalizer

- Deliverable: legislation parser extracting part/division/section/subsection/paragraph/subparagraph plus canonical key builder.
- Acceptance criteria: parser fixture suite passes for ENF/IRPA/IRPR layout variants and mixed EN/FR numbering formats.

T5. Implement legal unit builder

- Deliverable: mode router with `policy_mode` and `legislation_mode` builders.
- Acceptance criteria: legislation mode emits strict clause boundaries and required aggregates (`section`, `subsection`, `clause`).

T6. Emit dual text fields and legal metadata

- Deliverable: `embed_text`, `display_text`, authority/jurisdiction/language/date fields plus bilingual pair and consolidation snapshot fields.
- Acceptance criteria: legislation units always include `bilingual_group_id`, `translation_role`, `consolidation_date`, `source_snapshot_id`.

### Week 2: Indexing, retrieval, and quality gates

T7. Index hybrid retrieval

- Deliverable: dense + BM25/FTS indexing and retrieval endpoint with metadata filters.
- Acceptance criteria: filterable by `authority_level_num`, `instrument`, `language`, date fields.

T8. Reference expansion

- Deliverable: regex/canonical-key `REFERENCES` expansion in retrieval pipeline.
- Acceptance criteria: `A34(1)(a)` references pull linked units in expansion step.

T9. Reranker integration

- Deliverable: rerank stage over retrieved candidates.
- Acceptance criteria: top results improve section-key hit-rate on eval set.

T10. Authority gate in answer composer

- Deliverable: response policy that enforces source hierarchy, policy labeling, and binding-source completeness retry.
- Acceptance criteria: binding claim triggers automatic retry with `authority_level_num=4` when statute/reg citations are missing.

T11. Evaluation harness

- Deliverable: metrics + fixture dataset.
- Acceptance criteria:
  citation precision >= 0.90 on fixture set,
  section canonicalization accuracy >= 0.95,
  authority order compliance = 1.0 on gated prompts,
  bilingual pair symmetry = 1.0 for legislation canonical keys.

T12. Rollout and reindex runbook

- Deliverable: runbook for dry run, partial reindex, full cutover, rollback, and consolidation snapshot diffing.
- Acceptance criteria: reproducible reindex with audit artifacts, no silent schema drift, and deterministic `VERSION_OF` generation from snapshot deltas.

## 9) Validation Dataset (Minimum)

Create fixtures from:

- ENF clauses with shorthand headings (`A34(1)(c)`)
- IRPA/IRPR provision text
- IRPA/IRPR EN/FR parallel provisions sharing canonical keys
- Mixed table-heavy manual pages
- Footer-heavy OCR pages
- Layout edge cases where section number and paragraph letters are split across elements

## 10) Risks and Mitigations

Risk: Over-merging units reduces precision.
Mitigation: enforce max paragraph span and clause boundary rules.

Risk: Parser false positives on non-citation tokens.
Mitigation: lexical constraints + document-family-aware parser modes.

Risk: Retrieval favors policy over binding law.
Mitigation: hard hierarchy gate + metadata filters + authority-aware rerank features.

Risk: English-biased retrieval in bilingual legislation.
Mitigation: mandatory bilingual pair contract and language-aware reranking within the same `bilingual_group_id`.

Risk: Date uncertainty for policy manuals.
Mitigation: store candidate date + `doc_date_inferred=true`, never present as authoritative effective date unless verified.

## 11) Exit Criteria for v1

Ship when all are true:

- Legal unit schema stable and versioned
- Canonical section parser meets accuracy target
- Hybrid retrieval + hierarchy gate in production path
- Audit-ready citations include filename/page/element_ids
- Legislation units satisfy bilingual symmetry contract
- Consolidation snapshot fields stamped on all legislation units
- Reindex runbook tested end-to-end in dry run and full run
