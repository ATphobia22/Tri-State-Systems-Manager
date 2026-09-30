"""Tests for scripts/geospatial/h3_utils.py. Offline, no network."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from geospatial.h3_utils import (
    ANCHOR_RES9,
    cell_center,
    cell_for_point,
    cells_to_geojson_feature_collection,
    neighbor_disk,
    polyfill_polygon,
    rollup_counts,
)

# Site anchor: 13101 Bonebank Road (37.845887, -88.005075)
ANCHOR_LAT, ANCHOR_LON = 37.845887, -88.005075


def test_anchor_cell_is_stable():
    assert cell_for_point(ANCHOR_LAT, ANCHOR_LON, 9) == ANCHOR_RES9


def test_cell_center_near_anchor():
    lat, lon = cell_center(ANCHOR_RES9)
    assert abs(lat - ANCHOR_LAT) < 0.01
    assert abs(lon - ANCHOR_LON) < 0.01


def test_invalid_inputs_raise():
    for bad in [lambda: cell_for_point(91, 0), lambda: cell_for_point(0, 181),
                lambda: cell_for_point(0, 0, 16), lambda: cell_center("nope"),
                lambda: neighbor_disk("nope", 1), lambda: neighbor_disk(ANCHOR_RES9, -1)]:
        try:
            bad()
        except ValueError:
            continue
        raise AssertionError("expected ValueError")


def test_polyfill_covers_anchor():
    # ~1 km square around the anchor (lon/lat order)
    ring = [(-88.012, 37.841), (-87.998, 37.841),
            (-87.998, 37.851), (-88.012, 37.851), (-88.012, 37.841)]
    cells = polyfill_polygon(ring, 9)
    assert ANCHOR_RES9 in cells
    assert len(cells) > 10  # res-9 cells are ~0.1 km^2; 1 km^2 needs dozens


def test_rollup_aggregates_to_parent():
    cells = [cell_for_point(ANCHOR_LAT, ANCHOR_LON, 10) for _ in range(3)]
    cells.append(cell_for_point(37.85, -88.01, 10))
    counts = rollup_counts(cells, 8)
    assert sum(counts.values()) == 4
    assert all(len(c) == 15 for c in counts)  # H3 cell IDs are 15 hex chars


def test_neighbor_disk_sizes():
    assert neighbor_disk(ANCHOR_RES9, 0) == {ANCHOR_RES9}
    assert len(neighbor_disk(ANCHOR_RES9, 1)) == 7
    assert len(neighbor_disk(ANCHOR_RES9, 3)) == 37


def test_geojson_round_trip():
    fc = cells_to_geojson_feature_collection([ANCHOR_RES9])
    assert fc["type"] == "FeatureCollection"
    feat = fc["features"][0]
    assert feat["properties"]["h3"] == ANCHOR_RES9
    assert feat["geometry"]["type"] == "Polygon"
    ring = feat["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]  # closed ring
    assert len(ring) >= 7  # hexagon vertices + closure
