"""Offline unit tests for authoritative AOI boundary handling."""
from __future__ import annotations

import json
import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parent / "acquire-candidate-aoi-3dep-screening.py"
SPEC = importlib.util.spec_from_file_location("aoi_3dep_evidence", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
evidence = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(evidence)


class AoiBoundaryTests(unittest.TestCase):
    def test_positions_walks_polygon_coordinates(self):
        coordinates = [[[[-87.95, 37.90], [-87.90, 37.90], [-87.90, 37.95], [-87.95, 37.90]]]]
        self.assertEqual(
            list(evidence._positions(coordinates)),
            [(-87.95, 37.90), (-87.90, 37.90), (-87.90, 37.95), (-87.95, 37.90)],
        )

    def test_zcta_loader_requires_exactly_requested_geoid(self):
        payload = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "id": "47620",
                "properties": {
                    "GEOID": "47620",
                    "NAME": "ZCTA5 47620",
                    "AREALAND": 123,
                    "AREAWATER": 4,
                    "INTPTLAT": "37.93",
                    "INTPTLON": "-87.91",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-87.95, 37.90], [-87.90, 37.90],
                        [-87.90, 37.95], [-87.95, 37.90],
                    ]],
                },
            }],
        }
        with patch.object(evidence, "fetch", return_value=(json.dumps(payload).encode(), "application/geo+json")):
            feature, metadata = evidence._load_zcta("47620")
        self.assertEqual(feature["properties"]["GEOID"], "47620")
        self.assertEqual(metadata["boundaryVintage"], "2020 Census ZCTA")
        self.assertEqual(metadata["boundaryAuthority"], "U.S. Census Bureau TIGERweb")
        self.assertEqual(len(metadata["boundaryResponseSha256"]), 64)

    def test_zcta_loader_fails_closed_on_identity_mismatch(self):
        payload = {"features": [{
            "properties": {"GEOID": "47621"},
            "geometry": {"type": "Polygon", "coordinates": []},
        }]}
        with patch.object(evidence, "fetch", return_value=(json.dumps(payload).encode(), "application/geo+json")):
            with self.assertRaisesRegex(RuntimeError, "identity mismatch"):
                evidence._load_zcta("47620")

    def test_zcta_loader_rejects_multiple_features(self):
        payload = {"features": [{}, {}]}
        with patch.object(evidence, "fetch", return_value=(json.dumps(payload).encode(), "application/geo+json")):
            with self.assertRaisesRegex(RuntimeError, "expected exactly one"):
                evidence._load_zcta("47620")

    def test_invalid_zcta_input_rejected_before_network(self):
        with self.assertRaisesRegex(ValueError, "exactly five digits"):
            evidence._load_zcta("4762")


if __name__ == "__main__":
    unittest.main()
