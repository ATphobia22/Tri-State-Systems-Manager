import hashlib
import json

import pytest

from twin.contracts import encode
from twin.import_usgs import event_rows


def test_usgs_snapshot_is_hash_bound_replayable_and_retains_gage_reference(tmp_path):
    feature = {"type":"Feature", "id":"observation-1", "geometry":None, "properties":{
        "monitoring_location_id":"USGS-03322000", "parameter_code":"00065",
        "unit_of_measure":"ft", "time_series_id":"gage-1", "time":"2025-01-01T12:00:00Z",
        "value":"-999", "approval_status":"Provisional",
    }}
    raw = json.dumps({"type":"FeatureCollection","features":[feature]}).encode()
    source = tmp_path / "03322000.geojson"
    source.write_bytes(raw)
    (tmp_path / "manifest.json").write_text(json.dumps({
        "schema":"tsm.river-twin.observations.v1", "finishedAt":"2025-01-01T15:00:00Z",
        "stations":{
            "03322000":{"status":"CAPTURED", "featureCount":1,
                        "sourceUrl":"https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items?monitoring_location_id=USGS-03322000&parameter_code=00065",
                        "rawSha256":hashlib.sha256(raw).hexdigest()},
            "03378500":{"status":"SOURCE_UNAVAILABLE"},
        },
    }))
    row, = event_rows(tmp_path)
    assert event_rows(tmp_path) == [row]
    assert row["state"]["value"] is None and row["state"]["quality"] == "Provisional"
    assert row["state"]["vertical_reference"] == "STATION_GAGE_DATUM_UNRESOLVED"
    assert encode(row)["matrix"] == "O"
    source.write_bytes(raw + b" ")
    with pytest.raises(ValueError, match="SHA-256 mismatch"):
        event_rows(tmp_path)
