#!/usr/bin/env python3
"""No-network, no-GDAL regression coverage for pinned project DEM Z units."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.geospatial.dem_vertical_evidence import FT_PER_M, pinned_navd88_scale_to_ft


class VerticalEvidenceTests(unittest.TestCase):
    def fixture(self, directory, units="metres", datum="NAVD88"):
        dem = directory / "dem.tif"
        dem.write_bytes(b"test fixture raw raster bytes")
        meta = {
            "asset_path": "data/reference/dem.tif",
            "asset_sha256": hashlib.sha256(dem.read_bytes()).hexdigest(),
            "raster": {"elevation_units": units, "vertical_datum": datum},
        }
        sidecar = dem.with_suffix(".provenance.json")
        sidecar.write_text(json.dumps(meta), encoding="utf8")
        return dem, sidecar

    def test_pinned_metric_elevations_convert_to_feet(self):
        with tempfile.TemporaryDirectory() as root:
            dem, _ = self.fixture(Path(root))
            self.assertEqual(pinned_navd88_scale_to_ft(dem), FT_PER_M)

    def test_pinned_feet_are_not_multiplied_again(self):
        with tempfile.TemporaryDirectory() as root:
            dem, _ = self.fixture(Path(root), units="us_survey_feet")
            self.assertEqual(pinned_navd88_scale_to_ft(dem), 1.0)

    def test_missing_sidecar_and_changed_bytes_stay_unavailable(self):
        with tempfile.TemporaryDirectory() as root:
            dem, sidecar = self.fixture(Path(root))
            dem.write_bytes(b"another raster")
            self.assertIsNone(pinned_navd88_scale_to_ft(dem))
            sidecar.unlink()
            self.assertIsNone(pinned_navd88_scale_to_ft(dem))

    def test_unknown_datum_or_units_cannot_silently_become_navd88_feet(self):
        with tempfile.TemporaryDirectory() as root:
            dem, sidecar = self.fixture(Path(root), units="unknown")
            self.assertIsNone(pinned_navd88_scale_to_ft(dem))
            meta = json.loads(sidecar.read_text())
            meta["raster"]["elevation_units"] = "metres"
            meta["raster"]["vertical_datum"] = "EGM2008"
            sidecar.write_text(json.dumps(meta))
            self.assertIsNone(pinned_navd88_scale_to_ft(dem))


if __name__ == "__main__":
    unittest.main()
