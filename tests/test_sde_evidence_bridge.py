"""Integration tests: real Rust SDE CLI + existing TSM SQLite evidence ledger."""
import json
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

from backend.sde_evidence_adapter import SDEEvidenceAdapter


@unittest.skipUnless(os.environ.get("TSM_SDE_GRAPH_BIN"), "build SDE binary and set TSM_SDE_GRAPH_BIN")
class SDEBridgeIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.graph = self.root / "graph.json"
        self.prov = self.root / "provenance.json"
        self.graph.write_text(json.dumps({
            "schema": "tsm.reasoning-graph.v1",
            "nodes": [
                {"id": "b", "kind": "observation", "payload": {"value": 2}},
                {"id": "a", "kind": "source", "payload": {"source": "test"}},
            ],
            "edges": [{"from": "a", "to": "b", "relation": "supports"}],
        }), encoding="utf-8")
        self.prov.write_text(json.dumps({
            "source": "TEST_FIXTURE_ONLY", "review_state": "UNVERIFIED"
        }), encoding="utf-8")
        self.adapter = SDEEvidenceAdapter(
            os.environ["TSM_SDE_GRAPH_BIN"],
            self.root / "objects",
            self.root / "scientific-evidence.sqlite",
        )

    def test_complete_ingest_restore_and_append_only_ledger(self):
        record_file = self.root / "record.json"
        result = self.adapter.ingest(
            self.graph, self.prov, record_file, run_id="sde-ci-fixture-001"
        )
        self.assertEqual(result["storage_integrity"], "VERIFIED")
        self.assertEqual(result["scientific_review_state"], "NOT_EVALUATED")
        record = json.loads(record_file.read_text(encoding="utf-8"))
        self.assertEqual(record["review_state"], "UNVERIFIED")
        self.assertEqual(record["schema"], "tsm.sde.evidence-record.v2")
        self.assertEqual(len(record["provenance_manifest"]["chunks"]) > 0, True)
        self.assertTrue(self.adapter.ledger.verify_chain())
        with closing(sqlite3.connect(self.root / "scientific-evidence.sqlite")) as conn:
            row = conn.execute(
                "SELECT evidence_json FROM solver_evidence_ledger WHERE run_id=?",
                ("sde-ci-fixture-001",),
            ).fetchone()
        evidence = json.loads(row[0])
        self.assertEqual(evidence["state"], "NOT_EVALUATED")
        self.assertIn("NEURAL_INFERENCE_NOT_EVIDENCED", evidence["validation_messages"])

    def test_concurrent_ingests_do_not_fork_scientific_evidence_chain(self):
        def one(index):
            return self.adapter.ingest(
                self.graph,
                self.prov,
                self.root / f"concurrent-{index}.json",
                run_id=f"sde-concurrent-{index}",
            )
        with ThreadPoolExecutor(max_workers=4) as pool:
            outcomes = list(pool.map(one, range(6)))
        self.assertEqual(len(outcomes), 6)
        self.assertEqual(len({x["ledger_record_sha256"] for x in outcomes}), 6)
        self.assertTrue(self.adapter.ledger.verify_chain())
        with closing(sqlite3.connect(self.root / "scientific-evidence.sqlite")) as connection:
            count = connection.execute("SELECT COUNT(*) FROM solver_evidence_ledger").fetchone()[0]
        self.assertEqual(count, 6)

    def test_reconstruction_rejects_modified_provenance_chunk(self):
        record_file = self.root / "record2.json"
        self.adapter.ingest(self.graph, self.prov, record_file, run_id="sde-ci-fixture-002")
        record = json.loads(record_file.read_text(encoding="utf-8"))
        digest = record["provenance_manifest"]["chunks"][0]["sha256"]
        object_path = self.root / "objects" / "objects" / digest[:2] / digest
        object_path.write_bytes(b"tampered")
        done = subprocess.run(
            [os.environ["TSM_SDE_GRAPH_BIN"], "verify", str(self.root / "objects"), str(record_file)],
            capture_output=True,
            text=True,
            check=False,
            timeout=20,
        )
        self.assertNotEqual(done.returncode, 0)


if __name__ == "__main__":
    unittest.main()
