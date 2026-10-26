#!/usr/bin/env python3
"""Synthetic privacy and acceptance checks for LiDAR height-gap diagnostics."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SRC = Path(__file__).with_name("emit_building_height_gap_evidence.py")
SPEC = importlib.util.spec_from_file_location("emit_building_height_gap_evidence", SRC)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def feature(oid, status="OK", provenance="OBSERVED", height=21.0, sampled=3):
    return {
        "type": "Feature",
        "properties": {
            "igioObjectId": oid, "objectid": oid,
            "lidarHeightStatus": status,
            "heightProvenance": provenance, "lidarHeightFt": height,
            "groundElevationSampleCount": sampled,
            "elevationCoverage": "SAMPLED" if sampled else "UNAVAILABLE",
            "privateOwner": "SHOULD NEVER LEAK",
        },
        "geometry": {"type": "Point", "coordinates": [-87.9, 38.1]},
    }


class EvidenceTests(unittest.TestCase):
    def sample(self, features, missing=None):
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / "source.geojson"
            src.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
            delta = None
            if missing is not None:
                delta = Path(td) / "delta.json"
                delta.write_text(json.dumps({
                    "authoritative": {"count": len(features)},
                    "missingAuthoritativeObjectIds": missing,
                }))
            return mod.evidence(src, expected_count=len(features), identity_delta=delta)

    def test_counts_and_every_missing_id(self):
        a = self.sample([feature(3), feature(1, "insufficient-roof-points:0",
                                         "UNAVAILABLE", None),
                         feature(2, "OK", "DERIVED", 12.0, 0)], [1])
        self.assertEqual(a["observedHeights"], 1)
        self.assertEqual(a["derivedHeights"], 1)
        self.assertEqual(a["unavailableHeights"], 1)
        self.assertEqual(a["heightReasons"]["INSUFFICIENT_ROOF_RETURNS"], 1)
        self.assertEqual(a["unavailableHeightObjectIds"], [1])
        self.assertEqual(a["reviewQueue"][0]["sourceObjectId"], 1)
        self.assertFalse(a["completeBuildingAcceptance"])
        self.assertEqual(a["groundCoverage"]["DEM_UNAVAILABLE"], 1)

    def test_no_coordinates_or_private_fields_in_evidence(self):
        r = self.sample([feature(7, "error:tile-read-failed:HOME_SECRET",
                                 "UNAVAILABLE", None)])
        text = json.dumps(r)
        self.assertNotIn("HOME_SECRET", text)
        self.assertNotIn("SHOULD NEVER LEAK", text)
        self.assertNotIn("-87.9", text)

    def test_duplicate_ids(self):
        with self.assertRaises(mod.EvidenceError):
            self.sample([feature(2), feature(2)])

    def test_inconsistent_aliases(self):
        f = feature(7)
        f["properties"]["objectid"] = 8
        with self.assertRaises(mod.EvidenceError):
            self.sample([f])

    def test_invalid_ok_measurement(self):
        with self.assertRaises(mod.EvidenceError):
            self.sample([feature(7, "OK", "OBSERVED", None)])

    def test_no_synthetic_provenance(self):
        with self.assertRaises(mod.EvidenceError):
            self.sample([feature(7, "OK", "NSI_MODELED", 20)])

    def test_duplicate_delta_missing(self):
        with self.assertRaises(mod.EvidenceError):
            self.sample([feature(7)], [7, 7])

    def test_unknown_delta_ids(self):
        with self.assertRaises(mod.EvidenceError):
            self.sample([feature(7)], [9])

    def test_reason_codes_closed(self):
        self.assertEqual(mod.reason_code("insufficient-ground-points:2"),
                         "INSUFFICIENT_GROUND_RETURNS")
        self.assertEqual(mod.reason_code("tree-confound-unreliable:SECRET"),
                         "ROOF_RETURNS_TREE_CONFOUNDED")
        self.assertEqual(mod.reason_code("UNAVAILABLE"), "UNAVAILABLE_UNCLASSIFIED")
        self.assertEqual(mod.reason_code("anything private"), "OTHER_UNAVAILABLE")

    def test_true_measurement_no_issues(self):
        r = self.sample([feature(1), feature(2, "OK", "DERIVED", 8)])
        self.assertTrue(r["completeBuildingAcceptance"])
        self.assertEqual(r["reviewQueue"], [])

    def test_nonfinite_heights(self):
        self.assertFalse(mod.valid_height(float("nan")))
        self.assertFalse(mod.valid_height(float("inf")))
        self.assertFalse(mod.valid_height(-2))
        self.assertFalse(mod.valid_height(True))

    def test_cli_refuses_evidence_overwrite(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "source.geojson"
            path.write_text(json.dumps({"features": [feature(1)]}))
            with patch("sys.argv", ["evidence", "--geojson", str(path),
                                    "--out", str(path), "--expected-count", "1"]):
                self.assertEqual(mod.main(), 2)
                self.assertIn('"features"', path.read_text())


if __name__ == "__main__":
    unittest.main()
