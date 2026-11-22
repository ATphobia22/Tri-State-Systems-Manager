"""Headless USGS gauge projection: read-only and datum-safe."""
from copy import deepcopy

import pytest

from twin.offline_view import PILOT_STATIONS, summarize_observations, verified_view


CAPTURE_TIME = "2025-01-01T13:01:00Z"


def receipt():
    return {
        "schema": "tsm.offline-observation-bundle.v1",
        "capturedAt": CAPTURE_TIME,
        "sourceStates": {
            "USGS-03378500": {"status": "CAPTURED", "sourceSha256": "a" * 64},
            "USGS-03322000": {"status": "SOURCE_UNAVAILABLE", "sourceSha256": None},
        },
        "eventCount": 1,
        "navd88WseIncluded": False,
        "publicPublication": "REVIEW_REQUIRED",
    }


def observed(*, series="series-a", time="2025-01-01T12:00:00Z", value=8.5):
    return {"event_id": f"event-{series}-{time}", "matrix": "O",
            "timeline": "observed", "valid_from": time,
            "state": {"sensor_id": "USGS-03378500", "time_series_id": series,
                      "parameter": "00065", "unit": "ft", "value": value,
                      "vertical_reference": "STATION_GAGE_DATUM_UNRESOLVED",
                      "quality": "Provisional"},
            "source": {"authority": "USGS", "sha256": "a" * 64},
            "geometry": {"type": "Point", "coordinates": [-87.9, 38.1]}}


def test_unavailable_and_omitted_stations_are_not_fabricated():
    r = receipt()
    r["eventCount"] = 0
    view = summarize_observations(r, [], as_of="2025-01-01T13:05:00Z")
    assert set(view["stations"]) == set(PILOT_STATIONS)
    assert view["stations"]["USGS-03322000"]["sourceStatus"] == "SOURCE_UNAVAILABLE"
    assert view["stations"]["USGS-03377500"]["sourceStatus"] == "NOT_IN_CAPTURE"
    assert view["stations"]["USGS-03378500"]["series"] == []
    assert view["navd88WseIncluded"] is False
    assert view["engineeringUse"] == "NOT_VALIDATED"


def test_latest_per_series_not_combined_across_series():
    records = [observed(time="2025-01-01T11:00:00Z", value=7.0),
               observed(time="2025-01-01T12:00:00Z", value=8.5),
               observed(series="series-b", time="2025-01-01T12:30:00Z", value=9.3)]
    r = receipt()
    r["eventCount"] = len(records)
    view = summarize_observations(r, records, as_of="2025-01-01T13:01:00Z",
                                  stale_after_seconds=3600)
    series = view["stations"]["USGS-03378500"]["series"]
    assert [row["timeSeriesId"] for row in series] == ["series-a", "series-b"]
    assert [row["gageHeightFt"] for row in series] == [8.5, 9.3]
    assert [row["readingStatus"] for row in series] == ["STALE", "RECENT_OBSERVATION"]


def test_no_data_sentinel_cannot_be_replaced_with_older_good_reading():
    records = [observed(time="2025-01-01T11:00:00Z", value=8.0),
               observed(time="2025-01-01T12:30:00Z", value=None)]
    r = receipt()
    r["eventCount"] = len(records)
    series = summarize_observations(r, records, as_of=CAPTURE_TIME)["stations"]["USGS-03378500"]["series"]
    assert series[0]["gageHeightFt"] is None
    assert series[0]["readingStatus"] == "MISSING_MEASUREMENT"


@pytest.mark.parametrize("change", [
    ("state", "unit", "m"),
    ("state", "vertical_reference", "NAVD88"),
    ("state", "sensor_id", "USGS-03322000"),
    ("source", "sha256", "b" * 64),
])
def test_cross_station_or_datum_substitution_is_rejected(change):
    data = observed()
    data[change[0]][change[1]] = change[2]
    with pytest.raises(ValueError, match="station and datum"):
        summarize_observations(receipt(), [data], as_of=CAPTURE_TIME)


def test_future_timestamp_and_misleading_receipt_rejected():
    with pytest.raises(ValueError, match="capture"):
        summarize_observations(receipt(), [observed(time="2025-01-01T14:00:00Z")], as_of=CAPTURE_TIME)
    r = deepcopy(receipt())
    r["navd88WseIncluded"] = True
    with pytest.raises(ValueError, match="authority"):
        summarize_observations(r, [observed()], as_of=CAPTURE_TIME)
    with pytest.raises(ValueError, match="precede"):
        summarize_observations(receipt(), [observed()], as_of="2025-01-01T12:00:00Z")


def test_offline_integrity_and_projection_with_real_bundle(tmp_path):
    # The fixture runs the full production source capture preflight and replay.
    from test_offline_bundle import capture
    from twin.offline_bundle import build_bundle

    source, _, _ = capture(tmp_path)
    target = tmp_path / "bundle"
    build_bundle(source, target)
    view = verified_view(target, as_of="2025-01-01T13:01:00Z")
    series = view["stations"]["USGS-03378500"]["series"]
    assert view["runtime"] == "FILES_ONLY_NO_SERVER"
    assert view["observationCount"] == 1
    assert series[0]["gageHeightFt"] == 8.5
    assert series[0]["readingStatus"] == "STALE"
    (target / "events.ndjson").write_text("{}\n")
    with pytest.raises(ValueError, match="SHA-256"):
        verified_view(target, as_of=CAPTURE_TIME)
