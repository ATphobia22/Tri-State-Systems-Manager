"""Offline tests for bounded public-source acquisition receipts."""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[2] / "scripts/evidence/tsm_manifest_builder.py"
spec = importlib.util.spec_from_file_location("tsm_manifest_builder", PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class FakeResponse:
    status = 200
    headers = {"Content-Type": "application/json"}
    def __init__(self, content):
        self.stream = io.BytesIO(content)
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, size):
        return self.stream.read(size)


class FakeOpener:
    def __init__(self, content):
        self.content = content
    def open(self, request, timeout):
        return FakeResponse(self.content)


class HarvesterTests(unittest.TestCase):
    def setUp(self):
        self.item = {
            "dataset_id": "fixture",
            "source_url": "https://api.water.noaa.gov/nwps/v1/gauges/fixture",
            "expected_epsg": 4326,
            "vertical_datum": "NAVD88",
        }

    def test_hash_is_not_upstream_verification(self):
        with patch.object(mod, "validate_url", return_value=self.item["source_url"]):
            result = mod.harvest_one(self.item, opener=FakeOpener(b"abc"))
        self.assertEqual(result["sha256"], "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        self.assertEqual(result["verification_state"], "RETRIEVED_HASHED_UNVERIFIED_UPSTREAM")
        self.assertFalse(result["upstream_checksum_match"])
        self.assertFalse(result["dataset_crs_verified"])
        self.assertFalse(result["vertical_datum_verified"])

    def test_size_limit_fails_without_digest(self):
        with patch.object(mod, "validate_url", return_value=self.item["source_url"]):
            result = mod.harvest_one(self.item, max_bytes=2, opener=FakeOpener(b"abc"))
        self.assertEqual(result["verification_state"], "VERIFICATION_FAILED")
        self.assertIsNone(result["sha256"])

    def test_expected_digest_mismatch(self):
        self.item["expected_sha256"] = "0" * 64
        with patch.object(mod, "validate_url", return_value=self.item["source_url"]):
            result = mod.harvest_one(self.item, opener=FakeOpener(b"abc"))
        self.assertEqual(result["verification_state"], "EXPECTED_DIGEST_MISMATCH")

    def test_reject_untrusted_hosts(self):
        with self.assertRaises(ValueError):
            mod.validate_url("https://localhost/private")
        with self.assertRaises(ValueError):
            mod.validate_url("http://api.water.noaa.gov/")
        with self.assertRaises(ValueError):
            mod.validate_url("https://api.water.noaa.gov@evil.example/")

    def test_atomic_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "receipt.json"
            mod.write_atomic(path, {"state": "fixture"})
            self.assertEqual(json.loads(path.read_text())["state"], "fixture")


if __name__ == "__main__":
    unittest.main()
