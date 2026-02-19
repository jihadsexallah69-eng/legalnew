#!/usr/bin/env python3
import re
from dataclasses import dataclass, field
from typing import Any


SECTION_WITH_INSTRUMENT_RE = re.compile(
    r"^(IRPA|IRPR)\s*:?\s*(\d+(?:\.\d+)*)\.?\s*(?:\((\d+)\))?\s*(?:\(([a-z0-9]+)\))?\s+(.*)$",
    re.IGNORECASE,
)
SECTION_RE = re.compile(
    r"^(\d+(?:\.\d+)*)\.?\s*(?:\((\d+)\))?\s*(?:\(([a-z0-9]+)\))?\s+(.*)$",
    re.IGNORECASE,
)
PARAGRAPH_RE = re.compile(r"^\(([a-z0-9]+)\)\s+(.*)$", re.IGNORECASE)
SUBPARAGRAPH_RE = re.compile(r"^\(([ivxlcdm]+)\)\s+(.*)$", re.IGNORECASE)


@dataclass
class ParsedClause:
    canonical_key: str
    section: str | None
    subsection: str | None
    paragraph: str | None
    subparagraph: str | None
    text: str
    level: int
    element_ids: list[str] = field(default_factory=list)
    parse_error: str | None = None


class LegislationParser:
    def __init__(self) -> None:
        self.current_instrument: str | None = None
        self.current_section: str | None = None
        self.current_subsection: str | None = None
        self.current_paragraph: str | None = None
        self.current_subparagraph: str | None = None
        self.buffer: list[str] = []
        self.element_ids_buffer: list[str] = []

    def reset(self) -> None:
        self.__init__()

    def feed(self, element: dict[str, Any]) -> list[ParsedClause]:
        text = (element.get("norm_text", "") or "").strip()
        element_id = str(element.get("element_id", "")).strip()
        flags = element.get("flags", []) or []
        if not text:
            return []

        results: list[ParsedClause] = []
        instrument_hint = self._detect_instrument(element)

        parsed_header = self._parse_section_header(text, element_id, instrument_hint)
        if parsed_header:
            results.extend(self._flush_buffer())
            self._update_state(parsed_header)
            results.append(parsed_header)
            return results

        parsed_paragraph = self._parse_paragraph_or_subparagraph(text, element_id)
        if parsed_paragraph:
            results.extend(self._flush_buffer())
            self._update_state(parsed_paragraph)
            results.append(parsed_paragraph)
            return results

        # Standalone heading/title lines without clause numbering are context, not clause text.
        if ("heading" in flags or "title" in flags) and not any(ch.isdigit() for ch in text):
            if instrument_hint:
                self.current_instrument = instrument_hint
            return results

        # Continuation text: keep until boundary or finalize.
        self.buffer.append(text)
        self.element_ids_buffer.append(element_id)
        return results

    def _detect_instrument(self, element: dict[str, Any]) -> str | None:
        metadata = element.get("metadata", {}) or {}
        filename = str(metadata.get("filename", "")).lower()
        if "irpa" in filename:
            return "IRPA"
        if "irpr" in filename or "sor-2002-227" in filename:
            return "IRPR"

        heading_path = element.get("heading_path", []) or []
        heading_blob = " ".join(str(x) for x in heading_path).lower()
        if "irpa" in heading_blob:
            return "IRPA"
        if "irpr" in heading_blob:
            return "IRPR"

        return self.current_instrument

    def _parse_section_header(self, text: str, element_id: str, instrument_hint: str | None) -> ParsedClause | None:
        match = SECTION_WITH_INSTRUMENT_RE.match(text)
        if match:
            instrument = match.group(1).upper()
            section = match.group(2)
            subsection = match.group(3)
            paragraph = match.group(4)
            body = (match.group(5) or "").strip()
            canonical = self._canonical_key(instrument, section, subsection, paragraph, None)
            level = 3 if paragraph else (2 if subsection else 1)
            return ParsedClause(
                canonical_key=canonical,
                section=section,
                subsection=subsection,
                paragraph=paragraph.lower() if paragraph else None,
                subparagraph=None,
                text=body,
                level=level,
                element_ids=[element_id],
            )

        match = SECTION_RE.match(text)
        if not match:
            return None

        section = match.group(1)
        subsection = match.group(2)
        paragraph = match.group(3)
        body = (match.group(4) or "").strip()
        canonical = self._canonical_key(instrument_hint, section, subsection, paragraph, None)
        level = 3 if paragraph else (2 if subsection else 1)
        return ParsedClause(
            canonical_key=canonical,
            section=section,
            subsection=subsection,
            paragraph=paragraph.lower() if paragraph else None,
            subparagraph=None,
            text=body,
            level=level,
            element_ids=[element_id],
        )

    def _parse_paragraph_or_subparagraph(self, text: str, element_id: str) -> ParsedClause | None:
        if not self.current_section:
            return None

        para_match = PARAGRAPH_RE.match(text)
        if para_match:
            label = para_match.group(1).lower()
            body = (para_match.group(2) or "").strip()

            # Roman numerals are treated as subparagraphs if paragraph already set.
            subparagraph_match = SUBPARAGRAPH_RE.match(text)
            if subparagraph_match and self.current_paragraph:
                sub_label = subparagraph_match.group(1).lower()
                canonical = self._canonical_key(
                    self.current_instrument,
                    self.current_section,
                    self.current_subsection,
                    self.current_paragraph,
                    sub_label,
                )
                return ParsedClause(
                    canonical_key=canonical,
                    section=self.current_section,
                    subsection=self.current_subsection,
                    paragraph=self.current_paragraph,
                    subparagraph=sub_label,
                    text=body,
                    level=4,
                    element_ids=[element_id],
                )

            canonical = self._canonical_key(
                self.current_instrument,
                self.current_section,
                self.current_subsection,
                label,
                None,
            )
            return ParsedClause(
                canonical_key=canonical,
                section=self.current_section,
                subsection=self.current_subsection,
                paragraph=label,
                subparagraph=None,
                text=body,
                level=3,
                element_ids=[element_id],
            )

        return None

    def _canonical_key(
        self,
        instrument: str | None,
        section: str | None,
        subsection: str | None,
        paragraph: str | None,
        subparagraph: str | None,
    ) -> str:
        if not section:
            return ""

        key = section
        if subsection:
            key += f"({subsection})"
        if paragraph:
            key += f"({paragraph.lower()})"
        if subparagraph:
            key += f"({subparagraph.lower()})"
        if instrument:
            return f"{instrument}:{key}"
        return key

    def _update_state(self, parsed: ParsedClause) -> None:
        # track instrument from key prefix when available
        if ":" in parsed.canonical_key:
            self.current_instrument = parsed.canonical_key.split(":", 1)[0]

        if parsed.section:
            self.current_section = parsed.section
        if parsed.level >= 2:
            self.current_subsection = parsed.subsection
        if parsed.level >= 3:
            self.current_paragraph = parsed.paragraph
        if parsed.level >= 4:
            self.current_subparagraph = parsed.subparagraph
        else:
            self.current_subparagraph = None

        if parsed.level == 1:
            self.current_subsection = None
            self.current_paragraph = None
            self.current_subparagraph = None
        elif parsed.level == 2:
            self.current_paragraph = None
            self.current_subparagraph = None

    def _flush_buffer(self) -> list[ParsedClause]:
        if not self.buffer:
            return []

        text = " ".join(self.buffer).strip()
        element_ids = self.element_ids_buffer.copy()
        self.buffer = []
        self.element_ids_buffer = []

        if not text:
            return []

        if not self.current_section:
            return [
                ParsedClause(
                    canonical_key="",
                    section=None,
                    subsection=None,
                    paragraph=None,
                    subparagraph=None,
                    text=text,
                    level=0,
                    element_ids=element_ids,
                    parse_error="unparsed_text_without_section_context",
                )
            ]

        canonical = self._canonical_key(
            self.current_instrument,
            self.current_section,
            self.current_subsection,
            self.current_paragraph,
            self.current_subparagraph,
        )
        if not canonical:
            return [
                ParsedClause(
                    canonical_key="",
                    section=self.current_section,
                    subsection=self.current_subsection,
                    paragraph=self.current_paragraph,
                    subparagraph=self.current_subparagraph,
                    text=text,
                    level=0,
                    element_ids=element_ids,
                    parse_error="failed_to_build_canonical_key",
                )
            ]

        level = 1
        if self.current_subparagraph:
            level = 4
        elif self.current_paragraph:
            level = 3
        elif self.current_subsection:
            level = 2

        return [
            ParsedClause(
                canonical_key=canonical,
                section=self.current_section,
                subsection=self.current_subsection,
                paragraph=self.current_paragraph,
                subparagraph=self.current_subparagraph,
                text=text,
                level=level,
                element_ids=element_ids,
            )
        ]

    def finalize(self) -> list[ParsedClause]:
        results = self._flush_buffer()
        self.reset()
        return results


def parse_legislation_elements(elements: list[dict[str, Any]]) -> tuple[list[ParsedClause], list[dict[str, Any]]]:
    parser = LegislationParser()
    parsed_clauses: list[ParsedClause] = []
    errors: list[dict[str, Any]] = []

    for el in elements:
        results = parser.feed(el)
        for result in results:
            if result.parse_error:
                errors.append(
                    {
                        "element_id": el.get("element_id"),
                        "text": el.get("norm_text"),
                        "error": result.parse_error,
                        "heading_path": el.get("heading_path", []),
                    }
                )
            else:
                parsed_clauses.append(result)

    for result in parser.finalize():
        if result.parse_error:
            errors.append(
                {
                    "element_id": result.element_ids[0] if result.element_ids else None,
                    "text": result.text,
                    "error": result.parse_error,
                    "heading_path": [],
                }
            )
        else:
            parsed_clauses.append(result)

    return parsed_clauses, errors
