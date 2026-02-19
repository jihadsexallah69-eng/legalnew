from pipeline.references import extract_cross_references


class TestExtractCrossReferences:
    def test_extracts_shorthand_refs(self):
        text = "Grounds under A34(1)(c) and R200(1)(b) apply."
        refs = extract_cross_references(text, "UNKNOWN")
        assert "IRPA:34(1)(c)" in refs
        assert "IRPR:200(1)(b)" in refs

    def test_extracts_explicit_irpa_irpr_s_variants(self):
        text = "See IRPA s. 63(5), IRPA s.34(1)(c), and IRPR 200(1)(b)."
        refs = extract_cross_references(text, "UNKNOWN")
        assert "IRPA:63(5)" in refs
        assert "IRPA:34(1)(c)" in refs
        assert "IRPR:200(1)(b)" in refs

    def test_extracts_section_only_with_context_instrument(self):
        text = "As required by s.63(5) and s.34(1)(c)."
        refs = extract_cross_references(text, "IRPA")
        assert refs == ["IRPA:34(1)(c)", "IRPA:63(5)"]

    def test_extracts_section_only_with_inferred_instrument(self):
        text = "Under IRPA, see s.63(5) for appeals."
        refs = extract_cross_references(text, "UNKNOWN")
        assert "IRPA:63(5)" in refs

    def test_deduplicates_and_sorts(self):
        text = "A34(1)(c); IRPA s.34(1)(c); s.34(1)(c)."
        refs = extract_cross_references(text, "IRPA")
        assert refs == ["IRPA:34(1)(c)"]
