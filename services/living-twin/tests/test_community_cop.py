"""Offline COP projection regression tests (synthetic source fixtures)."""
from copy import deepcopy

import pytest

from test_offline_bundle import capture
from twin.community_cop import build, project
from twin.offline_bundle import build_bundle
from twin.offline_view import verified_view


def make_bundle(tmp_path, **kwargs):
    source, _, _ = capture(tmp_path, **kwargs)
    bundle = tmp_path / "bundle"
    build_bundle(source, bundle)
    return bundle


def test_source_to_cop(tmp_path):
    bundle = make_bundle(tmp_path)
    doc = build(bundle, as_of="2025-01-01T13:01:00Z")
    assert doc == build(bundle, as_of="2025-01-01T13:01:00Z")
    assert doc["schema"] == "tsm.community-cop.v1"
    assert doc["navd88WseIncluded"] is False
    assert doc["publicPublication"] == "REVIEW_REQUIRED"
    assert doc["stations"]["USGS-03322000"]["sourceStatus"] == "SOURCE_UNAVAILABLE"
    assert doc["stations"]["USGS-03377500"]["sourceStatus"] == "NOT_IN_CAPTURE"
    assert len(doc["features"]) == 1
    f = doc["features"][0]
    assert f["geometry"]["coordinates"] == [-87.9, 38.1]
    assert f["properties"]["gageHeightFt"] == 8.5
    assert f["properties"]["readingStatus"] == "STALE"
    assert f["properties"]["authority"] == "USGS"
    assert len(f["properties"]["sourceSha256"]) == 64


def test_missing_measurement(tmp_path):
    doc = build(make_bundle(tmp_path, no_data=True), as_of="2025-01-01T13:01:00Z")
    assert doc["features"][0]["properties"]["gageHeightFt"] is None
    assert doc["features"][0]["properties"]["readingStatus"] == "MISSING_MEASUREMENT"


def test_unlocated_series_and_vertical_coordinate(tmp_path):
    view = verified_view(make_bundle(tmp_path), as_of="2025-01-01T13:01:00Z")
    series = view["stations"]["USGS-03378500"]["series"][0]
    series["geometryWgs84"]["coordinates"].append(123)
    assert len(project(view)["features"][0]["geometry"]["coordinates"]) == 2
    series["geometryWgs84"] = None
    doc = project(view)
    assert doc["features"] == []
    assert doc["stations"]["USGS-03378500"]["unlocatedSeriesCount"] == 1


def test_tampered_bundle_cannot_export(tmp_path):
    bundle = make_bundle(tmp_path)
    (bundle / "events.ndjson").write_text("{}\n")
    with pytest.raises(ValueError, match="SHA-256"):
        build(bundle, as_of="2025-01-01T13:01:00Z")


def test_false_authority_rejected(tmp_path):
    view = verified_view(make_bundle(tmp_path), as_of="2025-01-01T13:01:00Z")
    view["navd88WseIncluded"] = True
    with pytest.raises(ValueError, match="observation-only"):
        project(view)
