#!/usr/bin/env python3
import hashlib
import re
from datetime import date
from pathlib import Path
from typing import Any

from pipeline.schemas import LegalUnit
from pipeline.section_parser import ParsedClause, parse_legislation_elements


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
            return "act"
        if instrument == "IRPR":
            return "regulation"
        return "regulation"
    return "policy"


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
    heading_path = (heading or {}).get("heading_path", []) or ["Document"]
    body = "\n\n".join(text_parts).strip()
    embed_text = body
    display_text = f"**{heading_text}**\n\n{body}".strip() if heading_text else body
    language = detect_language(body)
    instrument = derive_instrument(filename)

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
    )


def build_policy_units(
    elements: list[dict[str, Any]],
    filename: str,
    max_paragraphs_per_unit: int = 3,
) -> list[LegalUnit]:
    embeddable = [el for el in elements if not el.get("non_embed", False)]
    embeddable.sort(key=lambda el: int(el.get("source_index", 0)))

    units: list[LegalUnit] = []
    current_heading: dict[str, Any] | None = None
    block: list[dict[str, Any]] = []
    block_lang: str | None = None

    def flush_block() -> None:
        nonlocal block, block_lang
        unit = _create_policy_unit(current_heading, block, filename)
        if unit:
            units.append(unit)
        block = []
        block_lang = None

    for el in embeddable:
        text = (el.get("norm_text", "") or "").strip()
        if not text:
            continue
        flags = el.get("flags", []) or []
        element_type = el.get("type", "")

        if "heading" in flags or "title" in flags:
            flush_block()
            current_heading = {
                "text": text,
                "heading_path": el.get("heading_path", []) or ["Document"],
            }
            continue

        if element_type == "Table" or "table" in flags:
            flush_block()
            table_item = {
                "text": text,
                "page_number": int((el.get("metadata", {}) or {}).get("page_number", 1)),
                "element_ids": [el.get("element_id")],
                "source_index": int(el.get("source_index", 0)),
            }
            table_unit = _create_policy_unit(current_heading, [table_item], filename)
            if table_unit:
                units.append(table_unit)
            continue

        paragraph_lang = detect_language(text)
        if block and (len(block) >= max_paragraphs_per_unit or (block_lang and paragraph_lang != block_lang)):
            flush_block()

        if block_lang is None:
            block_lang = paragraph_lang

        block.append(
            {
                "text": text,
                "page_number": int((el.get("metadata", {}) or {}).get("page_number", 1)),
                "element_ids": [el.get("element_id")],
                "source_index": int(el.get("source_index", 0)),
            }
        )

    flush_block()
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
