"""Evidence-first regional adapters: offline tests without Kafka or database."""
import hashlib
from uuid import uuid4

import pytest

from twin.regional import (
    basyx_shell, calibration_event, calibration_metrics, evidence_neighborhood,
    hashed_file, hec_ras_simulation, infrastructure_asset, inspect_hec_ras,
    knowledge_neighborhood, reality_capture, stac_delivery_status, utc, watershed,
)

AT = "2025-01-02T00:00:00Z"
SOURCE = {
    "authority": "USGS", "uri": "https://example.org/official-capture",
    "retrieved_at": "2025-01-03T00:00:00Z", "sha256": "a" * 64,
}
POINT = {"type": "Point", "coordinates": [-87.9, 38.1]}


def test_capture_is_hashed_deterministic_and_published_by_existing_outbox(tmp_path):
    path = tmp_path / "capture.glb"
    path.write_bytes(b"synthetic test geometry, not a verified survey")
    kwargs = dict(
        capture_id="posey-001", captured_at=AT, file_path=path,
        asset_href="https://example.org/tiles/capture.glb",
        media_type="model/gltf-binary", source=SOURCE, geometry=POINT,
        horizontal_crs="EPSG:2966", vertical_datum="NAVD88",
    )
    first = reality_capture(**kwargs)
    assert first == reality_capture(**kwargs)
    assert first["matrix"] == "R"
    assert first["asset"]["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert first["state"]["review_status"] == "UNREVIEWED"
    assert first["state"]["vertical_datum"] == "NAVD88"
    with pytest.raises(ValueError):
        reality_capture(**{**kwargs, "vertical_datum": ""})
    path.write_bytes(b"changed content")
    assert reality_capture(**kwargs)["event_id"] != first["event_id"]


def test_local_source_constraints(tmp_path):
    path = tmp_path / "source.bin"
    path.write_bytes(b"abc")
    assert hashed_file(path) == hashlib.sha256(b"abc").hexdigest()
    symlink = tmp_path / "link.bin"
    symlink.symlink_to(path)
    with pytest.raises(ValueError):
        hashed_file(symlink)
    with pytest.raises(ValueError):
        utc("2025-01-01T00:00:00")
    assert utc("2025-01-01T01:00:00+01:00") == "2025-01-01T00:00:00Z"


def test_aas_infrastructure_identity_and_typed_relationships():
    first = infrastructure_asset(
        asset_id="bridge:OH001", asset_type="BRIDGE", at=AT,
        source=SOURCE, geometry=POINT,
        relationships=[{"type": "spans", "target_id": "reach:OHIO"}],
    )
    assert first["matrix"] == "I"
    assert first["state"]["global_asset_id"] == "urn:tsm:asset:bridge:OH001"
    assert first["state"]["review_status"] == "UNREVIEWED"
    with pytest.raises(ValueError):
        infrastructure_asset(asset_id="broken", asset_type="BRIDGE", at=AT,
                             source=SOURCE, relationships=[{"target_id": "A"}])
    return first


def test_basyx_object_when_optional_sdk_is_present():
    pytest.importorskip("basyx.aas")
    event = infrastructure_asset(
        asset_id="levee:POSEY", asset_type="LEVEE", at=AT, source=SOURCE,
    )
    shell = basyx_shell(event)
    assert str(shell.id).endswith("levee:POSEY")
    assert shell.asset_information.global_asset_id == "urn:tsm:asset:levee:POSEY"


def test_watershed_requires_area_and_never_invents_stage():
    event = watershed(
        watershed_id="ohio-wabash", at=AT, source=SOURCE, geometry=POINT,
        area_sq_km=100.1, stations=["USGS-03378500", "USGS-03377500"],
    )
    assert event["matrix"] == "S"
    assert event["state"]["stage_ft"] is None
    assert event["state"]["discharge_cfs"] is None
    with pytest.raises(ValueError):
        watershed(watershed_id="x", at=AT, source=SOURCE, geometry=POINT,
                  area_sq_km=0, stations=["one"])
    with pytest.raises(ValueError):
        watershed(watershed_id="x", at=AT, source=SOURCE, geometry=POINT,
                  area_sq_km=1, stations=["one", "one"])


def test_hec_ras_read_only_hdf5_inventory_and_scenario(tmp_path):
    h5py = pytest.importorskip("h5py")
    path = tmp_path / "plan.p01.hdf"
    with h5py.File(path, "w") as hdf:
        hdf.create_dataset("Results/sample", data=[1.0, 2.0])
    before = path.read_bytes()
    inventory = inspect_hec_ras(path)
    assert path.read_bytes() == before
    assert inventory["dataset_count"] == 1
    assert inventory["datasets"][0]["path"] == "/Results/sample"
    assert inventory["results_certified"] is False
    event = hec_ras_simulation(
        simulation_id="plan-001", revision="RAS6-verified-by-operator",
        at=AT, source=SOURCE, inventory=inventory,
    )
    assert event["matrix"] == "M"
    assert event["timeline"] == "scenario"
    assert event["state"]["certification"] == "NOT_CERTIFIED"
    with pytest.raises(ValueError):
        inspect_hec_ras(tmp_path / "missing.hdf")


def test_calibration_refuses_mixed_datums_and_duplicate_pairs():
    pairs = [
        {"station_id": "03378500", "observed_at": "2025-01-01T00:00:00Z",
         "unit": "ft", "vertical_reference": "STATION_GAGE_DATUM",
         "observed": 10, "predicted": 11},
        {"station_id": "03378500", "observed_at": "2025-01-02T00:00:00Z",
         "unit": "ft", "vertical_reference": "STATION_GAGE_DATUM",
         "observed": 11, "predicted": 10},
    ]
    stats = calibration_metrics(pairs)
    assert stats["rmse"] == 1
    assert stats["bias"] == 0
    assert stats["mae"] == 1
    assert stats["observation_use"] == "withheld"
    with pytest.raises(ValueError):
        calibration_metrics([pairs[0], {**pairs[1], "vertical_reference": "NAVD88"}])
    with pytest.raises(ValueError):
        calibration_metrics([pairs[0], pairs[0]])
    with pytest.raises(ValueError):
        calibration_metrics([{**pairs[0], "observed": float("nan")}])
    with pytest.raises(ValueError):
        calibration_metrics([{**pairs[0], "vertical_reference": "GAGE_DATUM_UNRESOLVED"}])
    with pytest.raises(ValueError):
        calibration_event(calibration_id="a", at=AT, source=SOURCE,
                          pairs=pairs, evidence=[])
    event = calibration_event(
        calibration_id="gage-a", at=AT, source=SOURCE, pairs=pairs,
        evidence=[{"event_id": str(uuid4()), "relationship": "derived_from"}],
    )
    assert event["matrix"] == "V"
    assert event["state"]["observation_use"] == "withheld"
    assert event["timeline"] == "scenario"


class FakeConnection:
    def __init__(self, rows=None, item=None):
        self.rows = rows or []
        self.item = item
        self.statements = []

    def execute(self, statement, args):
        self.statements.append((statement, args))
        return self

    def fetchall(self):
        return self.rows

    def fetchone(self):
        return self.item


def test_evidence_and_knowledge_graph_are_queries_over_accepted_history():
    event_id = str(uuid4())
    conn = FakeConnection(rows=[{"relationship": "derived_from"}])
    assert evidence_neighborhood(conn, event_id) == conn.rows
    assert "twin.evidence_link" in conn.statements[0][0]
    conn2 = FakeConnection(rows=[{"relationship": "spans", "authority": "USGS"}])
    assert knowledge_neighborhood(conn2, "bridge:OH001") == conn2.rows
    assert "read_model.current_entity" in conn2.statements[0][0]
    with pytest.raises(ValueError):
        knowledge_neighborhood(conn2, "bad name!")
    with pytest.raises(ValueError):
        evidence_neighborhood(conn, event_id, limit=251)


def test_pgstac_receipt_is_not_equivalent_to_independent_asset_integrity():
    event_id = str(uuid4())
    conn = FakeConnection(item={
        "event_id": event_id, "asset": {"href": "https://example.org/tile.glb"},
        "source": SOURCE, "published": True,
    })
    receipt = stac_delivery_status(conn, event_id, "tsm-twin-assets")
    assert receipt["published"] is True
    assert receipt["asset_integrity_independently_verified"] is False
    assert "pgstac.items" in conn.statements[0][0]
    with pytest.raises(LookupError):
        stac_delivery_status(FakeConnection(), event_id, "tsm-twin-assets")


def test_existing_fastapi_app_includes_regional_routes():
    from twin.api import app
    paths = {r.path for r in app.routes}
    for suffix in (
        "/captures", "/assets", "/watersheds", "/simulations",
        "/calibrations", "/evidence/{event_id}", "/knowledge/{entity_id}",
        "/stac/{event_id}",
    ):
        assert f"/v1/regional{suffix}" in paths
