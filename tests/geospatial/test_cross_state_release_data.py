"""Tiny synthetic GIS fixtures: verification logic, NOT measured county coverage."""
import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "tsm_cross_state_release", ROOT / "scripts/geospatial/audit_cross_state_release_data.py"
)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class CrossStatePreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.entries = {}
        for i, fips in enumerate(AUDIT.CORE_SIX):
            west = -88.95 + 0.11 * i
            south = 37.25 + 0.09 * i
            east = west + 0.035
            north = south + 0.035
            coords = [[west, south], [east, south], [east, north], [west, north], [west, south]]
            boundary = {"type": "FeatureCollection", "features": [
                {"type": "Feature", "properties": {"GEOID": fips},
                 "geometry": {"type": "Polygon", "coordinates": [coords]}}
            ]}
            file_path = self.root / (fips + "-county.geojson")
            file_path.write_text(json.dumps(boundary))
            assets = []
            for kind in AUDIT.REQUIRED_LAYER_KINDS:
                path = self.root / (fips + "-" + kind + (".tif" if kind in ("terrain", "imagery") else ".json"))
                row = {
                    "kind": kind, "path": path.name, "source_crs": "EPSG:4326",
                    "source_id": "SYNTHETIC_TEST_ONLY", "source_url": "https://example.gov/test-only",
                    "acquired_at": "2025-01-01", "retrieved_at": "2026-11-12",
                }
                if kind in ("terrain", "imagery"):
                    with rasterio.open(
                        path, "w", driver="GTiff", height=12, width=12, count=1,
                        dtype="uint16", crs="EPSG:4326",
                        transform=from_origin(west, north, (east-west)/12, (north-south)/12),
                        nodata=0,
                    ) as dataset:
                        dataset.write(np.ones((12, 12), dtype="uint16"), 1)
                    if kind == "terrain":
                        evidence = self.root / (fips + "-vertical-evidence.json")
                        evidence.write_text(json.dumps({
                            "source": "SYNTHETIC_TEST_ONLY", "review": "TEST_ONLY"
                        }))
                        row.update({
                            "vertical_datum": "NAVD88", "vertical_units": "meters",
                            "geoid_model": "GEOID18",
                            "vertical_evidence": {
                                "path": evidence.name, "sha256": sha(evidence),
                                "review_state": "SOURCE_METADATA_REVIEWED",
                            }
                        })
                else:
                    path.write_text(json.dumps({"fixture": kind, "source": "TEST_ONLY"}))
                    index = self.root / (fips + "-" + kind + "-index.geojson")
                    index.write_text(json.dumps(boundary))
                    row["coverage_index"] = {"path": index.name, "sha256": sha(index)}
                row["sha256"] = sha(path)
                assets.append(row)
            self.entries[fips] = {
                "boundary": {
                    "path": file_path.name, "sha256": sha(file_path),
                    "authority": "SYNTHETIC_TIGER_TEST_NOT_AUTHORITATIVE",
                },
                "assets": assets,
            }
        self.manifest = {
            "schema": "tsm.cross-state.release-snapshot.v1",
            "scope": "community-six",
            "counties": self.entries,
        }

    def test_complete_synthetic_six_county_footprints(self):
        result = AUDIT.audit(self.manifest, self.root, "community-six", 0.99)
        self.assertEqual(result["result"], "SOURCE_FILES_AND_RASTER_BOUNDS_CHECKED_ONLY")
        self.assertEqual(result["county_count"], 6)
        self.assertEqual(result["scene_rendering_verified"], False)
        self.assertEqual(result["science_and_geodetic_approval"], "NOT_EVIDENCED")
        for county in result["counties"]:
            self.assertGreaterEqual(county["terrain_bounds_coverage"], 0.99)
            self.assertFalse(county["layers"]["buildings"]["feature_completeness_checked"])

    def test_missing_eight_county_scope_is_not_promoted(self):
        with self.assertRaisesRegex(ValueError, "scope mismatch"):
            AUDIT.audit(self.manifest, self.root, "engineering-eight")
        self.manifest["scope"] = "engineering-eight"
        with self.assertRaisesRegex(ValueError, "exactly the selected scope"):
            AUDIT.audit(self.manifest, self.root, "engineering-eight")

    def test_tamper_detected(self):
        self.entries[AUDIT.CORE_SIX[0]]["assets"][0]["sha256"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            AUDIT.audit(self.manifest, self.root, "community-six")

    def test_missing_source_geoids_fail(self):
        target = AUDIT.CORE_SIX[0]
        self.entries[target]["boundary"] = self.entries[AUDIT.CORE_SIX[1]]["boundary"]
        with self.assertRaisesRegex(ValueError, "GEOID mismatch"):
            AUDIT.audit(self.manifest, self.root, "community-six")

    def test_unknown_vertical_datum_fails(self):
        self.entries[AUDIT.CORE_SIX[0]]["assets"][0]["vertical_datum"] = "UNKNOWN"
        with self.assertRaisesRegex(ValueError, "vertical source metadata"):
            AUDIT.audit(self.manifest, self.root, "community-six")

    def test_vector_index_from_wrong_county_fails(self):
        fips = AUDIT.CORE_SIX[0]
        foreign = AUDIT.CORE_SIX[1]
        idx = self.entries[fips]["assets"][2]["coverage_index"]
        idx["path"] = foreign + "-buildings-index.geojson"
        idx["sha256"] = sha(self.root / idx["path"])
        with self.assertRaisesRegex(ValueError, "GEOID mismatch"):
            AUDIT.audit(self.manifest, self.root, "community-six")

    def test_incomplete_raster_coverage_reported_not_certified(self):
        fips = AUDIT.CORE_SIX[0]
        terrain = next(x for x in self.entries[fips]["assets"] if x["kind"] == "terrain")
        target = self.root / terrain["path"]
        with rasterio.open(target, "w", driver="GTiff", height=10, width=10, count=1,
                           dtype="uint16", crs="EPSG:4326",
                           transform=from_origin(-88.95, 37.285, 0.001, 0.001)) as dataset:
            dataset.write(np.ones((10, 10), dtype="uint16"), 1)
        terrain["sha256"] = sha(target)
        result = AUDIT.audit(self.manifest, self.root, "community-six")
        self.assertEqual(result["result"], "NOT_READY_MISSING_SOURCE_COVERAGE")
        self.assertTrue(any(fips + "/terrain" in issue for issue in result["blocking_findings"]))


if __name__ == "__main__":
    unittest.main()
