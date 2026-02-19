#!/usr/bin/env python3
import json
from pathlib import Path
from typing import Any

from pipeline.schemas import LegalUnit, SCHEMA_VERSION


def serialize_legal_unit(unit: LegalUnit) -> dict[str, Any]:
    record: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "id": unit.unit_id,
        "source_index": int(unit.source_index),
        "filename": unit.filename,
        "unit_id": unit.unit_id,
        "canonical_key": unit.canonical_key,
        "embed_text": unit.embed_text,
        "display_text": unit.display_text,
        "language": unit.language,
        "language_raw": unit.language_raw,
        "authority_level": unit.authority_level,
        "instrument": unit.instrument,
        "doc_type": unit.doc_type,
        "page_start": unit.page_start,
        "page_end": unit.page_end,
        "element_ids": unit.element_ids,
        "heading_path": unit.heading_path,
    }

    if unit.bilingual_group_id:
        record["bilingual_group_id"] = unit.bilingual_group_id
    if unit.translation_role:
        record["translation_role"] = unit.translation_role
    if unit.consolidation_date:
        record["consolidation_date"] = unit.consolidation_date.isoformat()
    if unit.last_amended_date:
        record["last_amended_date"] = unit.last_amended_date.isoformat()
    if unit.source_snapshot_id:
        record["source_snapshot_id"] = unit.source_snapshot_id

    return record


def _write_jsonl(records: list[dict[str, Any]], output_path: str | Path) -> int:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return len(records)


def emit_legal_units(units: list[LegalUnit], output_path: str | Path) -> int:
    ordered = sorted(units, key=lambda u: (int(u.source_index), u.unit_id))
    records = [serialize_legal_unit(unit) for unit in ordered]
    return _write_jsonl(records, output_path)


def emit_errors(
    errors: list[dict[str, Any]],
    output_path: str | Path,
    filename: str = "unknown",
) -> int:
    records: list[dict[str, Any]] = []
    for idx, error in enumerate(sorted(errors, key=lambda e: (int(e.get("source_index", 0)), str(e.get("element_id", ""))))):
        records.append(
            {
                "schema_version": SCHEMA_VERSION,
                "id": f"error_{idx}",
                "source_index": int(error.get("source_index", 0)),
                "filename": filename,
                **error,
            }
        )
    return _write_jsonl(records, output_path)


def emit_structured_elements(
    elements: list[dict[str, Any]],
    output_path: str | Path,
    filename: str = "unknown",
) -> int:
    ordered = sorted(elements, key=lambda e: int(e.get("source_index", 0)))
    records: list[dict[str, Any]] = []
    for el in ordered:
        records.append(
            {
                "schema_version": SCHEMA_VERSION,
                "id": str(el.get("element_id", "")),
                "source_index": int(el.get("source_index", 0)),
                "filename": filename,
                "element_id": el.get("element_id", ""),
                "type": el.get("type", ""),
                "root_id": el.get("root_id", ""),
                "parent_chain": el.get("parent_chain", []),
                "heading_path": el.get("heading_path", []),
            }
        )
    return _write_jsonl(records, output_path)


def emit_normalized_elements(
    elements: list[dict[str, Any]],
    output_path: str | Path,
    filename: str = "unknown",
) -> int:
    ordered = sorted(elements, key=lambda e: int(e.get("source_index", 0)))
    records: list[dict[str, Any]] = []
    for el in ordered:
        records.append(
            {
                "schema_version": SCHEMA_VERSION,
                "id": str(el.get("element_id", "")),
                "source_index": int(el.get("source_index", 0)),
                "filename": filename,
                "element_id": el.get("element_id", ""),
                "type": el.get("type", ""),
                "norm_text": el.get("norm_text", ""),
                "non_embed": bool(el.get("non_embed", False)),
                "flags": el.get("flags", []),
                "heading_path": el.get("heading_path", []),
                "metadata_candidates": el.get("metadata_candidates", {}),
            }
        )
    return _write_jsonl(records, output_path)


def read_legal_units(input_path: str | Path) -> list[dict[str, Any]]:
    path = Path(input_path)
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def verify_deterministic_order(input_path: str | Path) -> tuple[bool, str]:
    rows = read_legal_units(input_path)
    if not rows:
        return True, "empty"

    ordering = [
        (
            int(row.get("source_index", 0)),
            str(row.get("unit_id") or row.get("id") or ""),
        )
        for row in rows
    ]

    if ordering != sorted(ordering):
        return False, f"not sorted: {ordering[:10]}..."
    return True, "ok"
