"""Synthetic tests only: no real residential, parcel or AOI identifiers."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from publication_risk_inventory import classify_text, inventory  # noqa: E402


class PublicationRiskInventoryTests(unittest.TestCase):
    def test_text_categories_detect_known_synthetic_positive_controls(self):
        self.assertIn("street_address_syntax", classify_text("123 Example Road"))
        self.assertIn(
            "precise_coordinate_pair", classify_text("12.12345678, -42.12345678")
        )
        self.assertIn(
            "parcel_identifier_value", classify_text('parcel_id: "DEMO-123456789"')
        )
        self.assertIn("private_site_label", classify_text("private site anchor"))

    def test_only_aggregate_counts_are_emitted(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            sample = "123 Example Road; 12.12345678, -42.12345678"
            file = root / "tsm-console/public/synthetic-risk.txt"
            file.parent.mkdir(parents=True)
            file.write_text(sample, encoding="utf-8")
            other = root / "data/synthetic-check.json"
            other.parent.mkdir(parents=True)
            other.write_text('{"ok": true}', encoding="utf-8")
            report = inventory(root, [
                "tsm-console/public/synthetic-risk.txt",
                "data/synthetic-check.json",
                "tsm-console/public/synthetic-risk.txt",  # duplicate path
            ])
            self.assertEqual(report["candidateFilesChecked"], 2)
            self.assertEqual(report["filesWithPotentialIndicators"], 1)
            self.assertEqual(
                report["indicatorFileCounts"]["street_address_syntax"], 1
            )
            self.assertEqual(
                report["indicatorFileCounts"]["precise_coordinate_pair"], 1
            )
            self.assertFalse(report["publicationApproved"])
            self.assertFalse(report["historyOrPagesScanned"])
            output = json.dumps(report)
            for secret in ["123 Example Road", "12.12345678", "synthetic-risk.txt"]:
                self.assertNotIn(secret, output)

    def test_large_unreadable_and_binary_are_not_treated_as_clear(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            f = root / "docs/example.json"
            f.parent.mkdir(parents=True)
            f.write_bytes(b"\x00secret")
            report = inventory(root, ["docs/example.json"])
            self.assertEqual(report["candidateFilesChecked"], 0)
            self.assertEqual(report["excludedFileCounts"]["binary_bytes"], 1)
            self.assertEqual(report["status"], "OWNER_PRIVACY_REVIEW_REQUIRED")


if __name__ == "__main__":
    unittest.main()
