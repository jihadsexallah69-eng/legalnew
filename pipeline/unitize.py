#!/usr/bin/env python3
import hashlib
import math
import re
from datetime import date
from pathlib import Path
from typing import Any

from pipeline.schemas import LegalUnit
from pipeline.section_parser import ParsedClause, parse_legislation_elements
from pipeline.references import extract_cross_references


LEAD_IN_STUB_RE = re.compile(
    r"(?:the following|includes?|take into account these factors|such as|namely|including|but not limited to)\s*:?\s*$",
    re.IGNORECASE,
)
LIST_MARKER_RE = re.compile(
    r"^\s*(?:[\u2022\u2023\u25E6\u2043\u2219•\-\*]|\d+\.\s+|[a-zA-Z]\)\s+|\([a-zA-Z0-9]+\)\s+)"
)
NUMBERED_HEADING_RE = re.compile(r"^(?:\d+)(?:\.\d+){1,}\s+\S+")
PAGE_GAP_THRESHOLD = 1
DEFAULT_POLICY_PARAGRAPH_CAP = 3


def select_mode(filename: str, instrument_hint: str | None = None) -> str:
    hint = (instrument_hint or "").lower()
    name = (filename or "").lower()

    if "irpa" in hint or "irpr" in hint:
        return "legislation_mode"
    if "irpa" in name or "irpr" in name:
        return "legislation_mode"

    return "policy_mode"


def derive_instrument(filename: str, instrument_hint: str | None = None) -> str:
    hint = (instrument_hint or "").upper()
    if "IRPA" in hint:
        return "IRPA"
    if "IRPR" in hint:
        return "IRPR"

    name = (filename or "").lower()
    if "irpa" in name:
        return "IRPA"
    if "irpr" in name or "sor-2002-227" in name:
        return "IRPR"
    if "enf" in name:
        return "ENF"
    if "pdi" in name or "manual" in name:
        return "PDI"
    return "UNKNOWN"


def _authority_level(instrument: str, doc_type: str) -> str:
    if doc_type == "legislation":
        if instrument == "IRPA":
            return "statute"
        return "regulation"
    return "policy"


def estimate_tokens(text: str) -> int:
    # Deterministic estimate for stable tests and split behavior.
    return math.ceil(len(text or "") / 4)


def starts_with_list_marker(text: str) -> bool:
    return bool(LIST_MARKER_RE.match((text or "").strip()))


def contains_list_marker(text: str) -> bool:
    lines = (text or "").splitlines() or [text or ""]
    return any(starts_with_list_marker(line) for line in lines if line.strip())


def starts_with_lowercase_fragment(text: str) -> bool:
    value = (text or "").lstrip()
    if not value:
        return False
    return value[0].islower()


def is_sentence_fragment(text: str) -> bool:
    value = (text or "").strip()
    if not value:
        return False
    return not value.endswith((".", "!", "?"))


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def is_lead_in_stub(text: str) -> bool:
    value = (text or "").strip()
    if not value:
        return False
    if value.endswith(":"):
        return True
    return bool(LEAD_IN_STUB_RE.search(value))


def has_list_continuation_cue(text: str) -> bool:
    value = (text or "").strip().lower()
    if not value:
        return False
    if value.endswith((";", ":", ",")):
        return True
    if value.endswith(("and", "or", "including", "such as", "e.g.", "i.e.")):
        return True
    return contains_list_marker(value)


def detect_language(text: str) -> str:
    value = (text or "").strip()
    if not value:
        return "en"

    lowered = value.lower()
    french_terms = [
        "article",
        "partie",
        "chapitre",
        "loi",
        "reglement",
        "reglement",
        "etranger",
        "resident",
        "a jour",
        "conformement",
        "paragraphe",
    ]
    french_hits = sum(1 for term in french_terms if term in lowered)
    accented = sum(1 for c in value if c in "àâäçéèêëîïôöùûüÿœ")
    token_count = max(1, len(value.split()))

    if french_hits >= 2 or accented / token_count > 0.02:
        return "fr"
    return "en"


def _normalize_date(value: date | str | None, fallback: date) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value.strip():
        return date.fromisoformat(value.strip())
    return fallback


