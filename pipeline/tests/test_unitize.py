import json
from pathlib import Path

from pipeline.unitize import (
    build_aggregate_keys,
    build_legislation_units,
    build_policy_units,
    build_units,
    derive_instrument,
    detect_language,
    select_mode,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestSelectMode:
    def test_legislation_detection(self):
        assert select_mode("irpa.pdf") == "legislation_mode"
        assert select_mode("random.pdf", "IRPR") == "legislation_mode"

    def test_policy_detection(self):
        assert select_mode("enf01-eng.pdf") == "policy_mode"
        assert select_mode("manual.pdf") == "policy_mode"


class TestDeriveInstrument:
    def test_known(self):
        assert derive_instrument("irpa.pdf") == "IRPA"
        assert derive_instrument("irpr.pdf") == "IRPR"
        assert derive_instrument("enf01-eng.pdf") == "ENF"

    def test_unknown(self):
        assert derive_instrument("misc.pdf") == "UNKNOWN"


class TestDetectLanguage:
    def test_english(self):
        assert detect_language("The Minister may issue an order.") == "en"

    def test_french(self):
        assert detect_language("L'article 34 de la loi s'applique.") == "fr"


class TestBuildAggregateKeys:
    def test_prefixed_key(self):
        keys = build_aggregate_keys("IRPA:34(1)(c)")
        assert "IRPA:34(1)" in keys
        assert "IRPA:34" in keys

    def test_subsection_key(self):
        keys = build_aggregate_keys("IRPR:15.1(1)")
        assert "IRPR:15.1" in keys


class TestBuildLegislationUnits:
    def test_fixture_generates_clause_and_aggregates(self):
        with open(FIXTURES_DIR / "irpa_irpr_sample.json", encoding="utf-8") as handle:
            elements = json.load(handle)

        units, errors = build_legislation_units(
            elements=elements,
            filename="irpa_irpr_sample.pdf",
            consolidation_date="2026-01-19",
            last_amended_date="2025-12-15",
            source_snapshot_id="C-29-2026-01-19",
        )

        assert len(units) > 0
        assert isinstance(errors, list)

        keys = {u.canonical_key for u in units if u.canonical_key}
        assert "IRPA:34(1)(a)" in keys
        assert "IRPA:34(1)" in keys
        assert "IRPA:34" in keys

        for unit in units:
            assert unit.doc_type == "legislation"
            assert unit.canonical_key
            assert unit.bilingual_group_id
            assert unit.translation_role in ("primary", "parallel")
            assert unit.consolidation_date is not None
            assert unit.last_amended_date is not None
            assert unit.source_snapshot_id

    def test_defaults_stamp_snapshot_fields(self):
        elements = [
            {
                "element_id": "el1",
                "type": "NarrativeText",
                "norm_text": "34 (1) The Minister may",
                "flags": ["heading"],
                "heading_path": ["IRPA"],
                "metadata": {"page_number": 10, "filename": "irpa.pdf"},
                "source_index": 0,
            }
        ]
        units, _ = build_legislation_units(elements, "irpa.pdf")
        assert len(units) >= 1
        keys = {u.canonical_key for u in units}
        assert "IRPA:34(1)" in keys
        assert "IRPA:34" in keys
        for unit in units:
            assert unit.source_snapshot_id
            assert unit.consolidation_date is not None
            assert unit.last_amended_date is not None


class TestBuildPolicyUnits:
    def test_paragraph_cap(self):
        elements = [
            {
                "element_id": "h1",
                "type": "Title",
                "norm_text": "1. Intro",
                "flags": ["heading", "title"],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "Paragraph one.",
                "flags": [],
                "heading_path": ["1. Intro"],
                "metadata": {"page_number": 1},
                "source_index": 1,
            },
            {
                "element_id": "p2",
                "type": "NarrativeText",
                "norm_text": "Paragraph two.",
                "flags": [],
                "heading_path": ["1. Intro"],
                "metadata": {"page_number": 1},
                "source_index": 2,
            },
            {
                "element_id": "p3",
                "type": "NarrativeText",
                "norm_text": "Paragraph three.",
                "flags": [],
                "heading_path": ["1. Intro"],
                "metadata": {"page_number": 1},
                "source_index": 3,
            },
            {
                "element_id": "p4",
                "type": "NarrativeText",
                "norm_text": "Paragraph four.",
                "flags": [],
                "heading_path": ["1. Intro"],
                "metadata": {"page_number": 1},
                "source_index": 4,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf", max_paragraphs_per_unit=3)
        assert len(units) == 2
        assert "Paragraph one." in units[0].embed_text
        assert "Paragraph four." in units[1].embed_text

    def test_table_is_standalone_unit(self):
        elements = [
            {
                "element_id": "h1",
                "type": "Title",
                "norm_text": "Table section",
                "flags": ["heading", "title"],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "Before table.",
                "flags": [],
                "heading_path": ["Table section"],
                "metadata": {"page_number": 1},
                "source_index": 1,
            },
            {
                "element_id": "t1",
                "type": "Table",
                "norm_text": "A | B\nC | D",
                "flags": ["table"],
                "heading_path": ["Table section"],
                "metadata": {"page_number": 1},
                "source_index": 2,
            },
            {
                "element_id": "p2",
                "type": "NarrativeText",
                "norm_text": "After table.",
                "flags": [],
                "heading_path": ["Table section"],
                "metadata": {"page_number": 1},
                "source_index": 3,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf")
        assert len(units) == 3
        assert units[1].embed_text == "A | B\nC | D"

    def test_language_split(self):
        elements = [
            {
                "element_id": "h1",
                "type": "Title",
                "norm_text": "Mixed heading",
                "flags": ["heading"],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            },
            {
                "element_id": "en1",
                "type": "NarrativeText",
                "norm_text": "The Minister may decide.",
                "flags": [],
                "heading_path": ["Mixed heading"],
                "metadata": {"page_number": 1},
                "source_index": 1,
            },
            {
                "element_id": "fr1",
                "type": "NarrativeText",
                "norm_text": "L'article 34 de la loi s'applique.",
                "flags": [],
                "heading_path": ["Mixed heading"],
                "metadata": {"page_number": 1},
                "source_index": 2,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf")
        assert len(units) == 2
        assert {u.language for u in units} == {"en", "fr"}


class TestBuildUnitsWrapper:
    def test_legislation_mode(self):
        elements = [
            {
                "element_id": "el1",
                "type": "NarrativeText",
                "norm_text": "34 (1) The Minister may",
                "flags": ["heading"],
                "heading_path": ["IRPA"],
                "metadata": {"page_number": 1, "filename": "irpa.pdf"},
                "source_index": 0,
            }
        ]
        units, errors = build_units(elements, "legislation_mode", "irpa.pdf")
        assert len(units) >= 1
        assert all(unit.doc_type == "legislation" for unit in units)
        assert isinstance(errors, list)

    def test_policy_mode(self):
        elements = [
            {
                "element_id": "el1",
                "type": "NarrativeText",
                "norm_text": "Some policy content",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            }
        ]
        units, errors = build_units(elements, "policy_mode", "enf01.pdf")
        assert len(units) == 1
        assert units[0].doc_type == "policy"
        assert errors == []


class TestPolicyUnitizationV2:
    def test_heading_path_includes_current_title(self):
        elements = [
            {
                "element_id": "h1",
                "type": "Title",
                "norm_text": "12.5.2 Referral to the CCMS service provider",
                "flags": ["heading", "title"],
                "heading_path": ["12 Enforcement", "12.5 Referrals"],
                "metadata": {"page_number": 7},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "Referral content paragraph.",
                "flags": [],
                "heading_path": ["12 Enforcement", "12.5 Referrals"],
                "metadata": {"page_number": 7},
                "source_index": 1,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf")
        assert len(units) == 1
        assert units[0].heading_path == [
            "12 Enforcement",
            "12.5 Referrals",
            "12.5.2 Referral to the CCMS service provider",
        ]

    def test_lead_in_stub_merges_with_following_bullets(self):
        elements = [
            {
                "element_id": "h1",
                "type": "NarrativeText",
                "norm_text": "12.5.2 Decision factors",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "The decision-maker should take into account these factors:",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 1,
            },
            {
                "element_id": "p2",
                "type": "ListItem",
                "norm_text": "- urgency of the case",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 2,
            },
            {
                "element_id": "p3",
                "type": "ListItem",
                "norm_text": "- impact on service delivery",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 3,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf")
        assert len(units) == 1
        assert "take into account these factors:" in units[0].embed_text
        assert "- urgency of the case" in units[0].embed_text
        assert "- impact on service delivery" in units[0].embed_text

    def test_bullet_aggregation_stops_at_next_numbered_heading(self):
        elements = [
            {
                "element_id": "h1",
                "type": "NarrativeText",
                "norm_text": "12.5.2 Program objectives",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "Program objectives include:",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 1,
            },
            {
                "element_id": "p2",
                "type": "ListItem",
                "norm_text": "• speed",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 2,
            },
            {
                "element_id": "p3",
                "type": "ListItem",
                "norm_text": "• consistency",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 3,
            },
            {
                "element_id": "h2",
                "type": "NarrativeText",
                "norm_text": "12.5.3 Escalation",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 4,
            },
            {
                "element_id": "p4",
                "type": "NarrativeText",
                "norm_text": "Escalation requires manager review.",
                "flags": [],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 5,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf")
        assert len(units) == 2
        assert "Program objectives include:" in units[0].embed_text
        assert "Escalation requires manager review." in units[1].embed_text
        assert units[0].heading_path[-1] == "12.5.2 Program objectives"
        assert units[1].heading_path[-1] == "12.5.3 Escalation"

    def test_token_cap_split_is_deterministic(self):
        long_item = "- " + ("x" * 260)
        elements = [
            {
                "element_id": "h1",
                "type": "Title",
                "norm_text": "Decision factors",
                "flags": ["heading", "title"],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "The following factors apply:",
                "flags": [],
                "heading_path": ["Decision factors"],
                "metadata": {"page_number": 1},
                "source_index": 1,
            },
            {
                "element_id": "p2",
                "type": "ListItem",
                "norm_text": long_item,
                "flags": [],
                "heading_path": ["Decision factors"],
                "metadata": {"page_number": 1},
                "source_index": 2,
            },
            {
                "element_id": "p3",
                "type": "ListItem",
                "norm_text": long_item,
                "flags": [],
                "heading_path": ["Decision factors"],
                "metadata": {"page_number": 1},
                "source_index": 3,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf", max_paragraphs_per_unit=8, max_tokens_per_unit=120)
        assert len(units) == 2
        assert all(unit.estimated_tokens <= 120 for unit in units)

    def test_scope_tagging_and_non_embed(self):
        elements = [
            {
                "element_id": "h1",
                "type": "Title",
                "norm_text": "Glossary",
                "flags": ["heading", "title"],
                "heading_path": [],
                "metadata": {"page_number": 1},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "IRPA means Immigration and Refugee Protection Act.",
                "flags": [],
                "heading_path": ["Glossary"],
                "metadata": {"page_number": 1},
                "source_index": 1,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf")
        assert len(units) == 1
        assert units[0].scope == "glossary"
        assert units[0].unit_type == "glossary"
        assert units[0].non_embed is True
        assert units[0].authority_level_num == 0

    def test_policy_unit_extracts_cross_references(self):
        elements = [
            {
                "element_id": "h1",
                "type": "Title",
                "norm_text": "References",
                "flags": ["heading", "title"],
                "heading_path": [],
                "metadata": {"page_number": 2},
                "source_index": 0,
            },
            {
                "element_id": "p1",
                "type": "NarrativeText",
                "norm_text": "See A63(5), IRPR 200(1)(b), and IRPA s.34(1)(c).",
                "flags": [],
                "heading_path": ["References"],
                "metadata": {"page_number": 2},
                "source_index": 1,
            },
        ]
        units = build_policy_units(elements, "enf01.pdf")
        assert len(units) == 1
        assert "IRPA:63(5)" in units[0].cross_references
        assert "IRPA:34(1)(c)" in units[0].cross_references
        assert "IRPR:200(1)(b)" in units[0].cross_references
