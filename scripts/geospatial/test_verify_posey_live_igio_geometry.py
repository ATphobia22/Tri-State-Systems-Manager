"""Synthetic, offline regression tests for official building snapshot parity audit."""
import hashlib
import importlib.util
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
SPEC = importlib.util.spec_from_file_location(
    "posey_live_igio_verifier", Path(__file__).with_name("verify_posey_live_igio_geometry.py")
)
assert SPEC and SPEC.loader
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)
audit = VERIFY.audit


def building(oid, coords=None, year="2020"):
    return {
        "type": "Feature", "properties": {"objectid": oid, "county": "Posey", "lidaryear": year},
        "geometry": {"type": "Polygon", "coordinates": coords or [[[-88.0, 38.0], [-87.99, 38.0], [-87.99, 38.01], [-88.0, 38.0]]]},
    }


def fixture(tmp_path, source=None, live=None, edit=123):
    source = source or [building(740296), building(740297)]
    live = live if live is not None else source
    archive = tmp_path / "source.geojson"
    archive.write_text(json.dumps({"type":"FeatureCollection", "features":source}), encoding="utf-8")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()

    def fetch(url):
        params = parse_qs(urlparse(url).query)
        if urlparse(url).path.endswith("/query"):
            if params.get("returnCountOnly") == ["true"]:
                return {"count":len(live)}
            if params.get("returnIdsOnly") == ["true"]:
                return {"objectIdFieldName":"objectid", "objectIds":[f["properties"]["objectid"] for f in live]}
            requested = set(map(int,params.get("objectIds",[""])[0].split(",")))
            assert params.get("outSR") == ["4326"]
            assert params.get("f") == ["geojson"]
            return {"type":"FeatureCollection","features":[f for f in live if f["properties"]["objectid"] in requested]}
        return {"id":0,"name":"Indiana Building Footprints 2016-2020","objectIdField":"objectid",
                "geometryType":"esriGeometryPolygon", "hasZ":False,"maxRecordCount":2000,
                "editingInfo":{"lastEditDate":edit}}
    return archive,digest,fetch


def test_exact_geometry_and_reordered_source_match(tmp_path):
    archive,sha,fetch=fixture(tmp_path)
    result=audit(archive,fetch,sha,expected_count=2,batch_size=1)
    assert result["status"] == "LIVE_GEOMETRY_EQUALS_PINNED_SOURCE"
    assert result["matchedGeometryCount"]==2
    assert not result["engineeringUse"]
    assert result["geometryMismatchObjectIds"]==[]


def test_changed_geometry_is_detected_not_silently_accepted(tmp_path):
    live=[building(740296,[[[-88.0,38.0],[-87.97,38.0],[-87.99,38.01],[-88.0,38.0]]]),building(740297)]
    archive,sha,fetch=fixture(tmp_path,live=live)
    report=audit(archive,fetch,sha,expected_count=2,batch_size=2)
    assert report["status"] == "SOURCE_GEOMETRY_OR_ATTRIBUTE_DRIFT"
    assert report["geometryMismatchObjectIds"]==[740296]


def test_source_identity_drift_not_disguised_by_same_count(tmp_path):
    archive,sha,fetch=fixture(tmp_path,live=[building(740296),building(740298)])
    report=audit(archive,fetch,sha,expected_count=2,batch_size=2)
    assert report["status"] == "SOURCE_IDENTITY_DRIFT"
    assert report["liveOnlyIds"] == [740298]
    assert report["archivedOnlyIds"] == [740297]
    assert report["matchedGeometryCount"] == 0


def test_corrupt_pinned_bytes_rejected_before_network(tmp_path):
    archive,sha,fetch=fixture(tmp_path)
    archive.write_text(archive.read_text()+" ")
    def no_request(_url):
        raise AssertionError("Must not contact network if source bytes don't match")
    with pytest.raises(ValueError,match="SHA-256"):
        audit(archive,no_request,sha,expected_count=2)


def test_unstable_edit_revision_rejected(tmp_path):
    archive,sha,fetch=fixture(tmp_path)
    calls=0
    def changing(url):
        nonlocal calls
        if not urlparse(url).path.endswith("/query"):
            calls+=1
            rec=fetch(url)
            rec["editingInfo"]["lastEditDate"]=calls
            return rec
        return fetch(url)
    report=audit(archive,changing,sha,expected_count=2,batch_size=2)
    assert report["status"] == "SOURCE_CHANGED_DURING_AUDIT"
    assert not report["engineeringUse"]


def test_source_year_drift_is_flagged(tmp_path):
    archive,sha,fetch=fixture(tmp_path,live=[building(740296,year="2017"),building(740297)])
    report=audit(archive,fetch,sha,expected_count=2,batch_size=2)
    assert report["status"] == "SOURCE_GEOMETRY_OR_ATTRIBUTE_DRIFT"
    assert report["lidarYearMismatchObjectIds"]==[740296]
