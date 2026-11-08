"""Offline tests: no FEMA HTTP calls or fabricated authoritative records."""
import importlib.util
import pathlib
import tempfile
import unittest

PATH = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "geospatial" / "acquire_nfhl_effective.py"
SPEC = importlib.util.spec_from_file_location("acquire_nfhl_effective", PATH)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class NFHLTests(unittest.TestCase):
    def test_rejects_bad_bbox(self):
        for bbox in [(0, 0, 0, 1), (0, 0, 3, 1), (float("nan"), 0, 1, 1)]:
            with self.assertRaises(ValueError):
                mod.validate_bbox(bbox)

    def test_complete_evidence(self):
        def fake(url, params):
            if url.endswith("/query") and params.get("returnIdsOnly") == "true":
                return {"objectIds": [2, 1]}
            if url.endswith("/query"):
                return {"type": "FeatureCollection", "features": [
                    {"type": "Feature", "properties": {"OBJECTID": int(v)},
                     "geometry": {"type": "Point", "coordinates": [0, 0]}}
                    for v in params["objectIds"].split(",")]}
            return {"objectIdField": "OBJECTID", "extent": {"spatialReference": {"wkid": 4269}}}
        with tempfile.TemporaryDirectory() as folder:
            manifest = mod.acquire_layer(28, (-89, 37, -88, 38),
                                         pathlib.Path(folder), page_size=1, fetch=fake)
            self.assertEqual(manifest["retrieved_count"], 2)
            self.assertEqual(len(manifest["chunks"]), 2)
            self.assertEqual(manifest["vertical_datum"], "UNVERIFIED")

    def test_incomplete_response_is_rejected(self):
        def fake(url, params):
            if url.endswith("/query") and params.get("returnIdsOnly") == "true":
                return {"objectIds": [1]}
            if url.endswith("/query"):
                return {"type": "FeatureCollection", "features": []}
            return {"objectIdField": "OBJECTID"}
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(mod.AcquisitionError):
                mod.acquire_layer(28, (-89, 37, -88, 38), pathlib.Path(folder), fetch=fake)

    def test_rejects_unregistered_layer(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                mod.acquire_layer(999, (-89, 37, -88, 38), pathlib.Path(folder))


if __name__ == "__main__":
    unittest.main()
