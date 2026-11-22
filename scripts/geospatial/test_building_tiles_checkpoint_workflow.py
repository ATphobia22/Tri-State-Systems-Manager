#!/usr/bin/env python3
"""Fast tests for 5-hour COPC job checkpoint and workflow triggering policy."""
from pathlib import Path
import re
import unittest

WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/building-3d-tiles.yml"


class BuildingTilesWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_checkpoint_always_uploaded_before_strict_acceptance_gate(self):
        m = re.search(
            r"- name: Preserve completed COPC checkpoint[^\n]*\n"
            r"\s*if: always\(\)\n\s*uses: actions/upload-artifact@",
            self.text,
        )
        self.assertIsNotNone(m)
        hard_gate = self.text.index("- name: Gate on all source-derived height-linked features")
        self.assertLess(m.start(), hard_gate)

    def test_retention_and_resume_remain_available(self):
        self.assertIn("name: tsm-copc-checkpoint-${{ github.run_id }}", self.text)
        self.assertIn("retention-days: 30", self.text)
        self.assertIn("inputs.resume_run_id != ''", self.text)
        self.assertIn("Restore checkpoint from a previous failed run", self.text)

    def test_acceptance_must_not_be_weakened(self):
        self.assertIn('if len(ok) != expected:', self.text)
        self.assertIn("ACCEPTANCE MET: {expected}/{expected} source-derived height-linked", self.text)
        self.assertIn("Validate final tileset with Cesium validator", self.text)
        self.assertIn("posey_official_inventory.py", self.text)
        self.assertIn("official_sorted_objectids_sha256", self.text)
        self.assertNotIn("EXPECTED_BUILDINGS: '23082'", self.text)

    def test_workflow_only_edit_does_not_start_five_hour_run(self):
        push = self.text.split("\n  push:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertNotIn("- '.github/workflows/building-3d-tiles.yml'", push)
        self.assertIn("- 'scripts/geospatial/extract_derived_heights_copc.py'", push)
        self.assertIn("workflow_dispatch:", self.text)
        self.assertIn("concurrency:", self.text)
        self.assertIn("cancel-in-progress: false", self.text)

    def test_artifact_only_public_evidence(self):
        self.assertIn("/tmp/tsm-igio/copc-checkpoint/", self.text)
        self.assertIn("if-no-files-found: ignore", self.text)


if __name__ == "__main__":
    unittest.main()
