#!/usr/bin/env python3
import re
from typing import Any
from bs4 import BeautifulSoup


DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PAGE_NUMBER_PATTERN = re.compile(r"^Page\s+\d+\s+of\s+\d+$", re.IGNORECASE)
FOOTER_KEYWORDS = {"footer", "page", "page number", "confidential", "draft"}
HEADING_REGEX = re.compile(r"^(?:\d+)(?:\.\d+){1,}\s+\S+")


def normalize_text(text: str | None) -> str | None:
    if text is None:
        return None
    
    normalized = text.strip()
    normalized = re.sub(r"-\s*\n\s*(\w)", r"\1", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    
    return normalized if normalized else None


def parse_table_html(html: str) -> str:
    try:
        soup = BeautifulSoup(html, "lxml")
        rows = soup.find_all("tr")
        
        result_lines = []
        for row in rows:
            cells = row.find_all(["td", "th"])
            cell_texts = []
            for cell in cells:
                cell_text = re.sub(r"\s+", " ", cell.get_text(" ", strip=True)).strip()
                if cell_text:
                    cell_texts.append(cell_text)
            if cell_texts:
                result_lines.append(" | ".join(cell_texts))
        
        return "\n".join(result_lines)
    except Exception:
        return ""


def get_table_html(element: dict[str, Any]) -> str | None:
    top_level = element.get("text_as_html")
    if isinstance(top_level, str) and top_level.strip():
        return top_level

    metadata = element.get("metadata", {}) or {}
    metadata_level = metadata.get("text_as_html")
    if isinstance(metadata_level, str) and metadata_level.strip():
        return metadata_level

    # Optional nested support: metadata.orig_elements[*].text_as_html
    orig_elements = metadata.get("orig_elements")
    if isinstance(orig_elements, list):
        for item in orig_elements:
            if not isinstance(item, dict):
                continue
            nested = item.get("text_as_html")
            if isinstance(nested, str) and nested.strip():
                return nested

    return None


def is_footer_text(text: str) -> bool:
    text_lower = text.lower().strip()
    
    if DATE_PATTERN.match(text_lower):
        return True
    
    if PAGE_NUMBER_PATTERN.match(text_lower):
        return True
    
    tokens = set(re.split(r"\s+", text_lower))
    if tokens & FOOTER_KEYWORDS and len(tokens) <= 5:
        return True
    
    return False


def extract_metadata_candidates(metadata: dict[str, Any], text: str) -> dict[str, Any]:
    candidates = {}
    
    if "page_number" in metadata:
        candidates["page_number"] = metadata["page_number"]
    
    if "filename" in metadata:
        candidates["filename"] = metadata["filename"]
    
    date_match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    if date_match:
        candidates["extracted_date"] = date_match.group(0)
    
    return candidates


def normalize_elements(structured: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    
    for el in structured:
        element_type = el.get("type", "")
        text = el.get("text")
        metadata = el.get("metadata", {})
        
        norm_text = normalize_text(text)
        
        flags: list[str] = []
        non_embed = False
        metadata_candidates = extract_metadata_candidates(metadata, text or "")
        
        if element_type == "Footer":
            flags.append("footer")
            non_embed = True
        
        if element_type == "Header":
            flags.append("header")
        
        if element_type == "Title":
            flags.append("heading")
            flags.append("title")
        
        if norm_text and not any(f in flags for f in ("heading", "title")):
            if HEADING_REGEX.match(norm_text):
                flags.append("heading")
                flags.append("inferred")

        if norm_text and is_footer_text(norm_text):
            if "footer" not in flags:
                flags.append("footer")
            if "page_number" not in str(metadata_candidates):
                page_match = re.search(r"(\d+)", norm_text)
                if page_match:
                    metadata_candidates["inferred_page"] = int(page_match.group(1))
            non_embed = True
        
        if element_type == "Table":
            flags.append("table")
            table_html = get_table_html(el)
            if table_html:
                metadata_candidates["raw_table_html"] = table_html
                table_text = parse_table_html(table_html)
                if table_text and norm_text:
                    norm_text = table_text + "\n" + norm_text
                elif table_text:
                    norm_text = table_text
            else:
                flags.append("table_html_missing")
        
        normalized.append({
            **el,
            "norm_text": norm_text,
            "non_embed": non_embed,
            "flags": flags,
            "metadata_candidates": metadata_candidates,
        })
    
    return normalized


def validate_normalized(elements: list[dict[str, Any]]) -> tuple[bool, list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    
    for el in elements:
        eid = el.get("element_id")
        
        if el.get("norm_text") is None and el.get("type") != "Table":
            errors.append({
                "error": "missing_norm_text",
                "element_id": eid,
                "type": el.get("type"),
            })
        
        if not isinstance(el.get("flags", []), list):
            errors.append({
                "error": "invalid_flags_type",
                "element_id": eid,
            })
    
    return len(errors) == 0, errors
