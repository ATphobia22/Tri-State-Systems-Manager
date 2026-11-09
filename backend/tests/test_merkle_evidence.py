"""Independent RFC9162 Merkle computations, inclusion proofs and tamper tests."""
from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from backend.merkle_evidence import (ALGORITHM, build_manifest, canonical, inclusion_path,
                                     prove_item, tree_hash, verify_inclusion,
                                     verify_item_proof, verify_manifest)


def sha(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


class MerkleEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name, payload in [("source.txt", "official-source-bytes"),
                              ("solver.txt", "model-output-bytes"),
                              ("decision.txt", "UNAPPROVED-DECISION-FIXTURE")]:
            (self.root / name).write_text(payload)
        self.artifacts = [("source", "source.txt"), ("solver", "solver.txt"),
                          ("decision", "decision.txt")]

    def test_rfc9162_tree_hash_vectors(self):
        values = [b"one", b"two", b"three", b"four", b"five"]
        self.assertEqual(tree_hash([]), sha(b""))
        self.assertEqual(tree_hash(values[:1]), sha(b"\x00" + b"one"))
        leaf_a = sha(b"\x00" + b"one")
        leaf_b = sha(b"\x00" + b"two")
        leaf_c = sha(b"\x00" + b"three")
        self.assertEqual(tree_hash(values[:2]), sha(b"\x01" + leaf_a + leaf_b))
        self.assertEqual(tree_hash(values[:3]),
                         sha(b"\x01" + sha(b"\x01" + leaf_a + leaf_b) + leaf_c))
        for total in range(1, 6):
            for index in range(total):
                proof = inclusion_path(values[:total], index)
                self.assertTrue(verify_inclusion(values[index], index, total, proof,
                                                 tree_hash(values[:total]).hex()))

    def test_manifest_deterministic_and_verify_files(self):
        first = build_manifest(self.root, self.artifacts)
        second = build_manifest(self.root, list(reversed(self.artifacts)))
        self.assertEqual(first, second)
        self.assertEqual(first["algorithm"], ALGORITHM)
        self.assertTrue(verify_manifest(self.root, first))
        self.assertFalse(first["regulatoryApproval"])

    def test_inclusion_proof_verifies_and_detects_forgery(self):
        manifest = build_manifest(self.root, self.artifacts)
        proof = prove_item(manifest, role="solver", path="solver.txt")
        self.assertTrue(verify_item_proof(proof))
        changed = copy.deepcopy(proof)
        changed["item"]["sha256"] = "0" * 64
        self.assertFalse(verify_item_proof(changed))
        changed = copy.deepcopy(proof)
        changed["leafIndex"] = 2
        self.assertFalse(verify_item_proof(changed))
        changed = copy.deepcopy(proof)
        changed["inclusionPath"].append({"side": "left", "sha256": "0" * 64})
        self.assertFalse(verify_item_proof(changed))

    def test_tampered_original_file_fails(self):
        manifest = build_manifest(self.root, self.artifacts)
        (self.root / "source.txt").write_text("touched")
        self.assertFalse(verify_manifest(self.root, manifest))

    def test_tampered_manifest_root_fails(self):
        manifest = build_manifest(self.root, self.artifacts)
        manifest["merkleRootSha256"] = "0" * 64
        self.assertFalse(verify_manifest(self.root, manifest))

    def test_duplicate_and_traversal_rejected(self):
        with self.assertRaisesRegex(ValueError, "DUPLICATE"):
            build_manifest(self.root, [self.artifacts[0], self.artifacts[0]])
        with self.assertRaisesRegex(ValueError, "UNSAFE"):
            build_manifest(self.root, [("source", "../not-in-root")])

    def test_symlink_and_symlinked_parent_rejected(self):
        (self.root / "link.txt").symlink_to(self.root / "source.txt")
        with self.assertRaisesRegex(ValueError, "SYMLINK"):
            build_manifest(self.root, [("source", "link.txt")])
        (self.root / "alias").symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "SYMLINK"):
            build_manifest(self.root, [("source", "alias/source.txt")])

    def test_changed_count_role_order_fails(self):
        manifest = build_manifest(self.root, self.artifacts)
        wrong = copy.deepcopy(manifest)
        wrong["leafCount"] = 2
        self.assertFalse(verify_manifest(self.root, wrong))
        wrong = copy.deepcopy(manifest)
        wrong["items"].reverse()
        self.assertFalse(verify_manifest(self.root, wrong))

    def test_odd_count_and_non_ascii_filename(self):
        (self.root / "élevation.txt").write_bytes(b"metres")
        manifest = build_manifest(self.root, [("control", "élevation.txt")])
        self.assertTrue(verify_manifest(self.root, manifest))
        self.assertTrue(verify_item_proof(prove_item(manifest, role="control", path="élevation.txt")))

    def test_never_self_approves(self):
        manifest = build_manifest(self.root, self.artifacts)
        manifest["regulatoryApproval"] = True
        self.assertFalse(verify_manifest(self.root, manifest))


if __name__ == "__main__":
    unittest.main()
