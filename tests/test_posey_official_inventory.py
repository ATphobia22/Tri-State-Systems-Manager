"""Deterministic synthetic tests; no official data or fake validated counts."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "scripts/geospatial/posey_official_inventory.py"
SPEC = importlib.util.spec_from_file_location("posey_official_inventory", MODULE)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class OfficialIdentityTests(unittest.TestCase):
    def test_count_and_id_set_are_derived_and_complete(self):
        self.assertEqual(mod.validate_ids([17, 3, 8], 3), [3, 8, 17])
        for ids, count in (
            ([17, 3], 3), ([3, 3], 2), ([3, True], 2),
            (["3", 9], 2), ([], 0), ([1], True),
        ):
            with self.subTest(ids=ids, count=count), self.assertRaises(ValueError):
                mod.validate_ids(ids, count)

    def test_snapshot_identity_check_never_invents_heights(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "snapshot.geojson"
            point = {"type": "Polygon", "coordinates": [[[0, 0], [0, 1], [1, 1], [0, 0]]]}
            features = [
                {"type": "Feature", "properties": {"igioObjectId": ident, "county": "Posey"},
                 "geometry": point} for ident in (3, 8, 17)
            ]
            path.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
            result = mod.validate_snapshot(path, [3, 8, 17])
            self.assertTrue(result["identity_complete"])
            self.assertFalse(result["survey_certified"])
            self.assertRegex(result["sha256"], r"^[0-9a-f]{64}$")
            self.assertFalse(mod.validate_snapshot(path, [3, 9, 17])["identity_complete"])
            features.append(features[0])
            path.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
            self.assertFalse(mod.validate_snapshot(path, [3, 8, 17])["identity_complete"])

    def test_geometry_batches_are_complete_and_hashed(self):
        queries = []

        def fake_request(path, args):
            queries.append(args)
            ids = [int(value) for value in args["objectIds"].split(",")]
            payload = {"features": [
                {"attributes": {"objectid": value, "county": "Posey"},
                 "geometry": {"rings": [[[0, 0], [1, 0], [0, 0]]]}}
                for value in ids]}
            return payload, {"request": mod.LAYER + "/query",
                             "sha256": "f" * 64, "bytes": 12}
        with tempfile.TemporaryDirectory() as root:
            with patch.object(mod, "request_json", side_effect=fake_request):
                receipts = mod.download_geometry([3, 8, 17], Path(root))
            self.assertEqual(len(receipts), 1)
            stored = (Path(root) / receipts[0]["file"]).read_bytes()
            self.assertEqual(receipts[0]["sha256"], mod.digest(stored))
            self.assertEqual(receipts[0]["object_id_count"], 3)
            self.assertEqual(queries[0]["outSR"], 4326)

    def test_missing_response_objectid_is_never_silent(self):
        def missing(_path, _args):
            return {"features": []}, {"request": "x", "sha256": "f" * 64}
        with tempfile.TemporaryDirectory() as root:
            with patch.object(mod, "request_json", side_effect=missing):
                with self.assertRaises(ValueError):
                    mod.download_geometry([1], Path(root))

    def test_official_inventory_is_not_a_height_certification(self):
        metadata = {"name": "Indiana Building Footprints 2016-2020",
                    "objectIdField": "objectid", "hasZ": False,
                    "spatialReference": {"latestWkid": 3857},
                    "editingInfo": {"lastEditDate": 1234}}

        def fake_request(path, args):
            if path == "":
                return metadata, {"request": "meta", "sha256": "a" * 64}
            if "returnCountOnly" in args:
                return {"count": 2}, {"request": "count", "sha256": "b" * 64}
            return {"objectIdFieldName": "objectid", "objectIds": [7, 2]}, {
                "request": "ids", "sha256": "c" * 64,
            }
        with patch.object(mod, "request_json", side_effect=fake_request):
            receipt = mod.build_inventory()
        self.assertEqual(receipt["official_feature_count"], 2)
        self.assertFalse(receipt["geometry_download_complete"])
        self.assertFalse(receipt["heights_complete"])
        self.assertFalse(receipt["survey_grade"])
        self.assertFalse(receipt["regulatory_use"])
        self.assertEqual(receipt["source_crs_wkid"], 3857)

    def test_source_changes_during_download_are_rejected(self):
        count = 0

        def fake_request(path, args):
            nonlocal count
            if path == "":
                count += 1
                return {"name": "Indiana Building Footprints 2016-2020",
                        "objectIdField": "objectid", "hasZ": False,
                        "spatialReference": {"latestWkid": 3857},
                        "editingInfo": {"lastEditDate": count}}, {"sha256": "a" * 64}
            if "returnCountOnly" in args:
                return {"count": 1}, {"sha256": "a" * 64}
            return {"objectIds": [2], "objectIdFieldName": "objectid"}, {"sha256": "a" * 64}
        with patch.object(mod, "request_json", side_effect=fake_request):
            with self.assertRaises(ValueError):
                mod.build_inventory()

    def test_sha256_sidecar_binds_canonical_bytes_and_cannot_overwrite(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "receipt.json"
            expected = mod.write_sealed({"a": 1, "status": "UNREVIEWED"}, path)
            self.assertEqual(expected, mod.digest(path.read_bytes()))
            self.assertEqual(
                path.with_suffix(".json.sha256").read_text(),
                f"{expected}  receipt.json\n",
            )
            with self.assertRaises(FileExistsError):
                mod.write_sealed({"a": 2}, path)


if __name__ == "__main__":
    unittest.main()
