"""Negative tests: a file or startup smoke receipt must never certify UE Shipping."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.release.shipping_acceptance_evidence import assess_shipping_acceptance


def synthetic_amd64_pe(path: Path) -> None:
    """Headers only; deliberately NOT a runnable UE binary."""
    data = bytearray(4096)
    data[:2] = b"MZ"
    data[0x3c:0x40] = (128).to_bytes(4, "little")
    data[128:132] = b"PE\x00\x00"
    data[132:134] = (0x8664).to_bytes(2, "little")
    data[152:154] = (0x20b).to_bytes(2, "little")
    path.write_bytes(data)


class ShippingAcceptanceEvidenceTest(unittest.TestCase):
    def test_missing_files_cannot_certify(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = assess_shipping_acceptance(root / "none.exe", root / "none.log")
            self.assertFalse(report["certified"])

    def test_arbitrary_exe_and_text_log_cannot_certify(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            exe, log = root / "shipping.exe", root / "airgap.log"
            exe.write_text("this is not an executable", encoding="utf-8")
            log.write_text("ALL GATES PASSED", encoding="utf-8")
            report = assess_shipping_acceptance(exe, log)
            self.assertFalse(report["certified"])

    def test_process_smoke_receipt_is_not_headed_acceptance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            exe, receipt = root / "shipping.exe", root / "offline-smoke-evidence.json"
            synthetic_amd64_pe(exe)
            receipt.write_text(json.dumps({
                "schema": "tsm.ue58.windows11.offline-smoke.v1",
                "classification": "PROCESS_START_OBSERVED_INTERACTION_PENDING",
                "processStarted": True, "processAliveAtObservation": True,
                "firewallIsolationApplied": True, "humanReviewRequired": True,
            }), encoding="utf-8")
            report = assess_shipping_acceptance(exe, receipt)
            self.assertFalse(report["certified"])
            self.assertIn("not independently accepted", report["reason"])

    def test_claim_of_approval_without_artifact_hashes_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            exe, receipt = root / "shipping.exe", root / "offline-smoke-evidence.json"
            synthetic_amd64_pe(exe)
            receipt.write_text(json.dumps({
                "schema": "tsm.ue58.windows11.offline-smoke.v1",
                "classification": "INDEPENDENTLY_ACCEPTED",
                "humanReviewRequired": False,
                "independentReview": {"reviewer": "Test Reviewer", "reviewedAtUtc": "2026-11-17T00:00:00Z"},
                "engineVersion": "5.8",
                "sourceCommit": "a" * 40,
                "executableSha256": "0" * 64,
            }), encoding="utf-8")
            report = assess_shipping_acceptance(exe, receipt)
            self.assertFalse(report["certified"])
            self.assertIn("SHA-256", report["reason"])


if __name__ == "__main__":
    unittest.main()
