"""Cesium release receipts must bind actual bytes, not claimed coverage."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / "scripts/release/cesium_published_receipt.py"
spec = importlib.util.spec_from_file_location("cesium_receipt", FILE)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
SHA = "e" * 40
BASE = "https://example.org/Tri-State-Systems-Manager/"


def prepare(dist):
    for name in release.REQUIRED:
        path = dist / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(("real fixture byte payload: " + name).encode())
    return release.create(dist, BASE, SHA, "12455")


class ReleaseReceiptTests(unittest.TestCase):
    def test_receipt_seals_and_rechecks_every_local_file(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            receipt = prepare(dist)
            self.assertEqual(receipt["status"], "BUILD_RECEIPT_CREATED")
            self.assertEqual(release.verify_local(dist, SHA)["fileCount"], len(release.REQUIRED))
            json_record = json.loads((dist / release.RECEIPT).read_bytes())
            self.assertFalse(json_record["surveyAccuracyVerified"])
            self.assertEqual(json_record["fileCount"], len(release.REQUIRED))
            self.assertEqual(receipt["sha256"], hashlib.sha256((dist / release.RECEIPT).read_bytes()).hexdigest())

    def test_modified_or_extra_local_file_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            prepare(dist)
            (dist / "index.html").write_text("modified", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "changed"):
                release.verify_local(dist, SHA)

    def test_extra_file_not_in_receipt_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            prepare(dist)
            (dist / "surprise.dat").write_bytes(b"new")
            with self.assertRaisesRegex(ValueError, "changed"):
                release.verify_local(dist, SHA)

    def test_missing_required_file_prevents_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            (dist / "index.html").write_text("only")
            with self.assertRaisesRegex(ValueError, "Required"):
                release.create(dist, BASE, SHA, "12455")

    def test_refuse_replacement_receipts(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            prepare(dist)
            with self.assertRaisesRegex(ValueError, "overwrite"):
                release.create(dist, BASE, SHA, "12455")

    def test_published_bytes_are_compared_to_independent_build_digest(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            proof = prepare(dist)
            def fetcher(base, path, limit):
                assert base == BASE
                raw = (dist / path).read_bytes()
                if len(raw) > limit:
                    raise ValueError("oversize")
                return raw
            result = release.verify_published(BASE, proof["sha256"], SHA,
                samples=("cesium/index.html", "3d-tiles/tileset.json"), fetcher=fetcher)
            self.assertEqual(result["status"], "REMOTE_SAMPLES_MATCH_BUILD")
            self.assertEqual(result["sampledFileCount"], 2)
            self.assertEqual(result["samplingLimitation"], "NOT_ALL_PUBLISHED_FILES_DOWNLOADED")

    def test_remote_modified_sample_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            proof = prepare(dist)
            def fetcher(base, path, limit):
                return b"wrong" if path == "cesium/index.html" else (dist / path).read_bytes()
            with self.assertRaisesRegex(ValueError, "differs"):
                release.verify_published(BASE, proof["sha256"], SHA,
                    samples=("cesium/index.html",), fetcher=fetcher)

    def test_remote_wrong_receipt_anchor_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            prepare(dist)
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                release.verify_published(BASE, "0" * 64, SHA, fetcher=lambda base, path, limit:
                    (dist / path).read_bytes())

    def test_hostile_path_and_base_rejected(self):
        for path in ("../secret", "/etc/passwd", "assets/../../secret", "a%2fb", "a\\b"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                release.safe_name(path)
        for base in ("http://example.org/release/", "https://example.org/no-slash",
                     "https://example.org/a/../", "https://u:pw@example.org/a/"):
            with self.subTest(base=base), self.assertRaises(ValueError):
                release.site_base(base)

    def test_symlink_in_artifact_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            for name in release.REQUIRED:
                p = dist / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(b"x")
            (dist / "link").symlink_to(dist / "index.html")
            with self.assertRaisesRegex(ValueError, "Symlinks"):
                release.create(dist, BASE, SHA, "12")


if __name__ == "__main__":
    unittest.main()
