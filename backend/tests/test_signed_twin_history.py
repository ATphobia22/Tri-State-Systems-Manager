"""Signed, authorized twin-history unit fixtures. No live device data."""
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import json
import sqlite3
import unittest

from backend.app.asset_registry import build_registry_snapshot
from backend.app.signed_twin_history import (
    append_signed_event, read_history, verify_history_chain, IngestError,
)

NOW = datetime(2026, 11, 13, 23, 0, tzinfo=timezone.utc)
STATION = "USGS-03378500"
DEVICE_ID = "trusted-test-probe-A"
KEY = b"x" * 32


def fixture(**kwargs):
    data = {
        "schemaVersion": "tsm.signed-sensor-event.v1",
        "eventId": "test-event-000001",
        "deviceId": DEVICE_ID,
        "assetId": STATION,
        "parameterCode": "00065",
        "unit": "ft",
        "value": "1.94",
        "datum": "USGS_STATION_GAGE_DATUM_UNCONVERTED",
        "observedAt": "2026-11-13T22:45:00Z",
        "sentAt": "2026-11-13T23:00:00Z",
    }
    data.update(kwargs)
    raw = json.dumps(data, separators=(",", ":")).encode()
    sig = "sha256=" + hmac.new(KEY, raw, hashlib.sha256).hexdigest()
    return raw, sig


class SignedTwinIngestTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.registry = build_registry_snapshot()
        self.keyring = {DEVICE_ID: KEY}
        self.enrollment = {DEVICE_ID: STATION}

    def ingest(self, raw=None, sig=None, **kwargs):
        if raw is None:
            raw, sig = fixture(**kwargs)
        return append_signed_event(self.db, raw, sig, self.keyring, self.enrollment, self.registry, NOW)

    def test_authentic_event_is_durable_and_stays_unconverted(self):
        receipt = self.ingest()
        self.assertEqual(receipt["assetId"], STATION)
        self.assertEqual(receipt["observationState"], "SIGNED_DEVICE_CANDIDATE_NOT_USGS")
        rows = read_history(self.db, STATION)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["value"], 1.94)
        self.assertIsNone(rows[0]["navd88WaterSurfaceElevation"])
        self.assertEqual(rows[0]["sourceClass"], "DEVICE_SIGNED_NOT_OFFICIAL_USGS")
        self.assertTrue(verify_history_chain(self.db))

    def test_replay_is_rejected_without_new_rows(self):
        raw, sig = fixture()
        self.ingest(raw, sig)
        with self.assertRaisesRegex(IngestError, "REPLAYED_EVENT_ID"):
            self.ingest(raw, sig)
        self.assertEqual(len(read_history(self.db, STATION)), 1)

    def test_invalid_auth_and_body_tampering(self):
        raw, sig = fixture()
        with self.assertRaisesRegex(IngestError, "BAD_AUTHENTICATION"):
            self.ingest(raw, sig[:-2] + "00")
        changed = raw.replace(b"1.94", b"99.9")
        with self.assertRaisesRegex(IngestError, "BAD_AUTHENTICATION"):
            self.ingest(changed, sig)

    def test_enrollment_and_replay_window_cannot_be_bypassed(self):
        raw, sig = fixture(assetId="USGS-00000000")
        with self.assertRaisesRegex(IngestError, "DEVICE_ASSET_ENROLLMENT_MISMATCH"):
            self.ingest(raw, sig)
        raw, sig = fixture(sentAt="2026-11-13T22:30:00Z")
        with self.assertRaisesRegex(IngestError, "EXPIRED_OR_FUTURE_SIGNED_EVENT"):
            self.ingest(raw, sig)

    def test_no_fabricated_navd88_or_changed_units(self):
        raw, sig = fixture(unit="m")
        with self.assertRaisesRegex(IngestError, "PARAMETER_OR_UNIT_MISMATCH"):
            self.ingest(raw, sig)
        raw, sig = fixture(datum="NAVD88")
        with self.assertRaisesRegex(IngestError, "DATUM_NOT_RESOLVED"):
            self.ingest(raw, sig)
        raw, sig = fixture(value="NaN")
        with self.assertRaisesRegex(IngestError, "INVALID_VALUE"):
            self.ingest(raw, sig)

    def test_chain_tampering_detected(self):
        self.ingest()
        self.db.execute("UPDATE signed_twin_events SET event_json='{}' WHERE seq=1")
        self.db.commit()
        self.assertFalse(verify_history_chain(self.db))


if __name__ == "__main__":
    unittest.main()
