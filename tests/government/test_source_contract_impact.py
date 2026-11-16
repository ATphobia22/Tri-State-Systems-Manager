#!/usr/bin/env python3
"""Deterministic offline contract-drift tests; not agency-data acceptance."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scripts/government/source_contract_impact.py"
spec = importlib.util.spec_from_file_location("source_contract_impact", SOURCE)
mod = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(mod)


class SourceContractImpactTests(unittest.TestCase):
    def setUp(self):
        self.before = {"sources": [
            {"id": "in-gio-elevation", "name": "Indiana DEM",
             "url": "https://example.gov/arcgis/rest/services/Elev/ImageServer",
             "crs": "EPSG:2966", "verticalDatum": None,
             "units": "ftUS", "status": "VERIFIED"},
            {"id": "fema-nfhl", "url": "https://example.gov/nfhl",
             "crs": "EPSG:4326", "status": "VERIFIED"},
        ]}

    def test_identical_metadata_does_not_imply_source_verification(self):
        report = mod.compare(self.before, self.before)
        self.assertEqual(report["change_count"], 0)
        self.assertEqual(report["comparison_state"], "ADVISORY_COMPARISON_ONLY")
        self.assertFalse(report["release_blocking"])
        self.assertFalse(report["source_data_acquired_or_verified_by_comparison"])
        self.assertEqual(report["regulatory_certification"], "NOT_EVIDENCED")
        self.assertIn({"source_id": "in-gio-elevation", "field": "vertical_datum",
                       "value": None, "state": "NOT_EVIDENCED"},
                      report["unresolved_current_metadata"])

    def test_datum_and_url_changes_flag_parcel_join_review(self):
        after = json.loads(json.dumps(self.before))
        row = after["sources"][0]
        row["verticalDatum"] = "NAVD88"
        row["crs"] = "EPSG:26916"
        row["url"] = "https://example.gov/new"
        report = mod.compare(self.before, after)
        self.assertEqual(report["change_count"], 3)
        self.assertEqual(report["review_required_count"], 3)
        self.assertEqual(
            {r["field"] for r in report["changes"]},
            {"vertical_datum", "horizontal_crs", "service_url"},
        )
        self.assertTrue(all("parcel_to_terrain_join" in x["affected"]
                            for x in report["changes"]))

    def test_metadata_date_change_is_not_claimed_geometry_impact(self):
        after = json.loads(json.dumps(self.before))
        after["sources"][0]["publication_date"] = "2026-11-16"
        report = mod.compare(self.before, after)
        self.assertEqual(report["change_count"], 1)
        self.assertEqual(report["changes"][0]["severity"], "REVIEW_RECOMMENDED")
        self.assertEqual(report["changes"][0]["field"], "published_at")

    def test_added_removed_sources_have_distinct_status(self):
        after = {"sources": [
            {"id": "in-gio-elevation", "url": "https://example.gov/arcgis/rest/services/Elev/ImageServer",
             "crs": "EPSG:2966", "verticalDatum": None, "units": "ftUS",
             "name": "Indiana DEM", "status": "VERIFIED"},
            {"id": "new-station", "url": "https://example.gov/station"},
        ]}
        report = mod.compare(self.before, after)
        self.assertEqual([x["kind"] for x in report["changes"]],
                         ["REMOVED", "ADDED"])

    def test_duplicate_ids_are_advisory_issues_not_false_verified(self):
        after = {"sources": self.before["sources"] + [self.before["sources"][0]]}
        report = mod.compare(self.before, after)
        self.assertEqual(report["comparison_state"], "INCOMPLETE_INPUT")
        self.assertTrue(any("duplicate source id" in x for x in report["input_issues"]))
        self.assertFalse(report["release_blocking"])

    def test_explicit_null_does_not_fall_through_to_alias_value(self):
        document = {"sources": [
            {"id": "x", "verticalDatum": None,
             "vertical_datum": "NAVD88"}]}
        record, issues = mod._index(document)
        self.assertEqual(issues, [])
        self.assertIsNone(record["x"]["vertical_datum"])

    def test_invalid_catalog_rejected_as_invalid_input(self):
        with self.assertRaisesRegex(ValueError, "sources list"):
            mod.compare({"sources": {}}, self.before)

    def test_actual_legacy_tsm_catalog_compatible(self):
        fixture = ROOT / "data/schemas/tsm-indiana-data-catalog-v1.json"
        document = json.loads(fixture.read_text(encoding="utf-8"))
        self.assertIn("sources", document)
        report = mod.compare(document, document)
        self.assertEqual(report["change_count"], 0)
        self.assertGreater(report["old_source_count"], 1)

    def test_cli_reports_json_and_real_sha256(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            before = root / "before.json"
            after = root / "after.json"
            output = root / "impact.json"
            before.write_text(json.dumps(self.before), encoding="utf-8")
            after.write_text(json.dumps(self.before), encoding="utf-8")
            code = mod.main(["--before", str(before), "--after", str(after),
                             "--output", str(output)])
            self.assertEqual(code, 0)
            data = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(len(data["old_catalog_sha256"]), 64)
            self.assertFalse(data["release_blocking"])


if __name__ == "__main__":
    unittest.main()
