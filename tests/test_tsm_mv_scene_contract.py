"""Headless, dependency-free contract tests; no fabricated source data in repository."""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


MODULE = Path(__file__).resolve().parents[1] / "tsm-native/Content/Python/tsm_mv_scene_contract.py"
spec = importlib.util.spec_from_file_location("tsm_mv_scene_contract", MODULE)
scene = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scene)


def _write(root, *, bad_hash=False, bad_ring=False):
    layers = {
        "buildings": [
            {"type": "Feature", "properties": {"id": "MV-B1", "height_cm": 750.0, "eave_cm": 640.0},
             "geometry": {"type": "Polygon", "coordinates": [
                 [[0, 0], [1000, 0], [1000, 800], [0, 800],
                  [50, 50] if bad_ring else [0, 0]]]}}],
        "roads": [
            {"type": "Feature", "properties": {"id": "MV-R1", "width_cm": 650},
             "geometry": {"type": "LineString", "coordinates": [[-500, 0], [500, 0]]}}],
        "trees": [
            {"type": "Feature", "properties": {"id": "MV-T1", "height_cm": 900},
             "geometry": {"type": "Point", "coordinates": [200, 300]}}],
    }
    files = {}
    for role, feats in layers.items():
        name = role + ".geojson"
        content = json.dumps({"type": "FeatureCollection", "features": feats}, sort_keys=True)
        (root / name).write_text(content, encoding="utf-8")
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        files[role] = {"path": name, "sha256": "0" * 64 if bad_hash and role == "roads" else digest}
    manifest = {
        "schema": scene.SCHEMA, "coordinate_frame": "UE_LOCAL_CM",
        "axes": "EAST_SOUTH_UP", "source_horizontal_crs": "EPSG:2968",
        "vertical_datum": "UNVERIFIED", "evidence_status": "PENDING_EVIDENCE",
        "source_anchor": {"easting": 500000, "northing": 1000000, "units": "us_survey_foot"},
        "files": files,
    }
    (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


class SceneContractTests(unittest.TestCase):
    def test_valid_scene(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write(root)
            manifest, layers = scene.load_scene(root)
            self.assertEqual(manifest["source_horizontal_crs"], "EPSG:2968")
            self.assertEqual({x: len(layers[x]) for x in scene.ROLES},
                             {"buildings": 1, "roads": 1, "trees": 1})
            self.assertTrue(layers["buildings"][0]["closed"])

    def test_manifest_cli_validates_before_publication_and_preserves_existing_manifest(self):
        script = MODULE.parents[3] / "scripts/geospatial/tsm_mv_scene_manifest.py"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write(root, bad_ring=True)
            path = root / "manifest.json"
            path.unlink()
            command = [
                sys.executable, str(script), str(root), "--source-crs", "EPSG:2968",
                "--anchor-x", "500000", "--anchor-y", "1000000", "--units",
                "us_survey_foot", "--vertical-datum", "UNVERIFIED",
            ]
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            self.assertFalse(path.exists())
            _write(root)
            path.unlink()
            subprocess.run(command, check=True, capture_output=True)
            original = path.read_bytes()
            self.assertEqual(scene.scene_summary(root)["counts"]["buildings"], 1)
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            self.assertEqual(path.read_bytes(), original)

    def test_sha_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write(root, bad_hash=True)
            with self.assertRaisesRegex(scene.SceneError, "SHA-256 mismatch"):
                scene.load_scene(root)

    def test_unclosed_roof_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write(root, bad_ring=True)
            with self.assertRaisesRegex(scene.SceneError, "ring must"):
                scene.load_scene(root)

    def test_unknown_manifest_crs_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write(root)
            path = root / "manifest.json"
            m = json.loads(path.read_text())
            m["source_horizontal_crs"] = "UNKNOWN"
            path.write_text(json.dumps(m))
            with self.assertRaisesRegex(scene.SceneError, "source_horizontal_crs"):
                scene.load_scene(root)

    def test_unreviewed_datum_is_not_promoted(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write(root)
            summary = scene.scene_summary(root)
            self.assertEqual(summary["vertical_datum"], "UNVERIFIED")
            self.assertEqual(summary["evidence_status"], "PENDING_EVIDENCE")

    def test_out_of_bounds_coordinates_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write(root)
            file = root / "trees.geojson"
            fc = json.loads(file.read_text())
            fc["features"][0]["geometry"]["coordinates"] = [100000000, 0]
            value = json.dumps(fc)
            file.write_text(value)
            path = root / "manifest.json"
            m = json.loads(path.read_text())
            m["files"]["trees"]["sha256"] = hashlib.sha256(value.encode()).hexdigest()
            path.write_text(json.dumps(m))
            with self.assertRaisesRegex(scene.SceneError, "exceeds"):
                scene.load_scene(root)


if __name__ == "__main__":
    unittest.main()
