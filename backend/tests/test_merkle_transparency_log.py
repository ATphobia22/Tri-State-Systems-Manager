"""Merkle transparency log tests: prefix roots, inclusion, tampering and immutability."""
from __future__ import annotations
import copy
import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from backend.merkle_evidence import build_manifest
from backend.merkle_transparency_log import SQLiteMerkleEvidenceLog


class MerkleLogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db_path = self.root / "evidence.sqlite"
        self.log = SQLiteMerkleEvidenceLog(self.db_path)
        (self.root / "source.json").write_text("government-input-fixture")
        (self.root / "model.txt").write_text("solver-output-fixture")

    def manifest(self, name):
        return build_manifest(self.root, [("source", name)])

    def test_append_verify_and_prove_two_dossiers(self):
        first = self.log.append(dossier_id="posey:source", role="government",
                                evidence_root=self.root, manifest=self.manifest("source.json"))
        second = self.log.append(dossier_id="posey:model", role="hydrology",
                                 evidence_root=self.root, manifest=self.manifest("model.txt"))
        self.assertNotEqual(first["logRootSha256"], second["logRootSha256"])
        self.assertEqual(first["treeSize"], 1)
        self.assertEqual(second["treeSize"], 2)
        self.assertTrue(self.log.verify_integrity())
        for label in ("posey:source", "posey:model"):
            proof = self.log.prove_dossier(label)
            self.assertTrue(self.log.verify_dossier_proof(proof))
            self.assertFalse(self.log.verify_dossier_proof({**proof, "rootSha256": "0" * 64}))
        self.assertFalse(second["signedByExternalTrustAnchor"])
        self.assertFalse(second["regulatoryApproval"])

    def test_reject_tampered_file_before_append(self):
        manifest = self.manifest("source.json")
        (self.root / "source.json").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "MERKLE_NOT_VERIFIED"):
            self.log.append(dossier_id="source", role="government",
                            evidence_root=self.root, manifest=manifest)

    def test_duplicate_dossier_denied(self):
        self.log.append(dossier_id="one", role="survey", evidence_root=self.root,
                        manifest=self.manifest("source.json"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.log.append(dossier_id="one", role="survey", evidence_root=self.root,
                            manifest=self.manifest("source.json"))

    def test_trigger_denies_update_and_delete(self):
        self.log.append(dossier_id="one", role="survey", evidence_root=self.root,
                        manifest=self.manifest("source.json"))
        with sqlite3.connect(self.db_path) as conn:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "MERKLE_LOG_APPEND_ONLY"):
                conn.execute("UPDATE evidence_merkle_log SET log_root_sha256 = ? WHERE leaf_index=0",
                             ("0" * 64,))
            with self.assertRaisesRegex(sqlite3.IntegrityError, "MERKLE_LOG_APPEND_ONLY"):
                conn.execute("DELETE FROM evidence_merkle_log WHERE leaf_index=0")
        self.assertTrue(self.log.verify_integrity())

    def test_admin_level_db_mutation_detectable_but_not_preventable(self):
        self.log.append(dossier_id="one", role="survey", evidence_root=self.root,
                        manifest=self.manifest("source.json"))
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DROP TRIGGER evidence_merkle_no_update")
            conn.execute("UPDATE evidence_merkle_log SET log_root_sha256 = ? WHERE leaf_index=0",
                         ("0" * 64,))
        self.assertFalse(self.log.verify_integrity())
        with self.assertRaisesRegex(ValueError, "INTEGRITY_INVALID"):
            self.log.append(dossier_id="two", role="hydrology", evidence_root=self.root,
                            manifest=self.manifest("model.txt"))

    def test_wrong_role_and_missing_artifact_rejected(self):
        with self.assertRaisesRegex(ValueError, "ROLE_INVALID"):
            self.log.append(dossier_id="bad", role="AGENCY_APPROVED",
                            evidence_root=self.root, manifest=self.manifest("source.json"))
        with self.assertRaisesRegex(ValueError, "MERKLE_NOT_VERIFIED"):
            self.log.append(dossier_id="bad", role="survey",
                            evidence_root=self.root,
                            manifest={"merkleRootSha256": "0" * 64})


if __name__ == "__main__":
    unittest.main()
