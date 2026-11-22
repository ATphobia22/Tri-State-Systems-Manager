"""Native gauge export: real offline capture preflight, byte receipts and tamper rejection."""
import json

import pytest

from test_offline_bundle import capture
from twin.native_gauge_export import export, verify
from twin.offline_bundle import build_bundle


def make_bundle(tmp_path):
    source, _, _ = capture(tmp_path)
    bundle = tmp_path / "observation-bundle"
    build_bundle(source, bundle)
    return bundle


def test_native_gauge_export_from_verified_observation_bundle(tmp_path):
    bundle = make_bundle(tmp_path)
    target = tmp_path / "native"
    receipt = export(bundle, target, as_of="2025-01-01T13:01:00Z")
    assert verify(target) == receipt
    assert receipt["authentication"] == "UNSIGNED_LOCAL_SHA256_ONLY"
    view = json.loads((target / "gauge-view.json").read_text())
    assert view["stations"]["USGS-03378500"]["series"][0]["gageHeightFt"] == 8.5
    assert view["stations"]["USGS-03322000"]["sourceStatus"] == "SOURCE_UNAVAILABLE"
    assert view["navd88WseIncluded"] is False
    assert view["engineeringUse"] == "NOT_VALIDATED"
    with pytest.raises(ValueError, match="new directory"):
        export(bundle, target, as_of="2025-01-01T13:01:00Z")


def test_native_gauge_export_deterministic_and_tamper_rejected(tmp_path):
    bundle = make_bundle(tmp_path)
    a, b = tmp_path / "a", tmp_path / "b"
    export(bundle, a, as_of="2025-01-01T13:01:00Z")
    export(bundle, b, as_of="2025-01-01T13:01:00Z")
    assert (a / "gauge-view.json").read_bytes() == (b / "gauge-view.json").read_bytes()
    assert (a / "gauge-view.receipt.json").read_bytes() == (b / "gauge-view.receipt.json").read_bytes()
    (a / "gauge-view.json").write_text("{}")
    with pytest.raises(ValueError, match="SHA-256"):
        verify(a)


def test_native_gauge_receipt_cannot_claim_navd88_or_public_approval(tmp_path):
    bundle = make_bundle(tmp_path)
    target = tmp_path / "native"
    export(bundle, target, as_of="2025-01-01T13:01:00Z")
    filename = target / "gauge-view.receipt.json"
    data = json.loads(filename.read_text())
    data["navd88WseIncluded"] = True
    filename.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="authority"):
        verify(target)


def test_native_export_detects_modified_upstream_source(tmp_path):
    bundle = make_bundle(tmp_path)
    (bundle / "events.ndjson").write_text('{"tampered":true}\n')
    with pytest.raises(ValueError, match="SHA-256"):
        export(bundle, tmp_path / "native", as_of="2025-01-01T13:01:00Z")


def test_native_export_rejects_unavailable_snapshot_or_future_clock(tmp_path):
    bundle = make_bundle(tmp_path)
    with pytest.raises(ValueError, match="precede"):
        export(bundle, tmp_path / "native", as_of="2025-01-01T00:00:00Z")
