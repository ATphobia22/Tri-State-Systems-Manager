"""Headless validation of the UE editor data boundary; no Unreal or GIS dependency."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "tsm-native" / "Content" / "Python"
sys.path.insert(0, str(MODULE))
from tsm_mv_contract import SCHEMA, inspect_package


class MountVernonEditorContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.geo = {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {"source_id": "BLDG-42", "ground_z_cm": 150.0,
                "height_cm": 1000.0, "eave_cm": 800.0},
             "geometry": {"type": "Polygon",
                "coordinates": [[[0.0, 0.0], [1000.0, 0.0], [1000.0, 600.0],
                                 [0.0, 0.0]]]}}
        ]}
        self.man = {
            "schema_version": SCHEMA,
            "coordinate_frame": {
                "space": "LOCAL_UNREAL_CM", "axes": "X_EAST_Y_SOUTH_Z_UP",
                "horizontal_crs": "EPSG:2968", "vertical_datum": "UNVERIFIED",
                "vertical_units": "UNVERIFIED",
                "origin": {"easting": 2600000, "northing": 900000,
                           "elevation": 0, "unit": "us-ft"}},
            "scene": {"world_partition_map": "/Game/Maps/TSMRegion",
                      "evidence_status": "PENDING_EVIDENCE"},
            "datasets": [{"kind": "building", "path": "buildings.geojson",
                          "sha256": "", "source_uri": "indianamap:source-unreviewed",
                          "source_crs": "EPSG:2968", "expected_feature_count": 1}],
        }

    def persist(self):
        data = json.dumps(self.geo).encode()
        (self.root / "buildings.geojson").write_bytes(data)
        self.man["datasets"][0]["sha256"] = hashlib.sha256(data).hexdigest()
        manifest = self.root / "manifest.json"
        manifest.write_text(json.dumps(self.man))
        return manifest

    def test_valid_vertices_and_stable_id(self):
        path = self.persist()
        package = inspect_package(path)
        f = package["features"][0]
        self.assertEqual(f.kind, "building")
        self.assertTrue(f.closed)
        self.assertEqual(len(f.points), 3)
        self.assertEqual(f.points[0][2], 150)
        self.assertEqual(f.stable_label, inspect_package(path)["features"][0].stable_label)

    def test_hash_integrity(self):
        path = self.persist()
        (self.root / "buildings.geojson").write_text('{"tampered":true}')
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            inspect_package(path)

    def test_never_assume_source_crs(self):
        self.man["datasets"][0]["source_crs"] = "EPSG:2966"
        with self.assertRaisesRegex(ValueError, "CRS does not match"):
            inspect_package(self.persist())

    def test_unreviewed_vertical_datum_not_labeled_navd88(self):
        self.man["coordinate_frame"]["vertical_datum"] = "ASSUMED_NAVD88"
        with self.assertRaisesRegex(ValueError, "vertical datum"):
            inspect_package(self.persist())

    def test_no_silent_2d_zero_elevation(self):
        self.geo["features"][0]["properties"].pop("ground_z_cm")
        with self.assertRaisesRegex(ValueError, "ground_z_cm"):
            inspect_package(self.persist())

    def test_reject_holes_in_buildings(self):
        self.geo["features"][0]["geometry"]["coordinates"].append(
            [[100, 100], [200, 100], [200, 200], [100, 100]]
        )
        with self.assertRaisesRegex(ValueError, "holes"):
            inspect_package(self.persist())

    def test_reject_path_escape(self):
        self.man["datasets"][0]["path"] = "../secret.geojson"
        with self.assertRaises((ValueError, FileNotFoundError)):
            inspect_package(self.persist())

    def test_nonfinite_coordinate(self):
        self.geo["features"][0]["geometry"]["coordinates"][0][0][0] = float("nan")
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            inspect_package(self.persist())

    def test_reject_negative_procedural_dimensions(self):
        self.geo["features"][0]["properties"]["height_cm"] = -15.0
        with self.assertRaisesRegex(ValueError, "negative height_cm"):
            inspect_package(self.persist())

    def test_3d_road_is_not_flattened(self):
        road = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature", "properties": {"source_id": "ROAD-1", "width_cm": 650},
                "geometry": {"type": "LineString",
                             "coordinates": [[0, 0, 250], [100, 100, 310]]}
            }]
        }
        self.geo = road
        self.man["datasets"][0]["kind"] = "road"
        package = inspect_package(self.persist())
        self.assertEqual(package["features"][0].points[1][2], 310)
        self.assertFalse(package["features"][0].closed)

    def test_missing_feature_identity(self):
        self.geo["features"][0]["properties"].pop("source_id")
        with self.assertRaisesRegex(ValueError, "stable source_id"):
            inspect_package(self.persist())


if __name__ == "__main__":
    unittest.main()
