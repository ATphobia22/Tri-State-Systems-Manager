"""Offline synthetic tests for FEMA administrative snapshot export boundaries."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "openfema_snapshot", ROOT / "scripts/government/openfema_posey_snapshot.py"
)
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


def fake_result(records, status="OBSERVED", complete=True):
    return {
        "status": status, "complete": complete, "records": records,
        "retrieved_at": "2026-11-16T05:00:00+00:00",
        "page_receipts": [{"url": "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries",
                           "sha256": "a" * 64, "bytes": 400,
                           "record_count": len(records), "page_index": 0}],
        "deprecatedDataset": False,
    }


GOOD = {
    "id": "synthetic-record-only", "disasterNumber": 1234, "state": "IN",
    "fipsCountyCode": "129", "declarationDate": "2020-01-01T00:00:00Z",
    "incidentType": "Flood", "declarationTitle": "SYNTHETIC ONLY",
    "designatedArea": "Posey (County)",
}


class SnapshotTests(unittest.TestCase):
    def test_pins_strict_fema_dataset_filter_and_subset(self):
        captured = {}
        def query(dataset, **opts):
            captured["dataset"] = dataset
            captured.update(opts)
            return fake_result([GOOD])
        result = MOD.make_snapshot(query)
        self.assertEqual(captured["dataset"], "DisasterDeclarationsSummaries")
        self.assertEqual(captured["odata_filter"], "state eq 'IN' and fipsCountyCode eq '129'")
        self.assertIn("id,disasterNumber,state,fipsCountyCode", captured["select"])
        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["spatialAuthority"], "NONE_OPENFEMA_ADMINISTRATIVE_CONTEXT")
        self.assertFalse(result["regulatoryFloodGeometry"])

    def test_empty_source_requires_manual_review(self):
        with self.assertRaisesRegex(ValueError, "empty Posey"):
            MOD.make_snapshot(lambda *a, **k: fake_result([]))

    def test_partial_response_must_not_publish_as_complete(self):
        with self.assertRaisesRegex(ValueError, "Refusing partial"):
            MOD.make_snapshot(lambda *a, **k: fake_result([GOOD], status="PARTIAL", complete=False))
        with self.assertRaisesRegex(ValueError, "Refusing partial"):
            MOD.make_snapshot(lambda *a, **k: fake_result([GOOD], status="OBSERVED", complete=False))

    def test_bad_county_or_state_stops_snapshot(self):
        for change in ({"state": "IL"}, {"fipsCountyCode": "999"}, {"fipsCountyCode": None}):
            bad = {**GOOD, **change}
            with self.assertRaisesRegex(ValueError, "does not match Posey"):
                MOD.make_snapshot(lambda *a, **k: fake_result([bad]))

    def test_unknown_data_fields_rejected(self):
        with self.assertRaisesRegex(ValueError, "potentially sensitive"):
            MOD.make_snapshot(lambda *a, **k: fake_result([{**GOOD, "fullAddress": "Secret Street"}]))

    def test_missing_source_record_id_rejected(self):
        with self.assertRaisesRegex(ValueError, "source record ID"):
            MOD.make_snapshot(lambda *a, **k: fake_result([{**GOOD, "id": ""}]))

    def test_noninteger_disaster_number_rejected(self):
        with self.assertRaisesRegex(ValueError, "disaster number"):
            MOD.make_snapshot(lambda *a, **k: fake_result([{**GOOD, "disasterNumber": "unknown"}]))

    def test_receipt_sidecar_contains_exact_output_digest_and_no_overwrite(self):
        doc = MOD.make_snapshot(lambda *a, **k: fake_result([GOOD]))
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "posey-declarations.json"
            sha, sidecar = MOD.save_snapshot(doc, target)
            self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), sha)
            self.assertEqual(sidecar.read_text(), sha + "  " + target.name + "\n")
            self.assertEqual(json.loads(target.read_text())["observations"][0]["id"],
                             "synthetic-record-only")
            with self.assertRaisesRegex(ValueError, "already exists"):
                MOD.save_snapshot(doc, target)

    def test_unavailable_input_is_not_stored(self):
        with self.assertRaisesRegex(ValueError, "Refusing partial"):
            MOD.make_snapshot(lambda *a, **k: {"status": "UNAVAILABLE", "complete": False})


if __name__ == "__main__":
    unittest.main()
