#!/usr/bin/env python3
from typing import Any

from pipeline.schemas import LegalUnit
from pipeline.unitize import detect_language


def split_by_language(units: list[LegalUnit]) -> tuple[list[LegalUnit], list[LegalUnit]]:
    english = [u for u in units if u.language == "en"]
    french = [u for u in units if u.language == "fr"]
    english.sort(key=lambda u: (u.source_index, u.unit_id))
    french.sort(key=lambda u: (u.source_index, u.unit_id))
    return english, french


def pair_by_canonical_key(
    english_units: list[LegalUnit],
    french_units: list[LegalUnit],
) -> tuple[list[LegalUnit], list[LegalUnit]]:
    paired: list[LegalUnit] = []
    unpaired: list[LegalUnit] = []

    en_by_key: dict[str, list[LegalUnit]] = {}
    fr_by_key: dict[str, list[LegalUnit]] = {}

    for unit in english_units:
        key = unit.bilingual_group_id or unit.canonical_key
        if key:
            en_by_key.setdefault(key, []).append(unit)
        else:
            unpaired.append(unit)

    for unit in french_units:
        key = unit.bilingual_group_id or unit.canonical_key
        if key:
            fr_by_key.setdefault(key, []).append(unit)
        else:
            unpaired.append(unit)

    all_keys = sorted(set(en_by_key.keys()) | set(fr_by_key.keys()))
    for key in all_keys:
        en_list = sorted(en_by_key.get(key, []), key=lambda u: (u.source_index, u.unit_id))
        fr_list = sorted(fr_by_key.get(key, []), key=lambda u: (u.source_index, u.unit_id))
        pair_count = min(len(en_list), len(fr_list))

        for idx in range(pair_count):
            en_unit = en_list[idx]
            fr_unit = fr_list[idx]
            en_unit.translation_role = "primary"
            fr_unit.translation_role = "parallel"
            en_unit.bilingual_group_id = key
            fr_unit.bilingual_group_id = key
            paired.append(en_unit)
            paired.append(fr_unit)

        for idx in range(pair_count, len(en_list)):
            en_unit = en_list[idx]
            en_unit.translation_role = "primary"
            en_unit.bilingual_group_id = key
            unpaired.append(en_unit)

        for idx in range(pair_count, len(fr_list)):
            fr_unit = fr_list[idx]
            fr_unit.translation_role = "parallel"
            fr_unit.bilingual_group_id = key
            unpaired.append(fr_unit)

    return paired, unpaired


def split_and_pair_units(units: list[LegalUnit]) -> list[LegalUnit]:
    legislation = [u for u in units if u.doc_type == "legislation"]
    non_legislation = [u for u in units if u.doc_type != "legislation"]

    en_leg, fr_leg = split_by_language(legislation)
    paired, unpaired = pair_by_canonical_key(en_leg, fr_leg)

    for unit in non_legislation:
        unit.translation_role = None

    out = paired + unpaired + non_legislation
    out.sort(key=lambda u: (u.source_index, u.unit_id))
    return out


def validate_no_mixed_language(units: list[LegalUnit]) -> tuple[bool, list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []

    for unit in units:
        if unit.language not in ("en", "fr"):
            errors.append(
                {
                    "error": "invalid_language",
                    "unit_id": unit.unit_id,
                    "language": unit.language,
                }
            )
            continue

        text = (unit.embed_text or "").strip()
        if len(text) < 10:
            continue

        detected = detect_language(text)
        if detected != unit.language:
            errors.append(
                {
                    "error": "mixed_language_mismatch",
                    "unit_id": unit.unit_id,
                    "declared_language": unit.language,
                    "detected_language": detected,
                }
            )

    return len(errors) == 0, errors


def get_pairing_stats(units: list[LegalUnit]) -> dict[str, Any]:
    english = [u for u in units if u.language == "en"]
    french = [u for u in units if u.language == "fr"]
    legislation = [u for u in units if u.doc_type == "legislation"]

    paired_keys = {
        u.bilingual_group_id
        for u in legislation
        if u.bilingual_group_id and u.translation_role in ("primary", "parallel")
    }

    return {
        "total_units": len(units),
        "legislation_units": len(legislation),
        "english_count": len(english),
        "french_count": len(french),
        "paired_keys": len(paired_keys),
    }
