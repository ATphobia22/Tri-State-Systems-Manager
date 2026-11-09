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
