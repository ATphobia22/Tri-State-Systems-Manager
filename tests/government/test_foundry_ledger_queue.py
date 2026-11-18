#!/usr/bin/env python3
"""Foundry drift reports must become review-only, hash-linked ledger sidecars."""
import json
import tempfile
import unittest
from pathlib import Path
from scripts.government import foundry_ledger_queue as adapter

class FoundryLedgerQueueTests(unittest.TestCase):
    def setUp(self):
        self.report = {
            "schema": "tsm.government.contract-foundry.v1",
            "classification": "INFORMATIONAL_ONLY",
            "catalogSha256": "a" * 64,
            "catalogSourceCount": 2,
            "contractChecksMissingCount": 2,
            "sources": [
                {"sourceId": "indiana-dem", "status": "REVIEW_REQUIRED",
                 "requiredReviews": [{"field":"vertical_datum","state":"NOT_EVIDENCED",
                                      "requiredReview":"VERTICAL_DATUM_VALIDATION"}]},
                {"sourceId": "usgs-gage", "status":"REVIEW_REQUIRED",
                 "requiredReviews": [{"field":"retrieved_at","state":"NOT_EVIDENCED",
                                      "requiredReview":"RETRIEVAL_DATE_REVIEW"}]},
            ],
            "drift":{
                "schema":"tsm.government.source-contract-impact.v1",
                "changes":[{"source_id":"indiana-dem","kind":"FIELD_CHANGED",
                            "field":"horizontal_crs","before":"EPSG:2966",
                            "after":"EPSG:26916","severity":"REVIEW_REQUIRED",
                            "affected":["parcel_to_terrain_join"]}]
            },
            "planeImpact": {
                "schema":"tsm.government.plane-change-crosswalk.v1",
                "impacted_planes":[{"plane_id":"terrain","changed_source_ids":["indiana-dem"],
                                   "relationship_evidence":"DECLARED_ONLY"}]
            }
        }
    def test_review_items_preserve_missing_metadata_and_drift(self):
        out = adapter.make_queue(self.report, "b" * 64)
        self.assertEqual(out["schema"],"tsm.government.foundry-ledger-queue.v1")
        self.assertEqual(out["sourceReportSha256"],"b" * 64)
        self.assertEqual(out["catalogSha256"],"a" * 64)
        self.assertFalse(out["ledgerMutationPerformed"])
        self.assertEqual(out["ledgerSubmissionState"],"NOT_SUBMITTED")
        self.assertEqual(out["regulatoryDetermination"],False)
        self.assertEqual(len(out["entries"]),3)
        self.assertEqual([x["reviewStatus"] for x in out["entries"]],["PENDING_HUMAN_REVIEW"]*3)
        self.assertEqual(len({x["entryId"] for x in out["entries"]}),3)
        drift = next(x for x in out["entries"] if x["kind"]=="SOURCE_DRIFT")
        self.assertEqual(drift["affectedPlanes"],["terrain"])
        self.assertEqual(drift["relationshipEvidence"],"DECLARED_ONLY")
    def test_deterministic_queue_and_no_fake_approvals(self):
        a = adapter.make_queue(self.report, "b" * 64)
        b = adapter.make_queue(self.report, "b" * 64)
        self.assertEqual(a,b)
        self.assertNotIn("approved",json.dumps(a).lower())
    def test_rejects_invalid_or_duplicate_source_ids(self):
        bad = json.loads(json.dumps(self.report))
        bad["sources"].append(bad["sources"][0])
        with self.assertRaisesRegex(ValueError,"[Dd]uplicate"):
            adapter.make_queue(bad,"b"*64)
    def test_script_refuses_to_overwrite_source_or_prior_receipt(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            source=root/"foundry.json"
            source.write_text(json.dumps(self.report))
            target=root/"queue.json"
            self.assertEqual(adapter.main(["--foundry",str(source),"--output",str(target)]),0)
            self.assertEqual(adapter.main(["--foundry",str(source),"--output",str(target)]),2)
            self.assertEqual(adapter.main(["--foundry",str(source),"--output",str(source)]),2)

if __name__ == "__main__":
    unittest.main()