def _derive_snapshot_id(filename: str, consolidation_date: date) -> str:
    stem = Path(filename or "document").stem
    return f"{stem}-{consolidation_date.isoformat()}"


def _derive_unit_id(
    source_index: int,
    canonical_key: str | None,
    element_ids: list[str],
    filename: str,
) -> str:
    base = "|".join(
        [
            filename or "",
            str(source_index),
            canonical_key or "policy",
            ",".join(element_ids[:5]),
        ]
    )
    return f"unit_{hashlib.md5(base.encode('utf-8')).hexdigest()[:12]}"


def _extract_hierarchy(canonical_key: str) -> tuple[str | None, str]:
    if ":" in canonical_key:
        instrument, tail = canonical_key.split(":", 1)
        return instrument, tail
    return None, canonical_key


def build_aggregate_keys(canonical_key: str) -> list[str]:
    if not canonical_key:
        return []

    instrument, tail = _extract_hierarchy(canonical_key)
    section_match = re.match(r"^(\d+(?:\.\d+)*)", tail)
    if not section_match:
        return []
    section = section_match.group(1)
    labels = re.findall(r"\(([a-zA-Z0-9]+)\)", tail)

    outputs: list[str] = []
    if len(labels) >= 1:
        subsection_key = f"{section}({labels[0]})"
        outputs.append(f"{instrument}:{subsection_key}" if instrument else subsection_key)
    outputs.append(f"{instrument}:{section}" if instrument else section)

    # Keep order stable and remove duplicates while preserving order.
    deduped: list[str] = []
    for key in outputs:
        if key != canonical_key and key not in deduped:
            deduped.append(key)
    return deduped


