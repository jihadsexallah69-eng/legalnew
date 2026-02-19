from datetime import date

from llama_index.core.schema import TextNode

from pipeline.nodes import unit_to_node, units_to_nodes
from pipeline.schemas import LegalUnit


def make_legislation_unit(unit_id: str, source_index: int) -> LegalUnit:
    return LegalUnit(
        unit_id=unit_id,
        source_index=source_index,
        canonical_key="IRPA:34(1)(a)",
        embed_text="IRPA:34(1)(a): on grounds of security.",
        display_text="**IRPA:34(1)(a)** on grounds of security.",
        language="en",
        authority_level="act",
        instrument="IRPA",
        doc_type="legislation",
        filename="irpa.pdf",
        page_start=10,
        page_end=10,
        element_ids=["el1"],
        heading_path=["IRPA", "Section 34"],
        bilingual_group_id="IRPA:34(1)(a)",
        translation_role="primary",
        consolidation_date=date(2026, 1, 19),
        last_amended_date=date(2025, 12, 15),
        source_snapshot_id="C-29-2026-01-19",
    )


def make_policy_unit(unit_id: str, source_index: int) -> LegalUnit:
    return LegalUnit(
        unit_id=unit_id,
        source_index=source_index,
        canonical_key=None,
        embed_text="Operational guidance paragraph.",
        display_text="Operational guidance paragraph.",
        language="en",
        authority_level="policy",
        instrument="ENF",
        doc_type="policy",
        filename="enf01.pdf",
        page_start=1,
        page_end=1,
        element_ids=["el2"],
        heading_path=["ENF 1", "Objectives"],
    )


class TestUnitToNode:
    def test_legislation_metadata_parity(self):
        unit = make_legislation_unit("u1", 5)
        node = unit_to_node(unit)

        assert isinstance(node, TextNode)
        assert node.id_ == "u1"
        assert node.text.startswith("IRPA:34(1)(a)")

        md = node.metadata
        assert md["schema_version"] == "1.0.0"
        assert md["source_index"] == 5
        assert md["canonical_key"] == "IRPA:34(1)(a)"
        assert md["language"] == "en"
        assert md["authority_level"] == "act"
        assert md["instrument"] == "IRPA"
        assert md["doc_type"] == "legislation"
        assert md["filename"] == "irpa.pdf"
        assert md["page_start"] == 10
        assert md["page_end"] == 10
        assert md["element_ids"] == ["el1"]
        assert md["heading_path"] == ["IRPA", "Section 34"]
        assert md["bilingual_group_id"] == "IRPA:34(1)(a)"
        assert md["translation_role"] == "primary"
        assert md["consolidation_date"] == "2026-01-19"
        assert md["last_amended_date"] == "2025-12-15"
        assert md["source_snapshot_id"] == "C-29-2026-01-19"

    def test_policy_metadata_parity(self):
        unit = make_policy_unit("u2", 2)
        node = unit_to_node(unit)

        md = node.metadata
        assert md["schema_version"] == "1.0.0"
        assert md["source_index"] == 2
        assert md["canonical_key"] is None
        assert md["doc_type"] == "policy"
        assert "bilingual_group_id" not in md
        assert "consolidation_date" not in md

    def test_fallback_to_display_text_when_embed_empty(self):
        unit = make_policy_unit("u3", 3)
        unit.embed_text = " "
        unit.display_text = "Display fallback text"
        node = unit_to_node(unit)
        assert node.text == "Display fallback text"


class TestUnitsToNodes:
    def test_deterministic_source_index_order(self):
        units = [
            make_policy_unit("u2", 2),
            make_legislation_unit("u1", 1),
            make_policy_unit("u3", 3),
        ]
        nodes = units_to_nodes(units)
        assert [node.id_ for node in nodes] == ["u1", "u2", "u3"]
        assert [node.metadata["source_index"] for node in nodes] == [1, 2, 3]
