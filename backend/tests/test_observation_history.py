"""Synthetic-contract tests for offline USGS OGC observation history.

No network calls or synthetic readings are shipped as production inputs.
"""
from datetime import timedelta, datetime, timezone
import hashlib
import json
import unittest

from backend.app.asset_registry import build_registry_snapshot
from backend.app.observation_history import import_snapshot, ObservationError

URL = ("https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items"
       "?monitoring_location_id=USGS-03378500&parameter_code=00065&limit=3&f=json")
CAPTURE = "2026-11-13T23:00:00Z"


def payload(timestamp="2026-11-13T22:45:00Z", value="1.94", unit="ft"):
    return {"type": "FeatureCollection", "features": [{
        "type": "Feature",
        "properties": {
            "monitoring_location_id": "USGS-03378500",
            "parameter_code": "00065",
            "timeseries_id": "test-source-series",
            "value": value,
            "unit_of_measure": unit,
            "time": timestamp,
            "approval_status": "Provisional",
        },
    }]}


def convert(data, **kwargs):
    return import_snapshot(json.dumps(data).encode(), build_registry_snapshot(), URL, CAPTURE, **kwargs)


class USGSHistoryTests(unittest.TestCase):
    def test_real_station_bound_and_no_datum_fabrication(self):
        record = convert(payload())
        self.assertEqual(record["stationId"], "USGS-03378500")
        self.assertEqual(record["observationState"], "SOURCE_REPORTED")
        self.assertEqual(record["observations"][0]["value"], 1.94)
        self.assertEqual(record["observations"][0]["unit"], "ft")
        self.assertEqual(record["observations"][0]["datum"], "USGS_STATION_GAGE_DATUM_UNCONVERTED")
        self.assertIsNone(record["navd88WaterSurfaceElevation"])
        self.assertIsNone(record["hydraulicForecast"])
        self.assertEqual(record["stationHealth"], "NOT_EVALUATED")
        self.assertEqual(record["observations"][0]["prevEventSha256"], "0" * 64)
        self.assertEqual(record["observations"][0]["eventSha256"], record["lastEventSha256"])

    def test_stale_and_no_source_are_explicit(self):
        self.assertEqual(convert(payload("2026-11-13T20:00:00Z"))["observationState"], "STALE")
        self.assertEqual(convert({"type":"FeatureCollection","features":[]})["observationState"], "SOURCE_UNAVAILABLE")

    def test_rejects_invalid_sources_and_units(self):
        with self.assertRaisesRegex(ObservationError, "UNVERIFIED_STAGE_UNITS"):
            convert(payload(unit="m"))
        for bad in ("nan", "Infinity", ""):
            with self.assertRaises(ObservationError):
                convert(payload(value=bad))
        with self.assertRaisesRegex(ObservationError, "OBSERVATION_IN_FUTURE"):
            convert(payload("2026-11-14T00:00:00Z"))
        with self.assertRaisesRegex(ObservationError, "OFFSET_AWARE_TIMESTAMP_REQUIRED"):
            convert(payload("2026-11-13T22:45:00"))

    def test_rejects_station_injection_and_wrong_host(self):
        data = payload()
        data["features"][0]["properties"]["monitoring_location_id"] = "USGS-00000000"
        with self.assertRaisesRegex(ObservationError, "MISMATCHED_STATION"):
            convert(data)
        with self.assertRaisesRegex(ObservationError, "UNTRUSTED_USGS_SOURCE_URL"):
            import_snapshot(json.dumps(payload()).encode(), build_registry_snapshot(),
                            URL.replace("api.waterdata.usgs.gov", "untrusted.example"), CAPTURE)

    def test_official_v1_timeseries_identifier_and_legacy_alias(self):
        data = payload()
        data["features"][0]["properties"]["time_series_id"] = data["features"][0]["properties"].pop("timeseries_id")
        self.assertEqual(convert(data)["observations"][0]["timeseriesId"], "test-source-series")
        data["features"][0]["properties"]["timeseries_id"] = "different-source-series"
        with self.assertRaisesRegex(ObservationError, "CONFLICTING_TIMESERIES_IDENTIFIERS"):
            convert(data)

    def test_duplicate_events_are_not_silently_de_duplicated(self):
        duplicate = payload()
        duplicate["features"].append(dict(duplicate["features"][0]))
        with self.assertRaisesRegex(ObservationError, "DUPLICATE_SOURCE_OBSERVATION"):
            convert(duplicate)


if __name__ == "__main__":
    unittest.main()
