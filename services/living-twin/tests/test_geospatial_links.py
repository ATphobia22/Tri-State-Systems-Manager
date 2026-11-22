import copy
from uuid import uuid4

import pytest

from twin.contracts import validate
from twin.geospatial_links import LAYER_KINDS, make_link_event


def args():
    return {
        "layer_kind": "3d_tiles", "source_feature_id": "18129:IGIO:1234",
        "source": {"authority": "TEST_FIXTURE", "uri": "https://example.org/tileset",
                   "retrieved_at": "2025-02-01T00:00:00Z", "sha256": "a" * 64},
        "valid_from": "2025-01-01T00:00:00Z",
        "geometry": {"type": "Polygon", "coordinates": [
            [[-88.1, 37.8], [-88.0, 37.8], [-88.0, 37.9],
             [-88.1, 37.9], [-88.1, 37.8]]]},
        "source_horizontal_crs": "EPSG:2966",
        "vertical_datum": "NAVD88", "vertical_unit": "ftUS",
        "artifact": {"href": "https://example.org/tileset.json", "media_type": "application/json",
                     "sha256": "b" * 64},
        "upstream_event_ids": [str(uuid4())],
    }


@pytest.mark.parametrize("kind", sorted(LAYER_KINDS))
def test_all_layer_types_are_canonical_and_deterministic(kind):
    p = args()
    p["layer_kind"] = kind
    before = copy.deepcopy(p)
    a = make_link_event(**p)
    assert a == make_link_event(**p)
    assert a["matrix"] == "E"
    assert a["geometry"] == before["geometry"]
    assert a["state"]["coordinate_status"] == "UNVERIFIED"
    assert a["state"]["upstream_link_status"] == "EVENT_LINKED"
    assert a["state"]["footprint_crs"] == "EPSG:4326"
    assert a["evidence"][0]["relationship"] == "derived_from"
    validate(a)
    assert p == before


def test_revision_keeps_identity_and_immutable_events():
    p = args()
    a = make_link_event(**p)
    b = make_link_event(**{**p, "version": 2, "valid_from": "2025-02-02T00:00:00Z"})
    assert a["entity_id"] == b["entity_id"]
    assert a["event_id"] != b["event_id"]


def test_review_requires_transform_receipt_and_never_claims_certification():
    p = args()
    p["coordinate_status"] = "REVIEWED"
    with pytest.raises(ValueError, match="SHA-256"):
        make_link_event(**p)
    p["transformation_evidence_sha256"] = "c" * 64
    assert make_link_event(**p)["state"]["coordinate_status"] == "REVIEWED"


@pytest.mark.parametrize("coordinates", [
    [[-188, 38]], [[-88, 103]], [[float("nan"), 37]],
    [], [[-88, False]], [["-88", 38]],
])
def test_out_of_range_or_malformed_coordinates_rejected(coordinates):
    p = args()
    p["geometry"] = {"type": "Point", "coordinates": coordinates[0] if coordinates else []}
    with pytest.raises((ValueError, TypeError)):
        make_link_event(**p)


def test_missing_upstream_is_exposed_not_implicitly_promoted():
    p = args()
    p["upstream_event_ids"] = []
    event = make_link_event(**p)
    assert event["state"]["upstream_link_status"] == "UNRESOLVED"
    assert event["evidence"] == []


def test_no_identity_reuse_for_other_source_id():
    p = args()
    event = make_link_event(**p)
    assert event["entity_id"] != make_link_event(**{**p, "source_feature_id": "other"})["entity_id"]
