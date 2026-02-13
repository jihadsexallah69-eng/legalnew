#!/usr/bin/env python3
from __future__ import annotations

import base64
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from url_utils import canonicalize_url


class CanonicalizeUrlTests(unittest.TestCase):
    def test_unwraps_percent_encoded_redirect_param(self) -> None:
        wrapped = (
            "https://example.com/redirect"
            "?url=https%3A%2F%2Fwww.canada.ca%2Fen%2Fimmigration-refugees-citizenship.html%3Fb%3D2%26a%3D1"
            "&utm_source=test"
        )
        out = canonicalize_url(wrapped)
        self.assertEqual(
            out,
            "https://www.canada.ca/en/immigration-refugees-citizenship.html?a=1&b=2",
        )

    def test_unwraps_nested_wrappers(self) -> None:
        level1 = (
            "https://wrapper-one.example/path"
            "?redirect=https%3A%2F%2Fwww.canada.ca%2Fen%2Fimmigration-refugees-citizenship%2Fservices.html"
        )
        level2 = f"https://wrapper-two.example/out?url={level1}"
        out = canonicalize_url(level2)
        self.assertEqual(
            out,
            "https://www.canada.ca/en/immigration-refugees-citizenship/services.html",
        )

    def test_unwraps_base64_url_param(self) -> None:
        target = "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html"
        encoded = base64.urlsafe_b64encode(target.encode("utf-8")).decode("ascii").rstrip("=")
        wrapped = f"https://example.com/exit?u={encoded}"
        out = canonicalize_url(wrapped)
        self.assertEqual(out, target)

    def test_resolves_relative_and_drops_tracking(self) -> None:
        out = canonicalize_url(
            "/en/immigration-refugees-citizenship/services/visit-canada.html?utm_medium=email&a=1",
            base_url="https://www.canada.ca",
        )
        self.assertEqual(
            out,
            "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html?a=1",
        )


if __name__ == "__main__":
    unittest.main()
