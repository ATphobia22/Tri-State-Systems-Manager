#!/usr/bin/env python3
"""Synthetic only: generator correctness, provenance, numeric gate, and no invented heights."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("build-building-3d-tiles.py")


def feature(sid: int, geometry: dict, *, height: float | None = 17.25,
            provenance: str = "DERIVED") -> dict:
    props = {
        "igioObjectId": sid,
        "groundElevationMeanFt": 380.2,
        "lidarHeightStatus": "OK" if height is not None else "UNAVAILABLE",
        "heightProvenance": provenance if height is not None else "UNAVAILABLE",
    }
    if height is not None:
        props["lidarHeightFt"] = height
    return {"type": "Feature", "properties": props, "geometry": geometry}


def polygon(lon: float) -> dict:
    return {"type": "Polygon", "coordinates": [[
        [lon, 37.9], [lon + 0.001, 37.9], [lon + 0.001, 37.901],
        [lon, 37.901], [lon, 37.9],
    ]]}


class BuildingGenerationTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.source = self.root / "test-source.json"
        self.output = self.root / "tiles"

    def run_generator(self, features: list, *extra: str):
        self.source.write_text(json.dumps({
            "type": "FeatureCollection", "features": features,
        }), encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--geojson", str(self.source),
             "--out-dir", str(self.output), *extra],
            capture_output=True, text=True, timeout=60, check=False,
        )

    def test_provenance_and_multipolygon_holes_are_preserved(self):
        multi = {"type": "MultiPolygon", "coordinates": [
            polygon(-87.9)["coordinates"],
            polygon(-87.89)["coordinates"],
        ]}
        a = feature(1002, multi, height=12.3, provenance="OBSERVED")
        b = feature(1001, polygon(-87.88), height=9.5)
        result = self.run_generator([a, b], "--expected-buildings", "2")
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.output / "manifest.json").read_text())
        tile = json.loads((self.output / "tileset.json").read_text())
        self.assertEqual(manifest["input"]["skipped"], 0)
        self.assertEqual(manifest["parameters"]["extrusionEstimated"], False)
        self.assertEqual(manifest["input"]["featureCount"], 2)
        self.assertTrue(tile["asset"]["extras"]["tsm"]["sourceObjectIdsReconciled"])
        children = tile["root"]["children"]
        self.assertEqual([v["extras"]["tsm"]["sourceObjectId"] for v in children], [1001, 1002])
        self.assertEqual(children[0]["extras"]["tsm"]["lidarHeightFt"], 9.5)
        self.assertEqual(children[1]["extras"]["tsm"]["geometryComponents"], 2)
        self.assertEqual(children[1]["extras"]["tsm"]["heightProvenance"], "OBSERVED")
        self.assertTrue((self.output / "1001.glb").is_file())
        self.assertTrue((self.output / "1002.glb").is_file())

    def test_height_unavailable_does_not_silently_become_ten_feet(self):
        result = self.run_generator([feature(1, polygon(-87.91), height=None)],
                                    "--expected-buildings", "1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("incomplete source-tied building tiles", result.stderr + result.stdout)
        self.assertFalse((self.output / "1.glb").exists())
        self.assertFalse((self.output / "tileset.json").exists())

    def test_estimated_fallback_is_explicit_and_never_survey_data(self):
        result = self.run_generator([feature(1, polygon(-87.91), height=None)],
                                    "--expected-buildings", "1",
                                    "--extrusion-ft", "10")
        self.assertEqual(result.returncode, 0, result.stderr)
        tileset = json.loads((self.output / "tileset.json").read_text())
        meta = tileset["asset"]["extras"]["tsm"]
        self.assertEqual(meta["heightFallbackCount"], 1)
        self.assertFalse(meta["engineeringUse"])
        self.assertFalse(meta["regulatoryUse"])
        self.assertEqual(tileset["root"]["children"][0]["extras"]["tsm"]["heightProvenance"],
                         "ESTIMATED_FALLBACK_INFORMATIONAL_ONLY")

    def test_duplicate_and_unexpected_objectids_cannot_produce_accepted_tiles(self):
        duplicates = [feature(1, polygon(-87.9)), feature(1, polygon(-87.8))]
        result = self.run_generator(duplicates, "--expected-buildings", "2")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate source OBJECTIDs", result.stderr + result.stdout)
        different = self.run_generator([feature(1, polygon(-87.9))], "--expected-buildings", "2")
        self.assertNotEqual(different.returncode, 0)
        self.assertIn("source feature count", different.stderr + different.stdout)


if __name__ == "__main__":
    unittest.main()
