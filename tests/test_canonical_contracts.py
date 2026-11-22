"""Contract shape and reference examples; requires jsonschema[format]."""
import json
import unittest
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
FILES = {
    "event": ROOT / "schemas/core/twin-event.schema.json",
    "observation": ROOT / "schemas/core/observation.schema.json",
    "evidence": ROOT / "schemas/core/evidence.schema.json",
    "asset": ROOT / "schemas/assets/asset-shell.schema.json",
}
EVIDENCE = {
    "evidenceId": "evidence-usgs-1", "authority": "USGS",
    "sourceUri": "https://api.waterdata.usgs.gov/ogcapi/v1",
    "sha256": "a" * 64, "retrievedAt": "2026-11-22T12:00:00Z",
    "reviewStatus": "UNREVIEWED",
}
OBS = {
    "observationId": "obs-1", "authority": "USGS",
    "observedAt": "2026-11-22T12:00:00Z", "parameter": "00065",
    "value": 12.4, "units": "ft", "quality": "PROVISIONAL",
    "verticalDatum": "GAGE_DATUM",
    "sourceUri": "https://api.waterdata.usgs.gov/ogcapi/v1",
    "evidenceId": "evidence-usgs-1",
}
EVENT = {
    "eventId": "e6cce52b-47c7-465a-a716-ef44c6789a27",
    "eventType": "ObservationReceived", "aggregateType": "GAUGE",
    "aggregateId": "USGS-03378500", "version": 1,
    "occurredAt": "2026-11-22T12:00:00Z", "schemaVersion": "1.0.0",
    "evidenceIds": ["evidence-usgs-1"], "payload": OBS,
}
ASSET = {"assetId": "USGS-03378500", "assetType": "GAUGE", "evidence": ["evidence-usgs-1"]}


class CanonicalContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schemas = {k: json.loads(v.read_text(encoding="utf-8")) for k, v in FILES.items()}
        for schema in cls.schemas.values():
            Draft202012Validator.check_schema(schema)

    def check(self, name, obj):
        Draft202012Validator(self.schemas[name], format_checker=FormatChecker()).validate(obj)

    def test_valid_fixtures(self):
        for name, value in (("event", EVENT), ("observation", OBS), ("evidence", EVIDENCE), ("asset", ASSET)):
            with self.subTest(name=name):
                self.check(name, value)

    def test_event_rejects_invalid_version_uuid_and_extra_fields(self):
        for patch in ({"version": 0}, {"eventId": "invalid"}, {"schemaVersion": "2.0.0"}, {"extra": True}):
            with self.subTest(patch=patch), self.assertRaises(Exception):
                self.check("event", {**EVENT, **patch})

    def test_evidence_requires_exact_sha256(self):
        for value in ("0" * 63, "Z" * 64, ""):
            with self.subTest(value=value), self.assertRaises(Exception):
                self.check("evidence", {**EVIDENCE, "sha256": value})

    def test_observation_rejects_missing_units_and_quality(self):
        for field in ("units", "quality", "evidenceId"):
            item = dict(OBS)
            del item[field]
            with self.subTest(field=field), self.assertRaises(Exception):
                self.check("observation", item)

    def test_asset_rejects_unsupported_type(self):
        with self.assertRaises(Exception):
            self.check("asset", {**ASSET, "assetType": "UNSUPPORTED"})


if __name__ == "__main__":
    unittest.main()