def _element_index(elements: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for el in elements:
        element_id = str(el.get("element_id", "")).strip()
        if element_id:
            out[element_id] = el
    return out


def _clause_to_unit(
    clause: ParsedClause,
    elements_by_id: dict[str, dict[str, Any]],
    filename: str,
    consolidation: date,
    amended: date,
    snapshot_id: str,
) -> LegalUnit:
    matched = [elements_by_id[eid] for eid in clause.element_ids if eid in elements_by_id]
    source_index = min((int(el.get("source_index", 0)) for el in matched), default=0)
    page_numbers = [int((el.get("metadata", {}) or {}).get("page_number", 1)) for el in matched]
    page_start = min(page_numbers) if page_numbers else 1
    page_end = max(page_numbers) if page_numbers else page_start
    heading_path = matched[0].get("heading_path", []) if matched else []

    instrument_from_key, _ = _extract_hierarchy(clause.canonical_key)
    instrument = instrument_from_key or derive_instrument(filename)
    language = detect_language(clause.text)

    embed_body = (clause.text or "").strip()
    embed_text = f"{clause.canonical_key}: {embed_body}".strip()
    display_text = f"**{clause.canonical_key}** {embed_body}".strip()

    return LegalUnit(
        unit_id=_derive_unit_id(source_index, clause.canonical_key, clause.element_ids, filename),
        source_index=source_index,
        canonical_key=clause.canonical_key,
        embed_text=embed_text,
        display_text=display_text,
        language=language,
        authority_level=_authority_level(instrument, "legislation"),
        instrument=instrument,
        doc_type="legislation",
        filename=filename,
        page_start=page_start,
        page_end=page_end,
        element_ids=clause.element_ids,
        heading_path=heading_path,
        bilingual_group_id=clause.canonical_key,
        translation_role="primary",
        consolidation_date=consolidation,
        last_amended_date=amended,
        source_snapshot_id=snapshot_id,
    )


def _build_aggregate_units(
    clause_units: list[LegalUnit],
    filename: str,
    consolidation: date,
    amended: date,
    snapshot_id: str,
) -> list[LegalUnit]:
    existing = {unit.canonical_key for unit in clause_units if unit.canonical_key}
    groups: dict[tuple[str, str], list[LegalUnit]] = {}

    ordered_clause_units = sorted(clause_units, key=lambda u: (u.source_index, u.unit_id))
    for unit in ordered_clause_units:
        if not unit.canonical_key:
            continue
        for agg_key in build_aggregate_keys(unit.canonical_key):
            groups.setdefault((agg_key, unit.language), []).append(unit)

    aggregates: list[LegalUnit] = []
    for (agg_key, language), members in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        if agg_key in existing:
            continue
        source_index = min(member.source_index for member in members)
        page_start = min(member.page_start for member in members)
        page_end = max(member.page_end for member in members)
        instrument_from_key, _ = _extract_hierarchy(agg_key)
        instrument = instrument_from_key or derive_instrument(filename)

        combined_embed = " ".join(member.embed_text for member in members).strip()
        combined_display = "\n".join(member.display_text for member in members).strip()
        element_ids: list[str] = []
        for member in members:
            for eid in member.element_ids:
                if eid not in element_ids:
                    element_ids.append(eid)

        heading_path = members[0].heading_path if members else []
        aggregates.append(
            LegalUnit(
                unit_id=_derive_unit_id(source_index, agg_key, element_ids, filename),
                source_index=source_index,
                canonical_key=agg_key,
                embed_text=f"{agg_key}: {combined_embed}".strip(),
                display_text=f"**{agg_key}**\n{combined_display}".strip(),
                language=language,
                authority_level=_authority_level(instrument, "legislation"),
                instrument=instrument,
                doc_type="legislation",
                filename=filename,
                page_start=page_start,
                page_end=page_end,
                element_ids=element_ids,
                heading_path=heading_path,
                bilingual_group_id=agg_key,
                translation_role="primary",
                consolidation_date=consolidation,
                last_amended_date=amended,
                source_snapshot_id=snapshot_id,
            )
        )

    return aggregates


def build_legislation_units(
    elements: list[dict[str, Any]],
    filename: str,
    consolidation_date: date | str | None = None,
    last_amended_date: date | str | None = None,
    source_snapshot_id: str | None = None,
) -> tuple[list[LegalUnit], list[dict[str, Any]]]:
    today = date.today()
    consolidation = _normalize_date(consolidation_date, today)
    amended = _normalize_date(last_amended_date, consolidation)
    snapshot_id = source_snapshot_id or _derive_snapshot_id(filename, consolidation)

    parsed_clauses, parse_errors = parse_legislation_elements(elements)
    errors: list[dict[str, Any]] = []
    for err in parse_errors:
        errors.append(
            {
                "error": err.get("error", "parse_error"),
                "element_id": err.get("element_id"),
                "source_index": next(
                    (int(el.get("source_index", 0)) for el in elements if el.get("element_id") == err.get("element_id")),
                    0,
                ),
                "text": err.get("text", ""),
            }
        )

    elements_by_id = _element_index(elements)
    clause_units: list[LegalUnit] = []
    for clause in parsed_clauses:
        if not clause.canonical_key:
            errors.append(
                {
                    "error": "missing_canonical_key",
                    "element_id": clause.element_ids[0] if clause.element_ids else None,
                    "source_index": next(
                        (int(elements_by_id[eid].get("source_index", 0)) for eid in clause.element_ids if eid in elements_by_id),
                        0,
                    ),
                    "text": clause.text,
                }
            )
            continue
        clause_units.append(
            _clause_to_unit(
                clause=clause,
                elements_by_id=elements_by_id,
                filename=filename,
                consolidation=consolidation,
                amended=amended,
                snapshot_id=snapshot_id,
            )
        )

    aggregate_units = _build_aggregate_units(
        clause_units=clause_units,
        filename=filename,
        consolidation=consolidation,
        amended=amended,
        snapshot_id=snapshot_id,
    )

    all_units = clause_units + aggregate_units
    all_units.sort(key=lambda u: (u.source_index, u.unit_id))
    return all_units, errors


GLOSSARY_KEYWORDS = {"glossary", "definitions", "acronym", "acronyms", "abbreviations", "abbreviation"}
LINKS_KEYWORDS = {"links", "resources", "useful links", "additional information", "reference", "references", "website", "for more information"}
TOC_KEYWORDS = {"table of contents", "toc", "outline", "chapter list"}


def classify_scope_unit_type(
    text: str,
    heading_path: list[str],
    element_type: str | None = None,
) -> tuple[str, str]:
    text_lower = (text or "").lower()
    heading_text = " ".join(heading_path).lower() if heading_path else ""
    combined = f"{heading_text} {text_lower}"

    for kw in GLOSSARY_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", combined):
            return "glossary", "glossary"

    for kw in LINKS_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", combined):
            return "links", "directory"

    for kw in TOC_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", combined):
            return "toc", "toc"

    if "table" in (element_type or "").lower():
        return "default", "table"

    return "default", "policy_rule"


def _create_policy_unit(
    heading: dict[str, Any] | None,
    block: list[dict[str, Any]],
    filename: str,
) -> LegalUnit | None:
    if not block:
        return None

    source_index = min(int(item.get("source_index", 0)) for item in block)
    page_start = min(int(item.get("page_number", 1)) for item in block)
    page_end = max(int(item.get("page_number", 1)) for item in block)
    text_parts = [str(item.get("text", "")).strip() for item in block if str(item.get("text", "")).strip()]
    if not text_parts:
        return None

    element_ids: list[str] = []
    for item in block:
        for eid in item.get("element_ids", []):
            if eid not in element_ids:
                element_ids.append(eid)

    heading_text = (heading or {}).get("text", "")
    heading_path = list((heading or {}).get("heading_path", []) or [])
    body = "\n\n".join(text_parts).strip()
    embed_text = body
    display_text = f"**{heading_text}**\n\n{body}".strip() if heading_text else body
    language = detect_language(body)
    instrument = derive_instrument(filename)

    scope, unit_type = classify_scope_unit_type(body, heading_path, block[0].get("element_type"))
    non_embed = scope in ("glossary", "links", "toc")
    cross_refs = extract_cross_references(body, instrument)

    return LegalUnit(
        unit_id=_derive_unit_id(source_index, None, element_ids, filename),
        source_index=source_index,
        canonical_key=None,
        embed_text=embed_text,
        display_text=display_text,
        language=language,
        authority_level=_authority_level(instrument, "policy"),
        instrument=instrument,
        doc_type="policy",
        filename=filename,
        page_start=page_start,
        page_end=page_end,
        element_ids=element_ids,
        heading_path=heading_path,
        non_embed=non_embed,
        unit_type=unit_type,
        scope=scope,
        cross_references=cross_refs,
    )


def build_policy_units(
    elements: list[dict[str, Any]],
    filename: str,
    max_paragraphs_per_unit: int = 8,
    max_tokens_per_unit: int = 900,
) -> list[LegalUnit]:
    embeddable = [el for el in elements if not el.get("non_embed", False)]
    embeddable.sort(key=lambda el: int(el.get("source_index", 0)))

    def build_heading_path(base_path: list[str], heading_text: str) -> list[str]:
        heading_path = list(base_path or [])
        if heading_text and (not heading_path or heading_path[-1] != heading_text):
            heading_path.append(heading_text)
        return heading_path

    def should_enter_aggregation_mode(current: dict[str, Any], nxt: dict[str, Any]) -> bool:
        if current.get("heading_path", []) != nxt.get("heading_path", []):
            return False
        if current.get("language") != nxt.get("language"):
            return False

        current_text = current.get("text", "")
        next_text = nxt.get("text", "")

        lead_in_merge = (
            is_lead_in_stub(current_text)
            and word_count(current_text) < 25
            and (
                starts_with_list_marker(next_text)
                or starts_with_lowercase_fragment(next_text)
                or is_sentence_fragment(next_text)
            )
        )
        if lead_in_merge:
            return True

        if current_text.rstrip().endswith(":"):
            return True
        if contains_list_marker(current_text):
            return True
        if starts_with_list_marker(next_text):
            return True
        if starts_with_lowercase_fragment(next_text):
            return True
        if is_sentence_fragment(current_text) and starts_with_lowercase_fragment(next_text):
            return True

        return False

    def should_stop_merge(current: dict[str, Any], nxt: dict[str, Any]) -> bool:
        if current.get("heading_path", []) != nxt.get("heading_path", []):
            return True
        if current.get("language") != nxt.get("language"):
            return True

        page_gap = int(nxt.get("page_number", 1)) - int(current.get("page_number", 1))
        if page_gap > PAGE_GAP_THRESHOLD:
            if not (
                has_list_continuation_cue(current.get("text", ""))
                or starts_with_list_marker(nxt.get("text", ""))
            ):
                return True

        return False

    segments: list[dict[str, Any]] = []
    current_heading: dict[str, Any] | None = None

    for el in embeddable:
        text = (el.get("norm_text", "") or "").strip()
        if not text:
            continue

        flags = el.get("flags", []) or []
        element_type = el.get("type", "")
        el_heading_path = list(el.get("heading_path", []) or [])
        page_num = int((el.get("metadata", {}) or {}).get("page_number", 1))
        source_index = int(el.get("source_index", 0))
        element_id = el.get("element_id")

        is_heading = "heading" in flags or "title" in flags or NUMBERED_HEADING_RE.match(text)
        if is_heading:
            current_heading = {
                "text": text,
                "heading_path": build_heading_path(el_heading_path, text),
            }
            continue

        heading = current_heading
        heading_path = (
            list(heading.get("heading_path", []))
            if heading
            else list(el_heading_path)
        )

        segment = {
            "kind": "table" if (element_type == "Table" or "table" in flags) else "text",
            "text": text,
            "page_number": page_num,
            "element_ids": [element_id],
            "source_index": source_index,
            "element_type": element_type,
            "heading": heading,
            "heading_path": heading_path,
            "language": detect_language(text),
        }
        segments.append(segment)

    merged_blocks: list[tuple[dict[str, Any] | None, list[dict[str, Any]]]] = []
    idx = 0
    paragraph_cap = max(1, int(max_paragraphs_per_unit))
    token_cap = max(1, int(max_tokens_per_unit))
    baseline_cap = max(1, min(DEFAULT_POLICY_PARAGRAPH_CAP, paragraph_cap))

    while idx < len(segments):
        current = segments[idx]
        if current.get("kind") == "table":
            merged_blocks.append((current.get("heading"), [current]))
            idx += 1
            continue

        block = [current]
        aggregation_mode = False
        j = idx + 1

        while j < len(segments):
            nxt = segments[j]
            if nxt.get("kind") == "table":
                break
            if should_stop_merge(block[-1], nxt):
                break

            proposed_text = "\n\n".join([part.get("text", "") for part in block] + [nxt.get("text", "")]).strip()
            if len(block) + 1 > paragraph_cap:
                break
            if estimate_tokens(proposed_text) > token_cap:
                break

            if not aggregation_mode:
                if should_enter_aggregation_mode(block[-1], nxt):
                    aggregation_mode = True
                    block.append(nxt)
                    j += 1
                    continue

                if len(block) < baseline_cap:
                    block.append(nxt)
                    j += 1
                    continue

                break

            # Bullet/list aggregation mode: keep merging until stop/cap.
            block.append(nxt)
            j += 1

        merged_blocks.append((current.get("heading"), block))
        idx = j

    units: list[LegalUnit] = []
    for heading, block in merged_blocks:
        policy_block = [
            {
                "text": part.get("text", ""),
                "page_number": int(part.get("page_number", 1)),
                "element_ids": list(part.get("element_ids", [])),
                "source_index": int(part.get("source_index", 0)),
                "element_type": part.get("element_type"),
            }
            for part in block
        ]
        unit = _create_policy_unit(heading, policy_block, filename)
        if unit:
            units.append(unit)

    units.sort(key=lambda u: (u.source_index, u.unit_id))
    return units


def build_units(
    elements: list[dict[str, Any]],
    mode: str,
    filename: str = "document.pdf",
    consolidation_date: date | str | None = None,
    last_amended_date: date | str | None = None,
    source_snapshot_id: str | None = None,
) -> tuple[list[LegalUnit], list[dict[str, Any]]]:
    if mode == "legislation_mode":
        return build_legislation_units(
            elements=elements,
            filename=filename,
            consolidation_date=consolidation_date,
            last_amended_date=last_amended_date,
            source_snapshot_id=source_snapshot_id,
        )

    return build_policy_units(elements, filename), []
