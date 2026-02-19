#!/usr/bin/env python3
from __future__ import annotations

from typing import Any

from pipeline.schemas import LegalUnit, SCHEMA_VERSION

try:
    from llama_index.core.schema import TextNode
except Exception:  # pragma: no cover
    # Portable fallback for environments without llama_index.
    class TextNode:  # type: ignore[override]
        def __init__(self, text: str, id_: str, metadata: dict[str, Any]):
            self.text = text
            self.id_ = id_
            self.metadata = metadata


def _serialize_date(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _unit_metadata(unit: LegalUnit) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "unit_id": unit.unit_id,
        "source_index": int(unit.source_index),
        "canonical_key": unit.canonical_key,
        "language": unit.language,
        "language_raw": unit.language_raw,
        "authority_level": unit.authority_level,
        "instrument": unit.instrument,
        "doc_type": unit.doc_type,
        "filename": unit.filename,
        "page_start": unit.page_start,
        "page_end": unit.page_end,
        "element_ids": list(unit.element_ids),
        "heading_path": list(unit.heading_path),
        "display_text": unit.display_text,
    }

    if unit.bilingual_group_id:
        metadata["bilingual_group_id"] = unit.bilingual_group_id
    if unit.translation_role:
        metadata["translation_role"] = unit.translation_role

    consolidation = _serialize_date(unit.consolidation_date)
    amended = _serialize_date(unit.last_amended_date)
    if consolidation:
        metadata["consolidation_date"] = consolidation
    if amended:
        metadata["last_amended_date"] = amended
    if unit.source_snapshot_id:
        metadata["source_snapshot_id"] = unit.source_snapshot_id

    return metadata


def unit_to_node(unit: LegalUnit) -> TextNode:
    text = (unit.embed_text or "").strip()
    if not text:
        text = (unit.display_text or "").strip()

    return TextNode(
        id_=unit.unit_id,
        text=text,
        metadata=_unit_metadata(unit),
    )


def units_to_nodes(units: list[LegalUnit]) -> list[TextNode]:
    ordered = sorted(units, key=lambda u: (int(u.source_index), u.unit_id))
    return [unit_to_node(unit) for unit in ordered]
