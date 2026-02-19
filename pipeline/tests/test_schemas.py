import pytest
from datetime import date
from pipeline.schemas import (
    RawElement,
    StructuredElement,
    NormalizedElement,
    LegalUnit,
    validate_raw_element,
    validate_structured_element,
    validate_normalized_element,
    validate_legal_unit,
    SCHEMA_VERSION,
)


class TestRawElement:
    def test_valid_raw_element(self):
        data = {
            "element_id": "abc123",
            "type": "NarrativeText",
            "text": "Some text",
            "metadata": {"page_number": 1},
        }
        el = RawElement(**data)
        assert el.element_id == "abc123"
        assert el.type == "NarrativeText"

    def test_raw_element_missing_id_fails(self):
        with pytest.raises(ValueError):
            RawElement(type="Text", text="test")

    def test_raw_element_null_text_allowed(self):
        el = RawElement(element_id="x", type="Table", text=None, metadata={})
        assert el.text is None

    def test_raw_element_null_text_non_table_fails(self):
        with pytest.raises(ValueError):
            RawElement(element_id="x", type="NarrativeText", text=None, metadata={})

    def test_validate_raw_element(self):
        data = {"element_id": "id1", "type": "Title", "text": "Title text"}
        validated = validate_raw_element(data)
        assert validated.element_id == "id1"


class TestStructuredElement:
    def test_structured_with_all_fields(self):
        data = {
            "element_id": "id1",
            "type": "Title",
            "text": "Section 1",
            "metadata": {},
            "root_id": "root1",
            "source_index": 5,
            "parent_chain": ["root1", "parent1"],
            "heading_path": ["Chapter 1", "Section 1"],
        }
        el = StructuredElement(**data)
        assert el.source_index == 5
        assert el.heading_path == ["Chapter 1", "Section 1"]

    def test_structured_default_values(self):
        el = StructuredElement(element_id="id1", type="Text")
        assert el.source_index == 0
        assert el.parent_chain == []
        assert el.heading_path == []


class TestNormalizedElement:
    def test_normalized_flags(self):
        el = NormalizedElement(
            element_id="id1",
            type="Footer",
            text="Page 5 of 10",
            metadata={},
            non_embed=True,
            flags=["footer", "page_number"],
        )
        assert el.non_embed is True
        assert "footer" in el.flags

    def test_normalized_metadata_candidates(self):
        el = NormalizedElement(
            element_id="id1",
            type="Table",
            text="table data",
            metadata={},
            metadata_candidates={"raw_table_html": "<table>...</table>"},
        )
        assert "raw_table_html" in el.metadata_candidates


class TestLegalUnit:
    def test_valid_legislation_unit(self):
        data = {
            "unit_id": "unit_1",
            "canonical_key": "IRPA:34(1)(c)",
            "embed_text": "The officer may...",
            "display_text": "**IRPA 34(1)(c)** The officer may...",
            "language": "en",
            "authority_level": "regulation",
            "instrument": "IRPA",
            "doc_type": "legislation",
            "filename": "irpa.pdf",
            "page_start": 10,
            "page_end": 12,
            "element_ids": ["el1", "el2"],
            "heading_path": ["Part 1", "Section 34"],
            "bilingual_group_id": "IRPA:34(1)(c)",
            "translation_role": "primary",
            "consolidation_date": "2026-01-19",
            "last_amended_date": "2025-12-15",
            "source_snapshot_id": "C-29-2026-01-19",
        }
        unit = LegalUnit(**data)
        assert unit.canonical_key == "IRPA:34(1)(c)"
        assert unit.language == "en"

    def test_valid_policy_unit(self):
        data = {
            "unit_id": "unit_2",
            "canonical_key": None,
            "embed_text": "Policy guidance text",
            "display_text": "**Policy** Policy guidance text",
            "language": "fr",
            "authority_level": "policy",
            "instrument": "ENF",
            "doc_type": "policy",
            "filename": "enf01.pdf",
            "page_start": 1,
            "page_end": 3,
            "element_ids": ["el3"],
            "heading_path": ["Chapter 1"],
        }
        unit = LegalUnit(**data)
        assert unit.canonical_key is None

    def test_invalid_language_fails(self):
        data = {
            "unit_id": "unit_x",
            "canonical_key": None,
            "embed_text": "text",
            "display_text": "text",
            "language": "de",
            "authority_level": "policy",
            "instrument": "ENF",
            "doc_type": "policy",
            "filename": "x.pdf",
            "page_start": 1,
            "page_end": 1,
            "element_ids": [],
            "heading_path": [],
        }
        with pytest.raises(ValueError):
            LegalUnit(**data)

    def test_language_normalization_eng_to_en(self):
        unit = LegalUnit(
            unit_id="unit_norm",
            canonical_key=None,
            embed_text="text",
            display_text="text",
            language="eng",
            authority_level="policy",
            instrument="ENF",
            doc_type="policy",
            filename="x.pdf",
            page_start=1,
            page_end=1,
            element_ids=[],
            heading_path=[],
        )
        assert unit.language == "en"
        assert unit.language_raw == "eng"

    def test_language_normalization_fra_to_fr(self):
        unit = LegalUnit(
            unit_id="unit_norm_fr",
            canonical_key=None,
            embed_text="text",
            display_text="text",
            language="fra",
            authority_level="policy",
            instrument="ENF",
            doc_type="policy",
            filename="x.pdf",
            page_start=1,
            page_end=1,
            element_ids=[],
            heading_path=[],
        )
        assert unit.language == "fr"
        assert unit.language_raw == "fra"

    def test_translation_role_validation(self):
        with pytest.raises(ValueError):
            LegalUnit(
                unit_id="unit_bad_role",
                canonical_key=None,
                embed_text="text",
                display_text="text",
                language="en",
                authority_level="policy",
                instrument="ENF",
                doc_type="policy",
                filename="x.pdf",
                page_start=1,
                page_end=1,
                element_ids=[],
                heading_path=[],
                translation_role="bad-role",
            )

    def test_legislation_missing_canonical_key_fails(self):
        with pytest.raises(ValueError):
            LegalUnit(
                unit_id="unit_leg_missing",
                canonical_key=None,
                embed_text="text",
                display_text="text",
                language="en",
                authority_level="statute",
                instrument="IRPA",
                doc_type="legislation",
                filename="irpa.pdf",
                page_start=1,
                page_end=1,
                element_ids=["e1"],
                heading_path=[],
            )

    def test_dates_optional(self):
        unit = LegalUnit(
            unit_id="unit_dates",
            canonical_key=None,
            embed_text="text",
            display_text="text",
            language="en",
            authority_level="policy",
            instrument="ENF",
            doc_type="policy",
            filename="x.pdf",
            page_start=1,
            page_end=1,
            element_ids=[],
            heading_path=[],
            consolidation_date=date(2024, 1, 1),
        )
        assert unit.consolidation_date == date(2024, 1, 1)


class TestSchemaVersion:
    def test_schema_version_constant(self):
        assert SCHEMA_VERSION == "1.0.0"
