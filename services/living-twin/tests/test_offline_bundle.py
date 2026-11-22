"""Observation input preflight and native local file replay acceptance."""
import json
import hashlib
from copy import deepcopy
from urllib.parse import urlencode

import pytest

from twin.contracts import encode
from twin.import_usgs import event_rows
from twin.offline_bundle import build_bundle, verify_bundle


def capture(tmp_path, *, no_data=False):
    folder = tmp_path / "snapshot"
    folder.mkdir()
    station = "03378500"
    start = "2025-01-01T11:00:00Z"
    end = "2025-01-01T13:00:00Z"
    feature = {
        "type": "Feature", "id": "source-point", "geometry": {
            "type": "Point", "coordinates": [-87.9, 38.1]},
        "properties": {"monitoring_location_id": "USGS-" + station,
                       "parameter_code": "00065", "unit_of_measure": "ft",
                       "time_series_id": "gage-series", "time": "2025-01-01T12:00:00Z",
                       "value": "-999" if no_data else "8.5",
                       "approval_status": "Provisional"},
    }
    document = {"type": "FeatureCollection", "features": [feature]}
    raw = json.dumps(document).encode()
    query = urlencode({"f": "json", "monitoring_location_id": "USGS-" + station,
                       "parameter_code": "00065", "time": start + "/" + end,
                       "limit": 1000})
    manifest = {"schema": "tsm.river-twin.observations.v1",
                "window": [start, end], "finishedAt": "2025-01-01T13:01:00Z",
                "stations": {
                    station: {"status": "CAPTURED", "featureCount": 1,
                              "sourceUrl": "https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items?" + query,
                              "rawSha256": hashlib.sha256(raw).hexdigest()},
                    "03322000": {"status": "SOURCE_UNAVAILABLE"},
                }}
    (folder / station).with_suffix(".geojson").write_bytes(raw)
    (folder / "manifest.json").write_text(json.dumps(manifest))
    return folder, feature, manifest


def replace_features(folder, features, *, links=None):
    document = {"type": "FeatureCollection", "features": features}
    if links is not None:
        document["links"] = links
    raw = json.dumps(document).encode()
    (folder / "03378500.geojson").write_bytes(raw)
    manifest = json.loads((folder / "manifest.json").read_text())
    manifest["stations"]["03378500"]["rawSha256"] = hashlib.sha256(raw).hexdigest()
    manifest["stations"]["03378500"]["featureCount"] = len(features)
    (folder / "manifest.json").write_text(json.dumps(manifest))


def test_source_snapshot_to_replayable_local_bundle(tmp_path):
    folder, _, _ = capture(tmp_path)
    events = event_rows(folder)
    assert len(events) == 1
    assert encode(events[0])["matrix"] == "O"
    assert events[0]["state"]["value"] == 8.5
    assert events[0]["state"]["vertical_reference"] == "STATION_GAGE_DATUM_UNRESOLVED"
    assert event_rows(folder) == events
    target = tmp_path / "native-files"
    receipt = build_bundle(folder, target)
    assert receipt["eventCount"] == 1
    assert receipt["navd88WseIncluded"] is False
    assert receipt["hydraulicSimulationIncluded"] is False
    assert verify_bundle(target) == receipt
    assert json.loads((target / "events.ndjson").read_text()) == events[0]
    assert (target / "source/03378500.geojson").is_file()
    second = tmp_path / "native-files-again"
    assert build_bundle(folder, second) == receipt
    assert (second / "events.ndjson").read_bytes() == (target / "events.ndjson").read_bytes()


def test_usgs_missing_stage_never_becomes_fake_zero(tmp_path):
    folder, _, _ = capture(tmp_path, no_data=True)
    assert event_rows(folder)[0]["state"]["value"] is None
    assert build_bundle(folder, tmp_path / "native-files")["eventCount"] == 1


@pytest.mark.parametrize("field,value,match", [
    ("monitoring_location_id", "USGS-03322000", "station"),
    ("parameter_code", "00060", "parameter"),
    ("unit_of_measure", "m", "unit"),
    ("time", "2025-01-02T12:00:00Z", "outside capture window"),
    ("value", "bad", "Non-numeric"),
    ("time_series_id", "", "series"),
])
def test_even_rehashed_bad_station_observation_rejected(tmp_path, field, value, match):
    folder, feature, _ = capture(tmp_path)
    feature["properties"][field] = value
    replace_features(folder, [feature])
    with pytest.raises(ValueError, match=match):
        event_rows(folder)


def test_usgs_snapshot_rejects_duplicate_and_pagination(tmp_path):
    folder, feature, _ = capture(tmp_path)
    replace_features(folder, [feature, deepcopy(feature)])
    with pytest.raises(ValueError, match="Duplicate"):
        event_rows(folder)
    replace_features(folder, [feature], links=[{"rel": "next", "href": "https://example.invalid"}])
    with pytest.raises(ValueError, match="paginated"):
        event_rows(folder)


def test_capture_query_and_sha_both_must_match(tmp_path):
    folder, _, manifest = capture(tmp_path)
    manifest["stations"]["03378500"]["sourceUrl"] += "&unexpected=data"
    (folder / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="query"):
        event_rows(folder)
    manifest["stations"]["03378500"]["sourceUrl"] = manifest["stations"]["03378500"]["sourceUrl"].split("&unexpected")[0]
    (folder / "manifest.json").write_text(json.dumps(manifest))
    (folder / "03378500.geojson").write_text('{"tampered":true}')
    with pytest.raises(ValueError, match="SHA-256"):
        event_rows(folder)


def test_local_bundle_rejects_tampering_and_never_overwrites(tmp_path):
    folder, _, _ = capture(tmp_path)
    target = tmp_path / "local-native"
    build_bundle(folder, target)
    with pytest.raises(ValueError, match="new"):
        build_bundle(folder, target)
    (target / "events.ndjson").write_text("{}\n")
    with pytest.raises(ValueError, match="SHA-256"):
        verify_bundle(target)


def test_explicit_unavailable_source_exports_zero_events(tmp_path):
    folder, _, manifest = capture(tmp_path)
    manifest["stations"]["03378500"] = {"status": "SOURCE_UNAVAILABLE"}
    (folder / "manifest.json").write_text(json.dumps(manifest))
    assert event_rows(folder) == []
    receipt = build_bundle(folder, tmp_path / "without-source")
    assert receipt["eventCount"] == 0
    assert receipt["sourceStates"]["USGS-03378500"]["status"] == "SOURCE_UNAVAILABLE"
    assert verify_bundle(tmp_path / "without-source") == receipt
