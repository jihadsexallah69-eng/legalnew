#!/usr/bin/env python3
import re
from typing import Any


SHORTHAND_REF_RE = re.compile(
    r"\b([AR])\s*(\d+(?:\.\d+)?)(\s*(?:\([a-zA-Z0-9]+\))*)",
    re.IGNORECASE,
)
EXPLICIT_REF_RE = re.compile(
    r"\b(IRPA|IRPR)\b\s*(?:(?:s|sec|section)\.?\s*)?(\d+(?:\.\d+)?)(\s*(?:\([a-zA-Z0-9]+\))*)",
    re.IGNORECASE,
)
SECTION_REF_RE = re.compile(
    r"\bs(?:ection)?\.?\s*(\d+(?:\.\d+)?)(\s*(?:\([a-zA-Z0-9]+\))*)",
    re.IGNORECASE,
)


def _extract_labels(suffix: str) -> list[str]:
    return [token.lower() for token in re.findall(r"\(([a-zA-Z0-9]+)\)", suffix or "")]


def _canonical_key(instrument: str, section: str, suffix: str = "") -> str:
    labels = _extract_labels(suffix)
    tail = "".join(f"({label})" for label in labels)
    return f"{instrument}:{section}{tail}"


def _infer_instrument_from_text(text: str, context_instrument: str) -> str | None:
    if context_instrument in ("IRPA", "IRPR"):
        return context_instrument

    has_irpa = bool(re.search(r"\bIRPA\b", text or "", re.IGNORECASE))
    has_irpr = bool(re.search(r"\bIRPR\b", text or "", re.IGNORECASE))
    if has_irpa and not has_irpr:
        return "IRPA"
    if has_irpr and not has_irpa:
        return "IRPR"
    return None


def extract_cross_references(text: str, context_instrument: str = "UNKNOWN") -> list[str]:
    if not text:
        return []

    refs: set[str] = set()

    for match in SHORTHAND_REF_RE.finditer(text):
        instrument = "IRPA" if match.group(1).upper() == "A" else "IRPR"
        refs.add(_canonical_key(instrument, match.group(2), match.group(3) or ""))

    for match in EXPLICIT_REF_RE.finditer(text):
        refs.add(_canonical_key(match.group(1).upper(), match.group(2), match.group(3) or ""))

    inferred_instrument = _infer_instrument_from_text(text, context_instrument)
    if inferred_instrument:
        for match in SECTION_REF_RE.finditer(text):
            refs.add(_canonical_key(inferred_instrument, match.group(1), match.group(2) or ""))

    return sorted(refs)


def extract_all_cross_references(units: list[Any]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    
    for unit in units:
        embed_text = getattr(unit, "embed_text", "") or ""
        instrument = getattr(unit, "instrument", "UNKNOWN")
        
        refs = extract_cross_references(embed_text, instrument)
        
        for ref in refs:
            edges.append({
                "from_unit_id": getattr(unit, "unit_id", ""),
                "to_canonical_key": ref,
            })
    
    return edges
