#!/usr/bin/env python3
"""Network-free tests for deterministic, license-gated visual-asset intake."""
import io
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from curate_visual_assets import IntakeError, acquire, plan, validate_registry, validate_url

MD5_ABC = "900150983cd24fb0d6963f7d28e17f72"
SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def registry(provider="polyhaven", expected_md5=MD5_ABC):
    return {"schemaVersion": "tsm.cinematic-asset-sources.v1", "assets": [{
        "id": "demo-hdri", "provider": provider,
        "source_uri": "https://polyhaven.com/a/demo",
        "license": "CC0-1.0" if provider == "polyhaven" else "FAB_STANDARD",
        "license_reviewed": True, "classification": "VISUALIZATION_ONLY",
        "engineeringUse": False, "regulatoryUse": False,
        "files": [{"name": "maps/demo.hdr",
                   "download_url": "https://dl.polyhaven.org/file/demo.hdr",
                   "max_bytes": 128, "md5": expected_md5}]
    }]}


class FakeResponse(io.BytesIO):
    def __init__(self, content=b"abc", url="https://dl.polyhaven.org/file/demo.hdr"):
        super().__init__(content)
        self.url = url
        self.headers = {"Content-Length": str(len(content))}

    def geturl(self):
        return self.url


class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory(prefix="tsm-cc0-intake-test-")
        self.addCleanup(self.workspace.cleanup)
        self.root = Path(self.workspace.name)

    def test_default_is_offline_dry_run(self):
        result = plan(registry(), "demo-hdri")
        self.assertTrue(result["eligible_for_cc0_intake"])
        self.assertFalse(result["download_executed"])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_valid_pinned_download_and_receipt(self):
        dest = self.root / "demo"
        calls = []
        def opener(request, timeout):
            calls.append((request.full_url, request.get_header("User-agent")))
            return FakeResponse()
        receipt = acquire(registry(), "demo-hdri", dest, opener=opener,
                          now=datetime(2026, 11, 14, tzinfo=timezone.utc))
        self.assertEqual((dest / "maps/demo.hdr").read_bytes(), b"abc")
        self.assertEqual(receipt["files"][0]["sha256"], SHA256_ABC)
        self.assertTrue(receipt["public_redistribution_eligible"])
        self.assertFalse(receipt["render_ready"])
        self.assertEqual(len(calls), 1)
        self.assertIn("TriStateSystemsManager", str(calls[0][1]))
        self.assertEqual(json.loads((dest / "acquisition-receipt.json").read_text())["id"], "demo-hdri")
        with self.assertRaisesRegex(IntakeError, "already exists"):
            acquire(registry(), "demo-hdri", dest, opener=opener)

    def test_reject_source_digest_mismatch_no_partial_files(self):
        dest = self.root / "tampered"
        with self.assertRaisesRegex(IntakeError, "MD5 mismatch"):
            acquire(registry(expected_md5="0" * 32), "demo-hdri", dest,
                    opener=lambda request, timeout: FakeResponse())
        self.assertFalse(dest.exists())

    def test_reject_oversized_stream(self):
        dest = self.root / "oversized"
        with self.assertRaisesRegex(IntakeError, "budget"):
            acquire(registry(), "demo-hdri", dest,
                    opener=lambda request, timeout: FakeResponse(b"a" * 129))
        self.assertFalse(dest.exists())

    def test_reject_external_redirect(self):
        with self.assertRaisesRegex(IntakeError, "approved provider"):
            acquire(registry(), "demo-hdri", self.root / "redirect",
                    opener=lambda request, timeout: FakeResponse(
                        url="https://evil.example/malware.hdr"))

    def test_disallow_unreviewed_and_restricted_sources(self):
        unreviewed = registry()
        unreviewed["assets"][0]["license_reviewed"] = False
        with self.assertRaisesRegex(IntakeError, "not approved"):
            acquire(unreviewed, "demo-hdri", self.root / "no", opener=None)
        fab = registry(provider="fab")
        self.assertFalse(plan(fab, "demo-hdri")["eligible_for_cc0_intake"])
        with self.assertRaisesRegex(IntakeError, "not approved"):
            acquire(fab, "demo-hdri", self.root / "no2", opener=None)

    def test_reject_path_traversal_duplicate_and_regulatory_claims(self):
        for unsafe in ("../private", "/abs", "a/../b", "x\\y", "x//y"):
            case = registry()
            case["assets"][0]["files"][0]["name"] = unsafe
            with self.subTest(unsafe=unsafe), self.assertRaises(IntakeError):
                validate_registry(case)
        case = registry()
        case["assets"][0]["engineeringUse"] = True
        with self.assertRaisesRegex(IntakeError, "engineering authority"):
            validate_registry(case)

    def test_url_policy(self):
        for url in ("http://dl.polyhaven.org/file/a", "https://evil.example/a",
                    "https://dl.polyhaven.org.evil.example/a",
                    "https://user:pass@dl.polyhaven.org/a",
                    "https://dl.polyhaven.org:8443/file/a"):
            with self.subTest(url=url), self.assertRaises(IntakeError):
                validate_url(url, "polyhaven")


if __name__ == "__main__":
    unittest.main()
