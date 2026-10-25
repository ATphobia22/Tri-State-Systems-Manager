"""Offline tests for trusted, county-clipped, NASS crop raster acquisition."""
from __future__ import annotations
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("fetch-usda-cdl.py")
spec = importlib.util.spec_from_file_location("tsm_usda_cdl", SCRIPT)
assert spec and spec.loader
cdl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cdl)


class CroplandDataLayerTests(unittest.TestCase):
    @staticmethod
    def item(year=2025):
        return {"type": "Feature", "collection": "usda-cdl", "id": f"cdl-{year}",
                "properties": {"datetime": f"{year}-12-31T00:00:00Z"},
                "assets": {"data": {"href": "https://ai4edataeuwest.blob.core.windows.net/crops/cdl.tif?sig=dummy", "roles": ["data"]}}}

    def test_official_county_boundary_has_real_polygon_and_hash(self):
        source = Path(__file__).resolve().parents[3] / "data/posey-county/boundaries/posey-county.geojson"
        geom, bounds, digest = cdl.county_geometry(source)
        self.assertIn(geom["type"], ("Polygon", "MultiPolygon"))
        self.assertLess(bounds[0], bounds[2])
        self.assertLess(bounds[1], bounds[3])
        self.assertEqual(len(digest), 64)

    def test_county_must_have_exact_geoid_and_valid_geometry(self):
        with tempfile.TemporaryDirectory() as root:
            p = Path(root) / "county.json"
            p.write_text(json.dumps({"type": "FeatureCollection", "features": [
                {"type": "Feature", "properties": {"GEOID": "18130"},
                 "geometry": {"type": "Polygon", "coordinates": [[[1, 1], [2, 1], [2, 2], [1, 1]]]}}
            ]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "GEOID"):
                cdl.county_geometry(p)

    def test_misdated_or_ambiguous_item_is_rejected(self):
        good = self.item()
        self.assertEqual(cdl.select_item({"features": [good]}, 2025)["id"], "cdl-2025")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            cdl.select_item({"features": [good, good]}, 2025)
        with self.assertRaisesRegex(ValueError, "exactly one"):
            cdl.select_item({"features": [self.item(2024)]}, 2025)

    def test_source_asset_https_host_and_tif_type_are_required(self):
        item = self.item()
        self.assertIn("blob.core.windows.net", cdl.asset_href(item))
        for href in ("https://example.net/evil.tif", "file:///etc/passwd",
                     "https://user:pass@ai4edataeuwest.blob.core.windows.net/p.tif",
                     "http://ai4edataeuwest.blob.core.windows.net/p.tif",
                     "https://ai4edataeuwest.blob.core.windows.net/p.exe"):
            item["assets"]["data"]["href"] = href
            with self.subTest(href=href), self.assertRaisesRegex(ValueError, "trusted HTTPS"):
                cdl.asset_href(item)

    def test_missing_year_or_source_is_unavailable(self):
        with self.assertRaises(ValueError):
            cdl.validate_year(1997)
        with self.assertRaises(ValueError):
            cdl.validate_year("2025")
        with self.assertRaisesRegex(ValueError, "no USDA CDL"):
            cdl.select_item({"features": []}, 2025)

    def test_no_live_flag_must_not_fetch(self):
        import sys
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "out.tif"
            with patch.object(cdl, "search_cdl", side_effect=AssertionError("HTTP without --live")):
                with patch.object(sys, "argv", [str(SCRIPT), "--year", "2025", "--out", str(target)]):
                    with self.assertRaises(SystemExit) as cm:
                        cdl.main()
                    self.assertNotEqual(cm.exception.code, 0)
            self.assertFalse(target.exists())

    def test_must_not_use_statewide_raw_raster_as_county_output(self):
        import inspect
        script = inspect.getsource(cdl.clip_remote_cdl)
        self.assertIn("rasterio.mask", script)
        self.assertIn("crop=True", script)
        self.assertIn("transform_geom", script)
        self.assertNotIn("urlretrieve", script)


if __name__ == "__main__":
    unittest.main()
