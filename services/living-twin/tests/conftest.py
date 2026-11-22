from copy import deepcopy
from uuid import uuid4

import pytest


@pytest.fixture
def event():
    return {
        "version": 1, "event_id": str(uuid4()), "matrix": "T", "entity_id": "terrain:test",
        "timeline": "observed", "branch": "main", "valid_from": "2025-01-02T00:00:00Z",
        "operation": "upsert", "geometry": {"type": "Point", "coordinates": [-87.9, 38.1]},
        "state": {"horizontal_crs": "EPSG:4326", "vertical_datum": "NAVD88", "vertical_unit": "m"},
        "source": {"authority": "TEST_FIXTURE", "uri": "https://example.org/test",
                   "retrieved_at": "2025-01-03T00:00:00Z", "sha256": "a" * 64},
        "evidence": [], "asset": None,
    }


@pytest.fixture
def revision():
    def new(event, **updates):
        return {**deepcopy(event), "event_id": str(uuid4()), **updates}
    return new
