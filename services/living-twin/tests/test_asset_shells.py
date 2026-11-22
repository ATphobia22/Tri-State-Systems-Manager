from uuid import uuid4

import pytest

from twin.asset_shells import KINDS, export_aas, make_event
from twin.contracts import validate


def args():
    return {
        "asset_id": str(uuid4()), "asset_type": "levee", "name": "Synthetic test levee",
        "version": 1, "valid_from": "2025-01-01T00:00:00Z",
        "source": {"authority": "TEST_FIXTURE", "uri": "https://example.org/infrastructure",
                   "retrieved_at": "2025-01-02T00:00:00Z", "sha256": "c" * 64},
        "geometry": {"type": "LineString", "coordinates": [[-88., 37.9], [-87.9, 38.]]},
    }


@pytest.mark.parametrize("kind", sorted(KINDS))
def test_supported_infrastructure_types(kind):
    params = args()
    params["asset_type"] = kind
    event = make_event(**params)
    validate(event)
    assert event == make_event(**params)
    assert event["state"]["asset_type"] == kind
    exported = export_aas(event)
    assert exported["shell"]["assetInformation"]["globalAssetId"].endswith(params["asset_id"])
    assert exported["submodels"][0]["submodelElements"][2]["value"] == "1"
    assert exported["verification"].startswith("AAS_SHAPE_ONLY")


def test_typed_relationships_are_sorted():
    params = args()
    a, b = str(uuid4()), str(uuid4())
    params["relationships"] = [{"type": "connected_to", "target_asset_id": a},
                               {"type": "part_of", "target_asset_id": b}]
    event = make_event(**params)
    assert len(export_aas(event)["submodels"][0]["submodelElements"][-1]["value"]) == 2
    with pytest.raises(ValueError, match="Duplicate"):
        make_event(**{**params, "relationships": [params["relationships"][0]] * 2})
    with pytest.raises(ValueError, match="Self-referential"):
        make_event(**{**params, "relationships": [
            {"type": "part_of", "target_asset_id": params["asset_id"]}]})


def test_invalid_assets_rejected():
    params = args()
    for wrong in ("factory_robot", "nuclear_reactor"):
        with pytest.raises(ValueError):
            make_event(**{**params, "asset_type": wrong})
    for wrong in (0, -1, True, "2"):
        with pytest.raises(ValueError):
            make_event(**{**params, "version": wrong})
    with pytest.raises(ValueError):
        make_event(**{**params, "source": {"authority": "unverified"}})


def test_aas_rejects_non_infrastructure():
    event = make_event(**args())
    event["matrix"] = "H"
    with pytest.raises(ValueError):
        export_aas(event)
