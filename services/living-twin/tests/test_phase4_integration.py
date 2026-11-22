"""PostGIS bbox, evidence lineage, version projection and pgSTAC acceptance."""
import os
from uuid import uuid4

import httpx
import pytest

from twin.geospatial_links import make_link_event
from twin.store import apply, connect

from test_integration import wait_for

API = os.getenv("STATE_API")
pytestmark = pytest.mark.skipif(not API, reason="Requires living-twin Compose integration")


def test_spatial_asset_history_and_bounded_evidence():
    source_id = str(uuid4())
    source = {"authority": "TEST_FIXTURE", "uri": "https://example.org/wgs84",
              "retrieved_at": "2025-02-01T00:00:00Z", "sha256": "a" * 64}
    base = {"version": 1, "event_id": str(uuid4()), "matrix": "B",
            "entity_id": "bldg:" + source_id, "timeline": "observed",
            "branch": "main", "valid_from": "2025-01-01T00:00:00Z",
            "operation": "upsert", "geometry": {"type": "Point", "coordinates": [-88.0, 38.0]},
            "state": {"source_object_id": source_id}, "source": source,
            "asset": None, "evidence": []}
    apply(base)
    link_params = {
        "layer_kind": "3d_tiles", "source_feature_id": source_id, "source": source,
        "valid_from": "2025-01-01T00:00:00Z",
        "geometry": {"type": "Point", "coordinates": [-88.0, 38.0]},
        "source_horizontal_crs": "EPSG:4326", "vertical_datum": "UNVERIFIED",
        "upstream_event_ids": [base["event_id"]],
        "artifact": {"href": "https://example.org/building.glb", "media_type": "model/gltf-binary",
                     "sha256": "b" * 64},
    }
    previous = make_link_event(**link_params)
    next_event = make_link_event(**{**link_params, "version": 2,
                                   "valid_from": "2025-02-01T00:00:00Z"})
    before, _ = apply(previous)
    after, _ = apply(next_event)
    assert after > before and not apply(next_event)[1]
    with httpx.Client(base_url=API, timeout=5) as client:
        def visible():
            resp = client.get("/twin/geospatial",
                              params={"bbox": "-88.1,37.9,-87.9,38.1", "kind": "3d_tiles"})
            resp.raise_for_status()
            for entry in resp.json()["entries"]:
                if entry["entity_id"] == next_event["entity_id"] and entry["seq"] == after:
                    return entry
            return None
        row = wait_for(visible)
        assert row["event"]["event_id"] == next_event["event_id"]
        assert row["event"]["evidence"] == [
            {"event_id": base["event_id"], "relationship": "derived_from"}]
        empty = client.get("/twin/geospatial",
                           params={"bbox": "-85,37,-84,38", "kind": "3d_tiles"})
        assert empty.is_success
        assert not any(x["entity_id"] == next_event["entity_id"]
                       for x in empty.json()["entries"])
        bad = client.get("/twin/geospatial", params={"bbox": "not-a-box"})
        assert bad.status_code == 422
        past = client.get("/twin/time/2025-01-15T00:00:00Z", params={"matrix": "E"})
        assert past.is_success
        assert any(x["event"]["event_id"] == previous["event_id"]
                   for x in past.json()["entries"])
    def has_stac_item():
        with connect() as conn:
            return conn.execute("SELECT id FROM pgstac.items WHERE id=%s",
                                (next_event["event_id"],)).fetchone()
    assert wait_for(has_stac_item)
