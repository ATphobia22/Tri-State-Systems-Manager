"""Milestone A synthetic fixture tests; these test rows are NEVER publication evidence."""
import csv
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/evidence/freeze_milestone_a.py"
SOURCE = ROOT / "evidence/milestone-a"
EXPECTED = 23082


def command(root, mode):
    return subprocess.run([sys.executable, str(SCRIPT), mode, "--root", str(root)],
                          text=True, capture_output=True, check=False)


class MilestoneAEvidenceTests(unittest.TestCase):
    def test_tracked_draft_is_valid_and_contains_no_unauthenticated_digest(self):
        r = command(ROOT, "--lint")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse((SOURCE / "manifest.milestone-a.sha256.txt").exists())
        data = json.loads((SOURCE / "manifest.milestone-a.json").read_text())
        self.assertEqual(data["status"], "DRAFT_UNVERIFIED")
        self.assertEqual(data["scope"]["expected_source_building_ids"], EXPECTED)
        self.assertTrue(all(i["sha256"] is None for i in data["frozen_inputs"]))

    def test_freeze_refuses_empty_templates(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp) / "evidence/milestone-a"
            base.mkdir(parents=True)
            for name in ("manifest.milestone-a.json", "posey_buildings_source.csv",
                         "posey_reconciliation.csv", "posey_style.json"):
                shutil.copy2(SOURCE / name, base / name)
            result = command(temp, "--freeze")
            self.assertEqual(result.returncode, 2)
            self.assertIn("23082", result.stderr)
            self.assertFalse((base / "manifest.milestone-a.sha256.txt").exists())

    def test_freeze_and_verify_exact_23082_synthetic_records_and_detect_tampering(self):
        # Synthetic performance/validation fixture ONLY, never a Posey building claim.
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp) / "evidence/milestone-a"
            base.mkdir(parents=True)
            for name in ("manifest.milestone-a.json", "posey_style.json"):
                shutil.copy2(SOURCE / name, base / name)
            manifest_path = base / "manifest.milestone-a.json"
            metadata = json.loads(manifest_path.read_text())
            metadata["source"].update({
                "service_url": "https://example.invalid/TEST_ONLY",
                "source_snapshot_utc": "2026-11-17T00:00:00Z",
                "acquisition_utc": "2026-11-17T00:00:00Z",
                "crs": "EPSG:4326",
                "units": "m",
                "vertical_datum": "NONE: no height in synthetic test",
                "license_review": "APPROVED",
                "coverage_verification": "VERIFIED",
            })
            manifest_path.write_text(json.dumps(metadata, indent=2) + "\n")
            with (base / "posey_buildings_source.csv").open("w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["source_object_id", "county_geoid", "source_dataset",
                                 "footprint_evidence_sha256", "height_source", "height_m",
                                 "vertical_datum", "acquired_at_utc"])
                for identity in range(1, EXPECTED + 1):
                    digest = hashlib.sha256(f"SYNTHETIC-NOT-GEOMETRY:{identity}".encode()).hexdigest()
                    writer.writerow([identity, "18129", "TEST_ONLY", digest,
                                     "UNAVAILABLE", "", "", "2026-11-17T00:00:00Z"])
            with (base / "posey_reconciliation.csv").open("w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["source_object_id", "osm_element_type", "osm_element_id",
                                 "geometry_iou", "match_status", "height_source",
                                 "decision_reason", "reviewed_at_utc"])
                for identity in range(1, EXPECTED + 1):
                    writer.writerow([identity, "", "", "", "UNMATCHED",
                                     "UNAVAILABLE", "TEST_ONLY", ""])
            done = command(temp, "--freeze")
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertTrue((base / "manifest.milestone-a.sha256.txt").exists())
            verified = command(temp, "--verify")
            self.assertEqual(verified.returncode, 0, verified.stderr)
            repeated = command(temp, "--freeze")
            self.assertEqual(repeated.returncode, 2)
            self.assertIn("cannot be overwritten", repeated.stderr)
            with (base / "posey_style.json").open("a") as f:
                f.write(" ")
            tampered = command(temp, "--verify")
            self.assertEqual(tampered.returncode, 2)
            self.assertIn("changed after freeze", tampered.stderr)


if __name__ == "__main__":
    unittest.main()
