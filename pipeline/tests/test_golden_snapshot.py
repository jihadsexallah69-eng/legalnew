#!/usr/bin/env python3
import json
import pytest
from pathlib import Path

from pipeline.unitize import build_units
from pipeline.emit_artifacts import serialize_legal_unit, read_legal_units


FIXTURE_DIR = Path(__file__).parent / "fixtures"
GOLDEN_SNAPSHOT = FIXTURE_DIR / "golden_legal_units.snapshot.jsonl"


def normalize_for_comparison(record: dict) -> dict:
    normalized = record.copy()
    normalized.pop("schema_version", None)
    normalized.pop("id", None)
    normalized.pop("unit_id", None)
    normalized.pop("estimated_tokens", None)
    return normalized


def test_golden_snapshot_enf_policy():
    with open(FIXTURE_DIR / "enf_sample.json") as f:
        elements = json.load(f)

    units, _ = build_units(elements, "policy", "enf01-eng.pdf")
    assert len(units) > 0, "Expected policy units from ENF sample"

    serialized = [serialize_legal_unit(u) for u in units]
    for record in serialized:
        assert "unit_id" in record
        assert record["unit_type"] in {"policy_rule", "glossary", "directory", "toc", "outline", "table"}
        assert record["scope"] in {"default", "glossary", "links", "toc"}
        assert record["authority_level_num"] is not None
        assert isinstance(record["estimated_tokens"], int)


def test_golden_snapshot_legislation():
    with open(FIXTURE_DIR / "irpa_irpr_sample.json") as f:
        elements = json.load(f)

    units, _ = build_units(elements, "legislation_mode", "irpa.pdf")
    assert len(units) > 0, "Expected legislation units from IRPA/IRPR sample"

    serialized = [serialize_legal_unit(u) for u in units]
    for record in serialized:
        assert "unit_id" in record
        if record.get("doc_type") == "legislation":
            assert record.get("canonical_key") is not None


def test_golden_snapshot_schema_parity():
    golden_records = read_legal_units(GOLDEN_SNAPSHOT)
    assert len(golden_records) > 0, "Golden snapshot should not be empty"

    for record in golden_records:
        assert "schema_version" in record
        assert "unit_id" in record
        assert "embed_text" in record
        assert "display_text" in record
        assert "language" in record
        assert "authority_level" in record
        assert "authority_level_num" in record
        assert "instrument" in record
        assert "doc_type" in record
        assert "unit_type" in record
        assert "scope" in record
        assert "cross_references" in record
        assert "estimated_tokens" in record


def test_golden_snapshot_deterministic_order():
    golden_records = read_legal_units(GOLDEN_SNAPSHOT)
    source_indices = [r.get("source_index", 0) for r in golden_records]
    assert source_indices == sorted(source_indices), "Golden snapshot must be sorted by source_index"


def test_golden_snapshot_scope_defaults():
    golden_records = read_legal_units(GOLDEN_SNAPSHOT)
    for record in golden_records:
        assert record["scope"] in {"default", "glossary", "links", "toc"}, f"Invalid scope: {record.get('scope')}"
        assert record["unit_type"] in {"policy_rule", "glossary", "directory", "toc", "outline", "table"}, f"Invalid unit_type: {record.get('unit_type')}"


def test_golden_snapshot_authority_level_num():
    golden_records = read_legal_units(GOLDEN_SNAPSHOT)
    for record in golden_records:
        auth_num = record.get("authority_level_num")
        assert auth_num is not None, "authority_level_num must be set"
        assert isinstance(auth_num, int), "authority_level_num must be an integer"
