"""Synthetic survey checkpoint fixtures demonstrate only reproducible screening."""
from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from backend.merkle_evidence import build_manifest
from backend.survey.independent_control_gate import assess_checkpoints


class MerkleCheckpointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        meta = {
            "horizontalCrs": "EPSG:2966",
            "verticalDatum": "NAVD88", "geoidModel": "GEOID18",
            "units": "ftUS", "coordinateEpoch": "2010.00",
            "collectionDate": "2026-11-09",
        }
        self.ref = {**meta, "sourceAuthority": "SYNTHETIC_REFERENCE",
                    "points": []}
        self.obs = {**meta, "sourceAuthority": "SYNTHETIC_OBSERVATION",
                    "points": []}
        for i in range(7):
            self.ref["points"].append({
                "pointId": str(i), "x": float(i * 100), "y": float(i * 50),
                "z": 350.0 + i, "sigmaX": .01, "sigmaY": .01, "sigmaZ": .02,
            })
            self.obs["points"].append({
                "pointId": str(i), "x": float(i * 100) + .02, "y": float(i * 50) + .02,
                "z": 350.0 + i + .03, "sigmaX": .01, "sigmaY": .01, "sigmaZ": .02,
            })
        self.spec = {
            "schemaVersion": "tsm.survey.checkpoints.v1",
            "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88",
            "geoidModel": "GEOID18", "units": "ftUS",
            "coordinateEpoch": "2010.00", "minimumCheckpointCount": 5,
            "maximumHorizontalCombinedError": 0.15,
            "maximumVerticalCombinedError": 0.15,
        }
        self.write_docs()

    def write_docs(self):
        for name, document in (("reference.json", self.ref),
                               ("observation.json", self.obs), ("specification.json", self.spec)):
            (self.root / name).write_text(json.dumps(document))

    def run_assessment(self):
        manifest = build_manifest(self.root, [
            ("survey_reference", "reference.json"),
            ("survey_observation", "observation.json"),
            ("survey_spec", "specification.json"),
        ])
        return assess_checkpoints(self.root, manifest, specification_path="specification.json",
                                  reference_path="reference.json", observation_path="observation.json")

    def test_deterministic_uncertainty_calculation(self):
        first = self.run_assessment()
        second = self.run_assessment()
        self.assertEqual(first, second)
        self.assertTrue(first["declaredCheckpointAccuracyPass"])
        self.assertEqual(first["checkpointCount"], 7)
        self.assertFalse(first["professionalSealVerified"])
        self.assertFalse(first["surveyControlIndependentlyAuthenticated"])
        self.assertFalse(first["regulatoryApproval"])
        self.assertEqual(len(first["merkleRootSha256"]), 64)

    def test_actual_checkpoint_exceeds_tolerance(self):
        self.obs["points"][0]["z"] += 8.0
        self.write_docs()
        self.assertFalse(self.run_assessment()["declaredCheckpointAccuracyPass"])

    def test_mixed_geoid_rejected(self):
        self.obs["geoidModel"] = "EGM2008"
        self.write_docs()
        with self.assertRaisesRegex(ValueError, "MISMATCH"):
            self.run_assessment()

    def test_same_purported_source_rejected(self):
        self.obs["sourceAuthority"] = "SYNTHETIC_REFERENCE"
        self.write_docs()
        with self.assertRaisesRegex(ValueError, "REFERENCES_NOT_DISTINCT"):
            self.run_assessment()

    def test_tampered_merkle_rejected(self):
        manifest = build_manifest(self.root, [
            ("survey_reference", "reference.json"),
            ("survey_observation", "observation.json"),
            ("survey_spec", "specification.json"),
        ])
        (self.root / "observation.json").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "CHECKPOINT_MERKLE_INVALID"):
            assess_checkpoints(self.root, manifest, specification_path="specification.json",
                               reference_path="reference.json", observation_path="observation.json")

    def test_fabricated_missing_checkpoint_rejected(self):
        self.obs["points"].pop()
        self.write_docs()
        with self.assertRaisesRegex(ValueError, "COUNT_OR_ID_SET"):
            self.run_assessment()

    def test_nan_uncertainty_rejected(self):
        self.ref["points"][0]["sigmaZ"] = float("nan")
        self.write_docs()
        with self.assertRaisesRegex(ValueError, "NONFINITE"):
            self.run_assessment()


if __name__ == "__main__":
    unittest.main()
