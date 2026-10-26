#!/usr/bin/env python3
"""Synthetic IGIO candidate audit tests: no private or uploaded geometries."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("audit_posey_igio_candidate.py")
spec = importlib.util.spec_from_file_location("audit_posey_igio_candidate", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def feature(sid=7):
    return {
        "type": "Feature", "id": sid,
        "properties": {"objectid": sid, "county": "Posey",
                       "source": "UNVERIFIED", "lidaryear": 2020},
        "geometry": {"type": "Polygon", "coordinates": [[
            [-87.9, 38.0], [-87.89, 38.0], [-87.89, 38.01],
            [-87.9, 38.01], [-87.9, 38.0],
        ]]},
    }


class CandidateAuditTests(unittest.TestCase):
    def run_audit(self, features, expected):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "untrusted.json"
            path.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
            return mod.audit(path, expected_count=expected)

    def test_identity_normalization_is_only_candidate(self):
        receipt, normalized = self.run_audit([feature(7), feature(2)], 2)
        self.assertTrue(receipt["geometryTopologyAccepted"])
        self.assertFalse(receipt["countywide3DTilesAccepted"])
        self.assertFalse(receipt["engineeringUse"])
        self.assertEqual([f["properties"]["igioObjectId"] for f in normalized["features"]], [2, 7])
        self.assertEqual(receipt["featuresWithExplicitHeight"], 0)
        self.assertEqual(receipt["featuresWithExplicitGroundElevation"], 0)

    def test_self_intersection_preserved_but_flagged(self):
        raw = feature()
        raw["geometry"]["coordinates"] = [[
            [-87.9, 38.0], [-87.89, 38.01], [-87.89, 38.0],
            [-87.9, 38.01], [-87.9, 38.0],
        ]]
        receipt, normalized = self.run_audit([raw], 1)
        self.assertEqual(receipt["invalidGeometryCount"], 1)
        self.assertFalse(receipt["geometryTopologyAccepted"])
        self.assertEqual(normalized["features"][0]["geometry"], raw["geometry"])
        self.assertNotIn("-87.", json.dumps(receipt))

    def test_duplicate_objectid_rejected(self):
        with self.assertRaises(mod.CandidateError):
            self.run_audit([feature(7), feature(7)], 2)

    def test_wrong_feature_count_rejected(self):
        with self.assertRaises(mod.CandidateError):
            self.run_audit([feature()], 2)

    def test_mismatched_feature_id_rejected(self):
        raw = feature()
        raw["id"] = 8
        with self.assertRaises(mod.CandidateError):
            self.run_audit([raw], 1)

    def test_private_metadata_redacted_from_receipt(self):
        raw = feature()
        raw["properties"]["source"] = "PRIVATE STREET AND ADDRESS"
        raw["properties"]["lidaryear"] = "SECRET_LIDAR_NOTE"
        receipt, _ = self.run_audit([raw], 1)
        rendered = json.dumps(receipt)
        self.assertNotIn("PRIVATE STREET", rendered)
        self.assertNotIn("SECRET_LIDAR", rendered)

    def test_official_string_lidar_year_metadata_not_promoted(self):
        raw = feature()
        raw["properties"]["source"] = "IGIO Building_Footprints_of_Indiana_2016_2020"
        raw["properties"]["lidaryear"] = "2020"
        receipt, _ = self.run_audit([raw], 1)
        self.assertEqual(receipt["declaredLidarYearsUnverified"], {"2020": 1})
        self.assertEqual(receipt["declaredSourceLabelsUnverified"], {"DECLARED_IGIO_LIKE": 1})
        self.assertFalse(receipt["sourceAuthorityIndependentlyVerified"])

    def test_sha256_pin_detects_changed_source(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.json"
            path.write_text(json.dumps({"type": "FeatureCollection", "features": [feature()]}))
            with self.assertRaises(mod.CandidateError):
                mod.audit(path, expected_count=1, expected_sha256="0" * 64)

    def test_nonfinite_height_is_not_measured(self):
        raw = feature()
        raw["properties"]["lidarHeightFt"] = float("nan")
        receipt, _ = self.run_audit([raw], 1)
        self.assertEqual(receipt["featuresWithExplicitHeight"], 0)

    def test_cli_does_not_overwrite_source(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "candidate.json"
            path.write_text(json.dumps({"type": "FeatureCollection", "features": [feature()]}))
            with patch("sys.argv", ["audit", "--input", str(path), "--receipt", str(path),
                                    "--expected-count", "1"]):
                self.assertEqual(mod.main(), 2)
                self.assertEqual(json.loads(path.read_text())["features"][0]["id"], 7)


if __name__ == "__main__":
    unittest.main()
