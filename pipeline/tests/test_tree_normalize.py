import json
import pytest
from pathlib import Path
from pipeline.element_tree import build_tree, validate_tree
from pipeline.normalize import (
    normalize_elements,
    normalize_text,
    is_footer_text,
    validate_normalized,
    parse_table_html,
    get_table_html,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestBuildTree:
    def test_empty_input(self):
        result = build_tree([])
        assert result == []

    def test_single_element(self):
        raw = [{"element_id": "el1", "type": "Text", "text": "Hello"}]
        result = build_tree(raw)
        assert len(result) == 1
        assert result[0]["element_id"] == "el1"
        assert result[0]["root_id"] == "el1"
        assert result[0]["parent_chain"] == []

    def test_parent_child_relationship(self):
        raw = [
            {"element_id": "root", "type": "Title", "text": "Root", "metadata": {}},
            {"element_id": "child1", "type": "Text", "text": "Child 1", "metadata": {"parent_id": "root"}},
            {"element_id": "child2", "type": "Text", "text": "Child 2", "metadata": {"parent_id": "root"}},
        ]
        result = build_tree(raw)
        
        root = next(e for e in result if e["element_id"] == "root")
        child1 = next(e for e in result if e["element_id"] == "child1")
        
        assert root["root_id"] == "root"
        assert child1["root_id"] == "root"
        assert child1["parent_chain"] == ["root"]

    def test_parent_child_out_of_order(self):
        raw = [
            {"element_id": "child", "type": "Text", "text": "Child", "metadata": {"parent_id": "root"}},
            {"element_id": "root", "type": "Title", "text": "Root", "metadata": {}},
        ]
        result = build_tree(raw)
        child = next(e for e in result if e["element_id"] == "child")
        assert child["root_id"] == "root"
        assert child["parent_chain"] == ["root"]

    def test_multiple_roots_assign_correct_root_id(self):
        raw = [
            {"element_id": "r1", "type": "Title", "text": "R1", "metadata": {}},
            {"element_id": "r2", "type": "Title", "text": "R2", "metadata": {}},
            {"element_id": "c2", "type": "Text", "text": "C2", "metadata": {"parent_id": "r2"}},
        ]
        result = build_tree(raw)
        c2 = next(e for e in result if e["element_id"] == "c2")
        assert c2["root_id"] == "r2"
        assert c2["parent_chain"] == ["r2"]

    def test_heading_path(self):
        raw = [
            {"element_id": "ch1", "type": "Title", "text": "Chapter 1", "metadata": {}},
            {"element_id": "sec1", "type": "Title", "text": "Section 1.1", "metadata": {"parent_id": "ch1"}},
            {"element_id": "text1", "type": "NarrativeText", "text": "Some text", "metadata": {"parent_id": "sec1"}},
        ]
        result = build_tree(raw)
        
        text_el = next(e for e in result if e["element_id"] == "text1")
        assert "Chapter 1" in text_el["heading_path"]
        assert "Section 1.1" in text_el["heading_path"]

    def test_source_index_ordering(self):
        raw = [
            {"element_id": "b", "type": "Text", "text": "B"},
            {"element_id": "a", "type": "Text", "text": "A"},
            {"element_id": "c", "type": "Text", "text": "C"},
        ]
        result = build_tree(raw)
        
        assert result[0]["element_id"] == "b"
        assert result[1]["element_id"] == "a"
        assert result[2]["element_id"] == "c"


class TestValidateTree:
    def test_valid_tree(self):
        raw = [{"element_id": "el1", "type": "Text", "text": "Hello"}]
        tree = build_tree(raw)
        valid, errors = validate_tree(tree)
        assert valid is True
        assert errors == []

    def test_duplicate_id(self):
        raw = [
            {"element_id": "el1", "type": "Text", "text": "Hello"},
            {"element_id": "el1", "type": "Text", "text": "World"},
        ]
        with pytest.raises(ValueError):
            build_tree(raw)


class TestNormalizeText:
    def test_whitespace_normalization(self):
        assert normalize_text("  Hello   World  ") == "Hello World"
        assert normalize_text("A\n\nB") == "A B"

    def test_hyphenation(self):
        assert normalize_text("break-\nfast") == "breakfast"
        assert normalize_text("some-\ntext") == "sometext"

    def test_none_input(self):
        assert normalize_text(None) is None


class TestIsFooterText:
    def test_date_pattern(self):
        assert is_footer_text("2024-01-15") is True

    def test_page_number_pattern(self):
        assert is_footer_text("Page 1 of 10") is True
        assert is_footer_text("Page 5 of 15") is True

    def test_footer_keywords(self):
        assert is_footer_text("Confidential") is True
        assert is_footer_text("Page") is True
        assert is_footer_text("Draft - Internal Use Only") is True

    def test_normal_text(self):
        assert is_footer_text("This is normal content") is False
        assert is_footer_text("Section 1: Introduction") is False


class TestNormalizeElements:
    def test_footer_marked_non_embed(self):
        structured = [
            {"element_id": "f1", "type": "Footer", "text": "Page 1 of 10", "metadata": {}, "source_index": 0, "parent_chain": [], "heading_path": [], "root_id": "f1"},
        ]
        result = normalize_elements(structured)
        assert result[0]["non_embed"] is True
        assert "footer" in result[0]["flags"]

    def test_title_marked_as_heading(self):
        structured = [
            {"element_id": "t1", "type": "Title", "text": "Chapter 1", "metadata": {}, "source_index": 0, "parent_chain": [], "heading_path": [], "root_id": "t1"},
        ]
        result = normalize_elements(structured)
        assert "heading" in result[0]["flags"]
        assert "title" in result[0]["flags"]

    def test_metadata_candidates(self):
        structured = [
            {"element_id": "el1", "type": "NarrativeText", "text": "Content", "metadata": {"page_number": 5, "filename": "test.pdf"}, "source_index": 0, "parent_chain": [], "heading_path": [], "root_id": "el1"},
        ]
        result = normalize_elements(structured)
        assert result[0]["metadata_candidates"]["page_number"] == 5
        assert result[0]["metadata_candidates"]["filename"] == "test.pdf"

    def test_table_html_top_level_priority(self):
        structured = [
            {
                "element_id": "tbl1",
                "type": "Table",
                "text": "fallback",
                "text_as_html": "<table><tr><td>A</td><td>B</td></tr></table>",
                "metadata": {"text_as_html": "<table><tr><td>X</td></tr></table>"},
                "source_index": 0,
                "parent_chain": [],
                "heading_path": [],
                "root_id": "tbl1",
            }
        ]
        result = normalize_elements(structured)
        assert "A | B" in (result[0]["norm_text"] or "")
        assert result[0]["metadata_candidates"]["raw_table_html"].startswith("<table>")

    def test_table_html_missing_flag(self):
        structured = [
            {
                "element_id": "tbl2",
                "type": "Table",
                "text": "plain table text",
                "metadata": {},
                "source_index": 0,
                "parent_chain": [],
                "heading_path": [],
                "root_id": "tbl2",
            }
        ]
        result = normalize_elements(structured)
        assert "table_html_missing" in result[0]["flags"]
        assert result[0]["norm_text"] == "plain table text"

    def test_enf_fixture(self):
        with open(FIXTURES_DIR / "enf_sample.json") as f:
            elements = json.load(f)
        
        tree = build_tree(elements)
        normalized = normalize_elements(tree)
        
        footers = [el for el in normalized if el.get("type") == "Footer"]
        assert len(footers) > 0
        for footer in footers:
            assert footer["non_embed"] is True
            assert "footer" in footer["flags"]


class TestValidateNormalized:
    def test_valid_normalized(self):
        normalized = [
            {"element_id": "el1", "type": "NarrativeText", "norm_text": "Some text", "flags": []},
        ]
        valid, errors = validate_normalized(normalized)
        assert valid is True

    def test_missing_text(self):
        normalized = [
            {"element_id": "el1", "type": "NarrativeText", "norm_text": None, "flags": []},
        ]
        valid, errors = validate_normalized(normalized)
        assert valid is False


class TestParseTableHtml:
    def test_simple_table(self):
        html = "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>"
        result = parse_table_html(html)
        assert "A | B" in result
        assert "C | D" in result

    def test_empty_html(self):
        assert parse_table_html("") == ""
        assert parse_table_html("<table></table>") == ""


class TestGetTableHtml:
    def test_priority_top_level(self):
        element = {
            "text_as_html": "<table><tr><td>top</td></tr></table>",
            "metadata": {"text_as_html": "<table><tr><td>meta</td></tr></table>"},
        }
        assert "top" in (get_table_html(element) or "")

    def test_nested_orig_elements(self):
        element = {
            "metadata": {
                "orig_elements": [
                    {"text_as_html": "<table><tr><td>nested</td></tr></table>"},
                ]
            }
        }
        assert "nested" in (get_table_html(element) or "")
