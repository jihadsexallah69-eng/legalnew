import json
import tempfile
from datetime import date
from pathlib import Path

from pipeline.emit_artifacts import (
    emit_errors,
    emit_legal_units,
    emit_normalized_elements,
    emit_structured_elements,
    read_legal_units,
    serialize_legal_unit,
    verify_deterministic_order,
)
from pipeline.schemas import LegalUnit


def make_policy_unit(unit_id: str, source_index: int, language: str = "en") -> LegalUnit:
    return LegalUnit(
        unit_id=unit_id,
        source_index=source_index,
        canonical_key=None,
        embed_text=f"Text {unit_id}",
        display_text=f"Text {unit_id}",
        language=language,
        authority_level="policy",
        authority_level_num=2,
        instrument="ENF",
        doc_type="policy",
        filename="test.pdf",
        page_start=1,
        page_end=1,
        element_ids=[f"el_{unit_id}"],
        heading_path=[],
        non_embed=False,
        unit_type="policy_rule",
        scope="default",
        cross_references=["IRPA:63(5)"],
    )


def make_legislation_unit(unit_id: str, source_index: int) -> LegalUnit:
    return LegalUnit(
        unit_id=unit_id,
        source_index=source_index,
        canonical_key="IRPA:34(1)(a)",
        embed_text="IRPA:34(1)(a) text",
        display_text="IRPA:34(1)(a) text",
        language="en",
        authority_level="act",
        authority_level_num=4,
        instrument="IRPA",
        doc_type="legislation",
        filename="irpa.pdf",
        page_start=10,
        page_end=10,
        element_ids=["el1"],
        heading_path=["IRPA"],
        bilingual_group_id="IRPA:34(1)(a)",
        translation_role="primary",
        consolidation_date=date(2026, 1, 19),
        last_amended_date=date(2025, 12, 15),
        source_snapshot_id="C-29-2026-01-19",
        unit_type="policy_rule",
        scope="default",
    )


class TestEmitLegalUnits:
    def test_sorted_by_source_index(self):
        units = [
            make_policy_unit("u2", source_index=2),
            make_policy_unit("u1", source_index=1),
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as handle:
            path = Path(handle.name)
        try:
            count = emit_legal_units(units, path)
            assert count == 2
            rows = read_legal_units(path)
            assert [row["unit_id"] for row in rows] == ["u1", "u2"]
            assert [row["source_index"] for row in rows] == [1, 2]
        finally:
            path.unlink(missing_ok=True)

    def test_deterministic_rerun(self):
        units = [
            make_policy_unit("u2", source_index=2),
            make_policy_unit("u1", source_index=1),
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as handle:
            path = Path(handle.name)
        try:
            emit_legal_units(units, path)
            first = path.read_text(encoding="utf-8")
            emit_legal_units(units, path)
            second = path.read_text(encoding="utf-8")
            assert first == second
        finally:
            path.unlink(missing_ok=True)


class TestEmitErrors:
    def test_emit_errors_with_schema_fields(self):
        errors = [
            {"error": "parse_error", "source_index": 3, "element_id": "e3"},
            {"error": "parse_error", "source_index": 1, "element_id": "e1"},
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as handle:
            path = Path(handle.name)
        try:
            count = emit_errors(errors, path, filename="sample.pdf")
            assert count == 2
            rows = read_legal_units(path)
            assert rows[0]["schema_version"] == "1.0.0"
            assert rows[0]["source_index"] == 1
        finally:
            path.unlink(missing_ok=True)


class TestEmitStructuredAndNormalized:
    def test_emit_structured(self):
        elements = [
            {"element_id": "e2", "type": "Title", "source_index": 2, "root_id": "e2", "parent_chain": [], "heading_path": []},
            {"element_id": "e1", "type": "Title", "source_index": 1, "root_id": "e1", "parent_chain": [], "heading_path": []},
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as handle:
            path = Path(handle.name)
        try:
            emit_structured_elements(elements, path, filename="x.pdf")
            rows = read_legal_units(path)
            assert [row["element_id"] for row in rows] == ["e1", "e2"]
            assert all("schema_version" in row for row in rows)
        finally:
            path.unlink(missing_ok=True)

    def test_emit_normalized(self):
        elements = [
            {
                "element_id": "e1",
                "type": "NarrativeText",
                "source_index": 1,
                "norm_text": "text",
                "non_embed": False,
                "flags": [],
                "heading_path": [],
                "metadata_candidates": {},
            }
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as handle:
            path = Path(handle.name)
        try:
            emit_normalized_elements(elements, path, filename="x.pdf")
            rows = read_legal_units(path)
            assert rows[0]["source_index"] == 1
            assert rows[0]["schema_version"] == "1.0.0"
        finally:
            path.unlink(missing_ok=True)


class TestVerifyDeterministicOrder:
    def test_ok(self):
        rows = [
            {"unit_id": "u1", "source_index": 1},
            {"unit_id": "u2", "source_index": 2},
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as handle:
            path = Path(handle.name)
            for row in rows:
                handle.write(json.dumps(row) + "\n")
        try:
            valid, msg = verify_deterministic_order(path)
            assert valid is True
            assert msg == "ok"
        finally:
            path.unlink(missing_ok=True)

    def test_not_sorted(self):
        rows = [
            {"unit_id": "u2", "source_index": 2},
            {"unit_id": "u1", "source_index": 1},
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as handle:
            path = Path(handle.name)
            for row in rows:
                handle.write(json.dumps(row) + "\n")
        try:
            valid, msg = verify_deterministic_order(path)
            assert valid is False
            assert "not sorted" in msg
        finally:
            path.unlink(missing_ok=True)


class TestSerializeLegalUnit:
    def test_serializes_legislation_fields(self):
        unit = make_legislation_unit("u-leg", 10)
        record = serialize_legal_unit(unit)
        assert record["schema_version"] == "1.0.0"
        assert record["source_index"] == 10
        assert record["consolidation_date"] == "2026-01-19"
        assert record["source_snapshot_id"] == "C-29-2026-01-19"
        assert record["authority_level_num"] == 4
        assert record["non_embed"] is False
        assert record["unit_type"] == "policy_rule"
        assert record["scope"] == "default"
        assert isinstance(record["estimated_tokens"], int)

    def test_serializes_policy_scope_fields(self):
        unit = make_policy_unit("u-pol", 2)
        record = serialize_legal_unit(unit)
        assert record["authority_level_num"] == 2
        assert record["scope"] == "default"
        assert record["unit_type"] == "policy_rule"
        assert record["cross_references"] == ["IRPA:63(5)"]
