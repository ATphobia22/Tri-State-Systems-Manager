#!/usr/bin/env python3
"""Synthetic regression: explicit GEOID18 offsets in visual-only Posey GLB tiles."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

BUILDER = Path(__file__).resolve().parents[2] / "scripts/geospatial/build-building-3d-tiles.py"


def feature(*, undulation: float | None = None, partial: bool = False) -> dict:
    p = {
        "igioObjectId": 501, "groundElevationFt": 382.0,
        "lidarHeightFt": 18.0, "lidarHeightStatus": "OK",
        "heightProvenance": "OBSERVED", "lidarHeightDatum": "NAVD88",
        "lidarHeightUnit": "ftUS",
    }
    if undulation is not None:
        p["geoidUndulationM"] = undulation
        if not partial:
            p.update({
                "geoidModel": "GEOID18",
                "geoidHorizontalFrame": "NAD83(2011)",
                "geoidSourceUrl": "https://geodesy.noaa.gov/GEOID/GEOID18/",
            })
    return {"type": "Feature", "properties": p, "geometry": {
        "type": "Polygon", "coordinates": [[
            [-87.901, 38.000], [-87.900, 38.000],
            [-87.900, 38.001], [-87.901, 38.001],
            [-87.901, 38.000],
        ]],
    }}


def build(f: dict, *flags: str) -> tuple[subprocess.CompletedProcess, dict | None, dict | None]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        inp, out = root / "input.json", root / "tiles"
        inp.write_text(json.dumps({"type": "FeatureCollection", "features": [f]}))
        command = [sys.executable, str(BUILDER),
                   "--geojson", str(inp), "--out-dir", str(out),
                   "--expected-buildings", "1", *flags]
        process = subprocess.run(command, capture_output=True, text=True, timeout=90)
        tileset = json.loads((out / "tileset.json").read_text()) if (out / "tileset.json").exists() else None
        rejection = json.loads((out / "rejected-buildings.json").read_text()) if (out / "rejected-buildings.json").exists() else None
        return process, tileset, rejection


class GeoidPlacementTests(unittest.TestCase):
    def test_per_feature_geoid_must_shift_enu_height_by_exact_signed_n(self):
        old, a, _ = build(feature())
        new, b, _ = build(feature(undulation=-30.302))
        self.assertEqual(old.returncode, 0, old.stderr)
        self.assertEqual(new.returncode, 0, new.stderr)
        x = a["root"]["children"][0]
        y = b["root"]["children"][0]
        self.assertAlmostEqual(y["boundingVolume"]["box"][2] -
                               x["boundingVolume"]["box"][2], -30.302, places=5)
        self.assertEqual(y["extras"]["tsm"]["geoidUndulationM"], -30.302)
        self.assertEqual(y["extras"]["tsm"]["verticalPlacementStatus"],
                         "SOURCE_DECLARED_GEOID18_VISUAL_ONLY")
        self.assertFalse(b["asset"]["extras"]["tsm"]["engineeringUse"])
        self.assertFalse(b["asset"]["extras"]["tsm"]["regulatoryUse"])

    def test_unverified_geoid_default_stays_explicitly_screening_only(self):
        proc, tileset, _ = build(feature())
        self.assertEqual(proc.returncode, 0, proc.stderr)
        child = tileset["root"]["children"][0]["extras"]["tsm"]
        self.assertEqual(child["verticalPlacementStatus"],
                         "NAVD88_AS_ELLIPSOID_UNVERIFIED_PREVIEW")
        self.assertIsNone(child["geoidUndulationM"])

    def test_partial_geoid_metadata_blocks_silent_vertical_correction(self):
        proc, tileset, rejection = build(feature(undulation=-30.302, partial=True))
        self.assertNotEqual(proc.returncode, 0)
        self.assertIsNone(tileset)
        self.assertIn("GEOID", rejection["rejected"][0]["reason"])

    def test_incorrect_horizontal_frame_blocks_geoid_application(self):
        invalid = feature(undulation=-30.302)
        invalid["properties"]["geoidHorizontalFrame"] = "WGS84"
        proc, tileset, rejection = build(invalid)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIsNone(tileset)
        self.assertIn("GEOID", rejection["rejected"][0]["reason"])

    def test_strict_geoid_mode_refuses_legacy_orthometric_preview(self):
        proc, tileset, rejection = build(feature(), "--require-geoid-placement")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIsNone(tileset)
        self.assertIn("GEOID", rejection["rejected"][0]["reason"])

    def test_strict_geoid_mode_with_declared_n_is_still_not_survey_certification(self):
        proc, tileset, _ = build(feature(undulation=-30.302), "--require-geoid-placement")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(tileset["asset"]["extras"]["tsm"]["geoidAdjustedCount"], 1)
        self.assertEqual(tileset["asset"]["extras"]["tsm"]["unverifiedVerticalPlacementCount"], 0)
        self.assertFalse(tileset["asset"]["extras"]["tsm"]["engineeringUse"])


if __name__ == "__main__":
    unittest.main()
