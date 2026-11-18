"""Cross-state OpenFEMA declarations must remain administrative and provenance-bound."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.government import openfema_tristate_declarations as mod


class TristateFemaSnapshotTests(unittest.TestCase):
    def sample_query(self, dataset, **kwargs):
        self.assertEqual(dataset, "DisasterDeclarationsSummaries")
        self.assertNotIn("NfipClaims", dataset)
        filters = kwargs["odata_filter"]
        state = filters.split("state eq '")[1].split("'")[0]
        county = filters.split("fipsCountyCode eq '")[1].split("'")[0]
        return {
            "status": "OBSERVED", "complete": True,
            "retrieved_at": "2026-11-18T07:00:00+00:00",
            "dataset": dataset, "apiVersion": 2, "deprecatedDataset": False,
            "page_receipts": [{"url": "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries",
                              "sha256": "a" * 64, "record_count": 1, "page_index": 0}],
            "records": [{
                "id": state + county, "disasterNumber": 1234,
                "state": state, "fipsCountyCode": county,
                "incidentType": "Flood", "declarationDate": "2011-06-01T00:00:00.000Z",
                "designatedArea": "County", "incidentBeginDate": "2011-05-01T00:00:00.000Z",
            }],
        }

    def test_all_six_counties_match_the_fips_and_state(self):
        docs = mod.make_all_snapshots(self.sample_query)
        self.assertEqual(set(docs), {"18129", "21101", "21225", "17059", "17185", "17193"})
        self.assertTrue(all(x["complete"] and x["spatialAuthority"] == "NONE_ADMINISTRATIVE"
                            for x in docs.values()))
        for county, document in docs.items():
            self.assertEqual(document["countyFips"], county)
            self.assertEqual(len(document["observations"]), 1)
            self.assertTrue(document["pageReceipts"])
            self.assertFalse(document["buildingFootprintsAvailable"])
            self.assertFalse(document["regulatoryBfeAvailable"])
            self.assertFalse(document["eventMapUseVerified"])

    def test_partial_pagination_fails_without_publishing(self):
        def partial(dataset, **kwargs):
            return {"status": "PARTIAL", "complete": False, "records": []}
        with self.assertRaisesRegex(ValueError, "incomplete"):
            mod.make_all_snapshots(partial)

    def test_wrong_county_rejected(self):
        def wrong(dataset, **kwargs):
            response = self.sample_query(dataset, **kwargs)
            response["records"][0]["fipsCountyCode"] = "999"
            return response
        with self.assertRaisesRegex(ValueError, "unexpected county"):
            mod.make_all_snapshots(wrong)

    def test_unexpected_sensitive_field_rejected(self):
        def sensitive(dataset, **kwargs):
            response = self.sample_query(dataset, **kwargs)
            response["records"][0]["policyNumber"] = "secret"
            return response
        with self.assertRaisesRegex(ValueError, "unexpected field"):
            mod.make_all_snapshots(sensitive)

    def test_six_files_and_checksums_without_overwrite(self):
        docs = mod.make_all_snapshots(self.sample_query)
        with tempfile.TemporaryDirectory() as td:
            output = Path(td) / "new"
            files = mod.save_snapshots(docs, output)
            self.assertEqual(len(files), 6)
            for path in files:
                d = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(d["sourceAuthority"], "FEMA OpenFEMA")
                self.assertEqual(
                    hashlib.sha256(path.read_bytes()).hexdigest(),
                    Path(str(path) + ".sha256").read_text().split()[0]
                )
            with self.assertRaises(FileExistsError):
                mod.save_snapshots(docs, output)

    def test_declared_area_never_becomes_flooded_parcel(self):
        docs = mod.make_all_snapshots(self.sample_query)
        self.assertTrue(all(not d["parcelFloodingConfirmed"]
                            for d in docs.values()))


if __name__ == "__main__":
    unittest.main()
