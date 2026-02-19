import json
import pytest
from pathlib import Path
from pipeline.section_parser import (
    LegislationParser,
    parse_legislation_elements,
    ParsedClause,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestLegislationParser:
    def test_parse_simple_section(self):
        parser = LegislationParser()
        
        el = {
            "element_id": "el1",
            "norm_text": "34 (1) The Minister may",
            "flags": ["heading"],
            "heading_path": ["IRPA"],
        }
        
        results = parser.feed(el)
        
        assert len(results) >= 1
        assert results[0].canonical_key == "IRPA:34(1)"
        assert results[0].section == "34"
        assert results[0].subsection == "1"

    def test_parse_nested_subsection(self):
        parser = LegislationParser()
        results = []

        results.extend(parser.feed({
            "element_id": "el1",
            "norm_text": "15.1 (1) The Regulations",
            "flags": ["heading"],
            "heading_path": ["IRPR"],
        }))

        results.extend(parser.feed({
            "element_id": "el2",
            "norm_text": "(a) in the case of the initial set",
            "flags": [],
            "heading_path": ["IRPR", "15.1"],
        }))

        results.extend(parser.finalize())
        
        clause = next((r for r in results if r.level == 3), None)
        assert clause is not None
        assert clause.canonical_key == "IRPR:15.1(1)(a)"
        assert clause.subsection == "1"
        assert clause.paragraph == "a"

    def test_parse_paragraph_level(self):
        parser = LegislationParser()
        results = []

        results.extend(parser.feed({
            "element_id": "el1",
            "norm_text": "34 (1) The Minister",
            "flags": ["heading"],
            "heading_path": ["IRPA"],
        }))

        results.extend(parser.feed({
            "element_id": "el2",
            "norm_text": "(a) serious crime provision",
            "flags": [],
            "heading_path": ["IRPA", "34"],
        }))

        results.extend(parser.finalize())
        
        clause = next((r for r in results if r.level == 3), None)
        assert clause is not None
        assert clause.canonical_key == "IRPA:34(1)(a)"
        assert clause.subsection == "1"
        assert clause.paragraph == "a"

    def test_finalize_flushes_buffer(self):
        parser = LegislationParser()
        
        results = parser.feed({
            "element_id": "el1",
            "norm_text": "34 (1) Main text",
            "flags": ["heading"],
            "heading_path": ["IRPA"],
        })
        
        assert len(results) >= 1
        assert results[0].canonical_key == "IRPA:34(1)"

    def test_irpa_explicit_keyword(self):
        parser = LegislationParser()
        
        el = {
            "element_id": "el1",
            "norm_text": "IRPA:36(1) Serious criminality",
            "flags": ["heading"],
            "heading_path": ["IRPA"],
        }
        
        results = parser.feed(el)
        
        assert len(results) >= 1
        assert "IRPA" in results[0].canonical_key

    def test_parse_without_heading_flag(self):
        parser = LegislationParser()

        el = {
            "element_id": "el1",
            "norm_text": "34. (1) A permanent resident is inadmissible",
            "flags": [],
            "heading_path": ["IRPA"],
            "metadata": {"filename": "irpa.pdf"},
        }

        results = parser.feed(el)

        assert len(results) == 1
        assert results[0].canonical_key == "IRPA:34(1)"


class TestParseLegislationElements:
    def test_parse_irpa_fixture(self):
        with open(FIXTURES_DIR / "irpa_irpr_sample.json") as f:
            elements = json.load(f)
        
        clauses, errors = parse_legislation_elements(elements)
        
        assert len(clauses) > 0
        
        keys = [c.canonical_key for c in clauses]
        assert "IRPA:34(1)" in keys
        assert "IRPA:34(2)" in keys
        assert "IRPR:15.1(1)" in keys
        
        assert len(errors) == 0

    def test_parse_enf_fixture(self):
        with open(FIXTURES_DIR / "enf_sample.json") as f:
            elements = json.load(f)
        
        clauses, errors = parse_legislation_elements(elements)
        
        assert len(clauses) > 0
        
        for clause in clauses:
            assert clause.canonical_key is not None

    def test_empty_elements(self):
        clauses, errors = parse_legislation_elements([])
        assert len(clauses) == 0
        assert len(errors) == 0

    def test_non_legislation_elements(self):
        elements = [
            {
                "element_id": "el1",
                "norm_text": "Some policy text without section numbers",
                "flags": [],
                "heading_path": ["Chapter 1"],
            }
        ]
        
        clauses, errors = parse_legislation_elements(elements)
        
        assert len(clauses) == 0
        assert len(errors) == 1
        assert errors[0]["error"] == "unparsed_text_without_section_context"


class TestParsedClause:
    def test_canonical_key_format(self):
        clause = ParsedClause(
            canonical_key="34(1)(c)",
            section="34",
            subsection="1",
            paragraph="c",
            subparagraph=None,
            text="test",
            level=3,
        )
        
        assert clause.canonical_key == "34(1)(c)"
        assert clause.section == "34"
        assert clause.subsection == "1"
        assert clause.paragraph == "c"
        assert clause.level == 3
