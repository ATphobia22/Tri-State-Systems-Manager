"""Isolated source ingestion and provenance contract tests, no Internet needed."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "scripts" / "geospatial" / "build_mount_vernon_scene.py"
spec = importlib.util.spec_from_file_location("build_mount_vernon_scene", MODULE)
assert spec and spec.loader
scene = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scene)

POLYGON = {"type": "Polygon", "coordinates": [[[-87.91, 37.92], [-87.90, 37.92], [-87.90, 37.93], [-87.91, 37.92]]]}
LINE = {"type": "LineString", "coordinates": [[-87.91, 37.92], [-87.90, 37.93]]}


class SceneBuilderTests(unittest.TestCase):
    def test_aoi_validation(self):
        self.assertEqual(scene.valid_bbox([-88.0, 37.8, -87.9, 38.0]), (-88.0, 37.8, -87.9, 38.0))
        for bbox in [[-88, 38, -89, 39], [-88, 37, -87, float("nan")], [-89, 37, -87, 38]]:
            with self.assertRaises(ValueError):
                scene.valid_bbox(bbox)

    def test_invalid_geometry(self):
        self.assertTrue(scene.valid_geometry(POLYGON, "building"))
        self.assertTrue(scene.valid_geometry(LINE, "road"))
        self.assertFalse(scene.valid_geometry({"type": "Polygon", "coordinates": [[[float("nan"), 0]]]}, "building"))
        self.assertFalse(scene.valid_geometry(LINE, "building"))

    def test_download_uses_real_object_ids_and_rejects_missing(self):
        bbox = scene.DEFAULT_BBOX
        first = {"objectIds": [8, 3]}
        second = {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {"objectid": 3, "lidaryear": "2018"}, "geometry": POLYGON},
            {"type": "Feature", "properties": {"objectid": 8, "lidaryear": "2018"}, "geometry": POLYGON},
        ]}
        with patch.object(scene, "query", side_effect=[(first, "0" * 64), (second, "1" * 64)]) as mock:
            features, provenance = scene.collect_layer("building", scene.BUILDINGS, bbox)
        self.assertEqual([f["id"] for f in features], ["IGIO:building:3", "IGIO:building:8"])
        self.assertEqual(provenance["source_object_count"], 2)
        self.assertEqual(len(provenance["raw_response_sha256"]), 2)
        self.assertEqual(features[0]["properties"]["height_m"], None)
        self.assertFalse(features[0]["properties"]["engineering_approved"])
        self.assertEqual(mock.call_count, 2)

        with patch.object(scene, "query", side_effect=[(first, "0" * 64),
                                                       ({"type": "FeatureCollection", "features": second["features"][:1]}, "1" * 64)]):
            with self.assertRaisesRegex(ValueError, "INCOMPLETE_DOWNLOAD"):
                scene.collect_layer("building", scene.BUILDINGS, bbox)

    def test_transient_timeout_retries_without_changing_source_bytes(self):
        raw = b'{"objectIds":[7,3]}'
        with patch.object(scene, "urlopen", side_effect=[TimeoutError("upstream timeout"), io.BytesIO(raw)]) as request, \
             patch.object(scene, "sleep") as sleep:
            payload, source_hash = scene.query(scene.BUILDINGS, {"returnIdsOnly": "true"})
        self.assertEqual(payload["objectIds"], [7, 3])
        self.assertEqual(source_hash, scene.digest(raw))
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_persistent_timeout_exhausts_retry_bound(self):
        with patch.object(scene, "urlopen", side_effect=TimeoutError("upstream timeout")) as request, \
             patch.object(scene, "sleep") as sleep:
            with self.assertRaises(TimeoutError):
                scene.query(scene.BUILDINGS, {"returnIdsOnly": "true"})
        self.assertEqual(request.call_count, scene.MAX_SOURCE_ATTEMPTS)
        self.assertEqual(sleep.call_count, scene.MAX_SOURCE_ATTEMPTS - 1)

    def test_arcgis_json_503_is_bounded_and_source_identity_retained(self):
        transient = b'{"error":{"code":503,"message":"Resource temporarily unavailable"}}'
        valid = b'{"objectIds":[7,3]}'
        with patch.object(scene, "urlopen", side_effect=[io.BytesIO(transient), io.BytesIO(valid)]) as request, \
             patch.object(scene, "sleep") as sleep:
            payload, source_hash = scene.query(scene.BUILDINGS, {"returnIdsOnly": "true"})
        self.assertEqual(payload["objectIds"], [7, 3])
        self.assertEqual(source_hash, scene.digest(valid))
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_persistent_arcgis_json_503_remains_a_release_blocker(self):
        transient = b'{"error":{"code":503,"message":"User could not access this resource"}}'
        with patch.object(scene, "urlopen", side_effect=[io.BytesIO(transient) for _ in range(scene.MAX_SOURCE_ATTEMPTS)]) as request, \
             patch.object(scene, "sleep") as sleep:
            with self.assertRaisesRegex(ValueError, "ARCGIS_QUERY_FAILED"):
                scene.query(scene.BUILDINGS, {"returnIdsOnly": "true"})
        self.assertEqual(request.call_count, scene.MAX_SOURCE_ATTEMPTS)
        self.assertEqual(sleep.call_count, scene.MAX_SOURCE_ATTEMPTS - 1)

    def test_nontransient_http_errors_do_not_retry(self):
        from urllib.error import HTTPError
        denied = HTTPError(scene.BUILDINGS, 403, "Forbidden", {}, None)
        with patch.object(scene, "urlopen", side_effect=denied) as request, \
             patch.object(scene, "sleep") as sleep:
            with self.assertRaises(HTTPError):
                scene.query(scene.BUILDINGS, {"returnIdsOnly": "true"})
        request.assert_called_once()
        sleep.assert_not_called()

    def test_output_bytes_are_reproducible_and_not_approved(self):
        b = ([{"type": "Feature", "id": "IGIO:building:1", "properties": {"source_objectid": 1}}], {"authority": "IGIO"})
        r = ([], {"authority": "IGIO"})
        payload = scene.build_scene(scene.DEFAULT_BBOX, b, r)
        with tempfile.TemporaryDirectory() as root:
            out, receipt = scene.write_scene(payload, Path(root))
            raw = out.read_bytes()
            rj = json.loads(receipt.read_text())
            self.assertEqual(scene.digest(raw), rj["sha256"])
            self.assertEqual(rj["feature_counts"], {"buildings": 1, "roads": 0})
            self.assertEqual(rj["regulatory_approval"], False)
            self.assertEqual(json.loads(raw)["terrain"]["height_datum"], "MUST_BE_VERIFIED_SEPARATELY")


if __name__ == "__main__":
    unittest.main()
