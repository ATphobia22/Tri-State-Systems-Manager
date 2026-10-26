"""Dependency-free, synthetic regression tests for pinned IGIO offline cache."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ACQUIRE = HERE / "acquire-and-enrich-igio-posey-buildings.py"
SPEC = importlib.util.spec_from_file_location("igio_cache_verifier", HERE / "verify_igio_footprint_cache.py")
assert SPEC and SPEC.loader
verify = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verify)


def feature(sid: int = 100, *, offset: float = 0.0) -> dict:
    x, y = -88.0 + offset, 37.9
    return {
        "type": "Feature",
        "properties": {"igioObjectId": sid, "county": "Posey", "elevationCoverage": "UNAVAILABLE"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[x, y], [x + 0.001, y],
                             [x + 0.001, y + 0.001], [x, y + 0.001], [x, y]]],
        },
    }


def snapshot(features: list[dict], **attributes) -> dict:
    return {
        "type": "FeatureCollection",
        "sourceAuthority": "Indiana Geographic Information Office",
        "sourceDataset": "Indiana Building Footprints 2016-2020",
        "geometryCrs": "EPSG:4326",
        "elevationVerticalDatum": "NAVD88",
        "elevationVerticalUnits": "feet",
        "features": features,
        **attributes,
    }


class PinnedIGIOCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.file = self.root / "cache.geojson"

    def write(self, data) -> str:
        self.file.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
        return hashlib.sha256(self.file.read_bytes()).hexdigest()

    def test_verified_snapshot_reports_provenance_not_certification(self):
        sha = self.write(snapshot([feature(3), feature(7, offset=0.003)]))
        report = verify.verify_igio_snapshot(self.file, expected_sha256=sha, expected_count=2)
        self.assertEqual(report["featureCount"], 2)
        self.assertEqual(report["uniqueSourceObjectIds"], 2)
        self.assertEqual(report["status"], "PINNED_BYTES_AND_IDS_VERIFIED")
        self.assertFalse(report["sourceVintageIndependentlyVerified"])
        self.assertFalse(report["navd88AccuracyVerified"])
        self.assertFalse(report["heightsVerified"])
        self.assertFalse(report["engineeringUse"])

    def test_mismatched_digest_fails_before_parsing(self):
        self.write(snapshot([feature()]))
        with self.assertRaisesRegex(verify.CachedSourceError, "SHA-256"):
            verify.verify_igio_snapshot(self.file, expected_sha256="a" * 64, expected_count=1)

    def test_count_and_identity_must_both_reconcile(self):
        sha = self.write(snapshot([feature(1), feature(1, offset=0.003)]))
        with self.assertRaisesRegex(verify.CachedSourceError, "duplicate"):
            verify.verify_igio_snapshot(self.file, expected_sha256=sha, expected_count=2)
        sha = self.write(snapshot([feature(1)]))
        with self.assertRaisesRegex(verify.CachedSourceError, "count"):
            verify.verify_igio_snapshot(self.file, expected_sha256=sha, expected_count=2)

    def test_wrong_datum_projected_geometry_and_invalid_ring_rejected(self):
        sha = self.write(snapshot([feature()], elevationVerticalDatum="NGVD29"))
        with self.assertRaisesRegex(verify.CachedSourceError, "datum"):
            verify.verify_igio_snapshot(self.file, expected_sha256=sha, expected_count=1)
        wrong = feature()
        wrong["geometry"]["coordinates"][0] = [
            [2680000, 950000], [2681000, 950000], [2681000, 951000], [2680000, 950000]
        ]
        sha = self.write(snapshot([wrong]))
        with self.assertRaisesRegex(verify.CachedSourceError, "Indiana"):
            verify.verify_igio_snapshot(self.file, expected_sha256=sha, expected_count=1)
        bad = feature()
        bad["geometry"]["coordinates"][0][-1] = [-88.01, 37.91]
        sha = self.write(snapshot([bad]))
        with self.assertRaisesRegex(verify.CachedSourceError, "closed"):
            verify.verify_igio_snapshot(self.file, expected_sha256=sha, expected_count=1)

    def test_true_offline_mode_uses_local_cache_with_no_network(self):
        sha = self.write(snapshot([feature(1), feature(2, offset=0.003)]))
        output = self.root / "derived.geojson"
        proc = subprocess.run([
            sys.executable, str(ACQUIRE),
            "--offline-only", "--cache-snapshot", str(self.file),
            "--fallback-sha256", sha, "--expected-count", "2",
            "--output", str(output),
            # No --boundary or --dem-root: true cache restore must not
            # require a live source, parcel boundary or resampling.
        ], capture_output=True, text=True, check=False, timeout=30)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(output.read_bytes(), self.file.read_bytes())
        receipt = json.loads((self.root / "derived.geojson.receipt.json").read_text())
        self.assertEqual(receipt["fallbackOrigin"], "local-offline-cache")
        self.assertFalse(receipt["releaseAcceptance"])
        self.assertEqual(receipt["geojsonSha256"], sha)
        self.assertEqual(
            (self.root / "derived.geojson.sha256").read_text().split()[0], sha
        )

    def test_offline_missing_or_corrupt_cache_never_falls_back_to_remote(self):
        sha = self.write(snapshot([feature()]))
        proc = subprocess.run([
            sys.executable, str(ACQUIRE), "--offline-only",
            "--cache-snapshot", str(self.root / "nonexistent.geojson"),
            "--fallback-sha256", sha, "--expected-count", "1",
            "--output", str(self.root / "out.geojson"),
        ], capture_output=True, text=True, check=False, timeout=30)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("SOURCE_UNAVAILABLE", proc.stderr)
        self.assertFalse((self.root / "out.geojson").exists())

        corrupt = self.root / "out.geojson"
        proc = subprocess.run([
            sys.executable, str(ACQUIRE), "--offline-only",
            "--cache-snapshot", str(self.file),
            "--fallback-sha256", "f" * 64, "--expected-count", "1",
            "--output", str(corrupt),
        ], capture_output=True, text=True, check=False, timeout=30)
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse(corrupt.exists())


if __name__ == "__main__":
    unittest.main()
