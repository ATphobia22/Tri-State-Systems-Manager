"""Offline regression tests for Posey source-inventory reconciliation."""
import importlib.util
import json
from pathlib import Path

MODULE = Path(__file__).with_name("reconcile_posey_building_inventories.py")
spec = importlib.util.spec_from_file_location("posey_reconcile", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def inventory(path, features):
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}))


def feature(oid, x=0):
    return {"type": "Feature", "properties": {"OBJECTID": oid},
            "geometry": {"type": "Polygon", "coordinates": [[[x, 0], [x+1, 0], [x, 1], [x, 0]]]}}


def test_identical_inventory(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    inventory(a, [feature(2), feature(1)])
    inventory(b, [feature(1), feature(2)])
    result = module.reconcile(a, b)
    assert result["equivalent_identity_and_geometry"]
    assert result["common_objectids"] == 2


def test_detects_geometry_and_identity_changes(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    inventory(a, [feature(1), feature(2)])
    inventory(b, [feature(1, 4), feature(3)])
    result = module.reconcile(a, b)
    assert not result["equivalent_identity_and_geometry"]
    assert result["changed_geometry_objectids"] == [1]
    assert result["left_only_objectids"] == [2]
    assert result["right_only_objectids"] == [3]


def test_duplicate_identity_is_not_equivalent(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    inventory(a, [feature(1), feature(1)])
    inventory(b, [feature(1)])
    result = module.reconcile(a, b)
    assert not result["equivalent_identity_and_geometry"]
    assert result["left"]["duplicate_objectids"] == [1]


def test_acquisition_igio_objectid_alias_reconciles_identical_geometry(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    fa = feature(740382)
    fb = feature(740382)
    fa["properties"] = {"igioObjectId": 740382, "county": "Posey"}
    fb["properties"] = {"objectid": 740382, "county": "Posey"}
    for path, item in ((a, fa), (b, fb)):
        path.write_text(json.dumps({"type": "FeatureCollection", "geometryCrs": "EPSG:4326", "features": [item]}))
    report = module.reconcile(a, b)
    assert report["equivalent_identity_and_geometry"]
    assert report["common_objectids"] == 1


def test_conflicting_source_identity_aliases_fail_evidence_gate(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    bad = feature(740382)
    bad["properties"] = {"igioObjectId": 740382, "objectid": 999999}
    inventory(a, [bad])
    inventory(b, [feature(740382)])
    report = module.reconcile(a, b)
    assert not report["equivalent_identity_and_geometry"]
    assert report["left"]["conflicting_identity_count"] == 1


def test_mismatched_crs_cannot_approve_same_numeric_geometry(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    a.write_text(json.dumps({"type": "FeatureCollection", "geometryCrs": "EPSG:4326", "features": [feature(5)]}))
    b.write_text(json.dumps({"type": "FeatureCollection", "geometryCrs": "EPSG:3857", "features": [feature(5)]}))
    report = module.reconcile(a, b)
    assert not report["equivalent_identity_and_geometry"]
    assert report["crs_compatible"] is False


def test_conflicting_crs_fields_within_snapshot_rejected(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    a.write_text(json.dumps({"type": "FeatureCollection", "geometryCrs": "EPSG:4326",
                             "crs": {"type": "name", "properties": {"name": "EPSG:2968"}},
                             "features": [feature(5)]}))
    b.write_text(json.dumps({"type": "FeatureCollection", "geometryCrs": "EPSG:4326", "features": [feature(5)]}))
    report = module.reconcile(a, b)
    assert not report["equivalent_identity_and_geometry"]
    assert report["left"]["crs_metadata_consistent"] is False


def test_matching_igio_id_aliases_on_same_feature_are_accepted(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    same = feature(740382)
    same["properties"]["igioObjectId"] = 740382
    inventory(a, [same])
    inventory(b, [feature(740382)])
    assert module.reconcile(a, b)["equivalent_identity_and_geometry"]


def test_boolean_source_identity_is_not_accepted(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    bad = feature(True)
    bad["properties"] = {"igioObjectId": True}
    inventory(a, [bad])
    inventory(b, [feature(1)])
    assert not module.reconcile(a, b)["equivalent_identity_and_geometry"]
