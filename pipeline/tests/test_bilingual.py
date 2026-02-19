from datetime import date

from pipeline.bilingual import (
    get_pairing_stats,
    pair_by_canonical_key,
    split_and_pair_units,
    split_by_language,
    validate_no_mixed_language,
)
from pipeline.schemas import LegalUnit


def make_policy_unit(unit_id: str, language: str, source_index: int = 0) -> LegalUnit:
    return LegalUnit(
        unit_id=unit_id,
        source_index=source_index,
        canonical_key=None,
        embed_text=f"Policy text {unit_id}",
        display_text=f"Policy text {unit_id}",
        language=language,
        authority_level="policy",
        instrument="ENF",
        doc_type="policy",
        filename="enf01.pdf",
        page_start=1,
        page_end=1,
        element_ids=[f"el_{unit_id}"],
        heading_path=["Document"],
    )


def make_legislation_unit(
    unit_id: str,
    language: str,
    canonical_key: str,
    source_index: int = 0,
) -> LegalUnit:
    return LegalUnit(
        unit_id=unit_id,
        source_index=source_index,
        canonical_key=canonical_key,
        embed_text=f"{canonical_key} text {unit_id}",
        display_text=f"{canonical_key} text {unit_id}",
        language=language,
        authority_level="act",
        instrument="IRPA",
        doc_type="legislation",
        filename="irpa.pdf",
        page_start=1,
        page_end=1,
        element_ids=[f"el_{unit_id}"],
        heading_path=["IRPA"],
        bilingual_group_id=canonical_key,
        translation_role="primary" if language == "en" else "parallel",
        consolidation_date=date(2026, 1, 19),
        last_amended_date=date(2025, 12, 15),
        source_snapshot_id="C-29-2026-01-19",
    )


class TestSplitByLanguage:
    def test_split(self):
        units = [
            make_policy_unit("u1", "en"),
            make_policy_unit("u2", "fr"),
            make_policy_unit("u3", "en"),
        ]
        en, fr = split_by_language(units)
        assert [u.unit_id for u in en] == ["u1", "u3"]
        assert [u.unit_id for u in fr] == ["u2"]


class TestPairByCanonicalKey:
    def test_pairs_and_unpaired(self):
        en = [
            make_legislation_unit("en1", "en", "IRPA:34(1)(a)", 1),
            make_legislation_unit("en2", "en", "IRPA:34(1)(a)", 2),
        ]
        fr = [
            make_legislation_unit("fr1", "fr", "IRPA:34(1)(a)", 3),
        ]
        paired, unpaired = pair_by_canonical_key(en, fr)
        assert len(paired) == 2
        assert len(unpaired) == 1
        assert {u.translation_role for u in paired} == {"primary", "parallel"}


class TestSplitAndPairUnits:
    def test_legislation_pairs_policy_unchanged(self):
        units = [
            make_legislation_unit("en1", "en", "IRPA:34(1)(a)", 1),
            make_legislation_unit("fr1", "fr", "IRPA:34(1)(a)", 2),
            make_policy_unit("p1", "en", 3),
        ]
        out = split_and_pair_units(units)
        assert len(out) == 3
        policy = next(u for u in out if u.unit_id == "p1")
        assert policy.translation_role is None


class TestValidateNoMixedLanguage:
    def test_valid(self):
        units = [
            make_policy_unit("u1", "en"),
            make_policy_unit("u2", "fr"),
        ]
        units[1].embed_text = "L'article 34 de la loi s'applique."
        valid, errors = validate_no_mixed_language(units)
        assert valid is True
        assert errors == []

    def test_detects_mismatch(self):
        unit = make_policy_unit("u1", "en")
        unit.embed_text = "L'article 34 de la loi s'applique."
        valid, errors = validate_no_mixed_language([unit])
        assert valid is False
        assert errors[0]["error"] == "mixed_language_mismatch"


class TestPairingStats:
    def test_stats(self):
        units = [
            make_legislation_unit("en1", "en", "IRPA:34(1)(a)", 1),
            make_legislation_unit("fr1", "fr", "IRPA:34(1)(a)", 2),
            make_policy_unit("p1", "en", 3),
        ]
        out = split_and_pair_units(units)
        stats = get_pairing_stats(out)
        assert stats["total_units"] == 3
        assert stats["legislation_units"] == 2
        assert stats["paired_keys"] == 1
