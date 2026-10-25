"""Reject undeclared data acquisition, unsafe sources and false certification."""
from __future__ import annotations
import importlib.util
import json
import unittest
from copy import deepcopy
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate_source_catalog.py")
spec = importlib.util.spec_from_file_location("authority_catalog", SCRIPT)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
FIXTURE = Path(__file__).resolve().parents[3] / "data/registries/tsm-cross-sector-source-catalog-v1.json"


class SourceCatalogTests(unittest.TestCase):
    def source(self):
        return json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_current_catalog_has_all_categories_and_no_claims(self):
        r = self.source()
        self.assertEqual(m.validate_catalog(r), [])
        self.assertGreaterEqual(len(r["sources"]), 18)

    def test_remote_url_injection_rejected(self):
        r = self.source()
        r["sources"][0]["url"] = "http://evil.example.com/x"
        self.assertTrue(m.validate_catalog(r))
        r["sources"][0]["url"] = "https://user:secret@www.usgs.gov/x"
        self.assertTrue(m.validate_catalog(r))

    def test_agency_cannot_be_vendor_alias(self):
        r = self.source()
        r["sources"][0]["url"] = "https://example.com"
        self.assertTrue(m.validate_catalog(r))

    def test_duplicate_source_id_rejected(self):
        r = self.source()
        r["sources"][1]["id"] = r["sources"][0]["id"]
        self.assertTrue(any("duplicate ID" in s for s in m.validate_catalog(r)))

    def test_status_escalation_rejected(self):
        r = self.source()
        r["sources"][0]["engineeringUse"] = True
        self.assertTrue(m.validate_catalog(r))
        r = self.source()
        r["executionStatus"] = "EXECUTED"
        self.assertTrue(m.validate_catalog(r))
        r = self.source()
        r["sources"][0]["sourceSha256"] = "0" * 64
        self.assertTrue(m.validate_catalog(r))

    def test_license_review_stays_explicit_for_nonpermissive_code(self):
        rows = {x["id"]: x for x in self.source()["sources"]}
        for label in ("farmos", "odm", "apsim"):
            self.assertIn(label, rows)
            self.assertIn("license" if label == "apsim" else "GPL", rows[label]["restriction"].lower() if label == "apsim" else rows[label]["restriction"])


if __name__ == "__main__":
    unittest.main()
