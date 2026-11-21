import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit

from scripts.hydrology.river_twin_snapshot import capture, compare, iso, STATIONS


NOW = datetime(2026, 11, 21, 18, tzinfo=timezone.utc)
TIMES = [NOW - timedelta(minutes=15 * n) for n in (3, 2, 1)]


def fixture_fetch(url):
    station = parse_qs(urlsplit(url).query)["monitoring_location_id"][0]
    if station == "USGS-03378500":
        raise URLError("fixture outage")
    rows = [
        {"id": str(i), "properties": {
            "monitoring_location_id": station, "parameter_code": "00065",
            "time_series_id": "test-series", "unit_of_measure": "ft",
            "time": iso(time), "value": str(i), "qualifier": None,
            "approval_status": "Approved" if i < 2 else "Provisional",
        }}
        for i, time in enumerate(TIMES)
    ]
    rows.append({"id": "wrong-series", "properties": {
        **rows[0]["properties"], "time_series_id": "other-series",
    }})
    return json.dumps({"type": "FeatureCollection", "features": rows}).encode()


class RiverTwinSnapshotTest(unittest.TestCase):
    def test_capture_and_offline_replay_preserve_independent_station_states(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            snapshot = root / "snapshot"
            manifest = capture(snapshot, retrieve=fixture_fetch, now=NOW)
            self.assertEqual(manifest["stations"][STATIONS[0]]["status"], "CAPTURED")
            self.assertEqual(manifest["stations"][STATIONS[1]]["status"], "SOURCE_UNAVAILABLE")
            with self.assertRaisesRegex(ValueError, "destination must be new"):
                capture(snapshot, retrieve=fixture_fetch, now=NOW)
            csv = root / "model.csv"
            csv.write_text("time,stage\n" + "".join(
                f"{iso(time)},{height}\n" for time, height in zip(TIMES, (101, 99, 900))
            ), encoding="utf-8")
            datum = root / "datum.txt"
            datum.write_text("Synthetic test datum evidence", encoding="utf-8")
            review = root / "review.json"
            review.write_text(json.dumps({
                "schema": "tsm.river-twin.model-review.v1", "engine": "HEC-RAS",
                "runId": "fixture-run", "modelRevision": "fixture-revision",
                "reviewReference": "synthetic-fixture",
                "bindings": [{
                    "stationId": station, "timeSeriesId": "test-series",
                    "modelLocation": "synthetic-section", "datumReference": "synthetic datum",
                    "gageZeroFtNavd88": 100, "modelDatum": "NAVD88", "modelUnits": "ft",
                    "observationUse": "WITHHELD_DECLARED",
                    "validFrom": iso(TIMES[0]), "validUntil": iso(NOW),
                    "datumEvidence": datum.name, "datumSha256": hashlib.sha256(datum.read_bytes()).hexdigest(),
                    "modelCsv": csv.name, "modelSha256": hashlib.sha256(csv.read_bytes()).hexdigest(),
                } for station in STATIONS],
            }), encoding="utf-8")
            result = compare(snapshot, review)
            station = result["stations"][STATIONS[0]]
            self.assertEqual(station["sourceObservationCount"], 3)
            self.assertEqual(station["count"], 2)
            self.assertEqual(station["biasFt"], -0.5)
            self.assertEqual(station["maeFt"], 1.5)
            self.assertEqual([pair["residualFt"] for pair in station["pairs"]], [1, -2])
            self.assertEqual(result["stations"][STATIONS[1]]["status"], "SOURCE_UNAVAILABLE")
            self.assertEqual(result["stations"][STATIONS[1]]["count"], 0)
            (snapshot / f"{STATIONS[0]}.geojson").write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "failed integrity check"):
                compare(snapshot, review)

    def test_paginated_capture_is_never_reported_as_complete(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest = capture(Path(temp) / "snapshot", now=NOW, retrieve=lambda _: b"""
                {"type":"FeatureCollection","features":[],"links":[{"rel":"next"}]}
            """)
            self.assertTrue(all(entry["status"] == "SOURCE_UNAVAILABLE"
                                for entry in manifest["stations"].values()))


if __name__ == "__main__":
    unittest.main()
