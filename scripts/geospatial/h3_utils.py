"""H3 hexagonal spatial indexing utilities for the twin.

H3 (Uber, Apache-2.0) discretizes the Earth into hierarchical hexagonal
cells. The twin uses it for honest, offline spatial aggregation: hex-binning
building footprints, flood-exposure rollups, and de-duplicated polygon
coverage — no network, no keys, pure computation.

Resolution guide (area per cell, approximate):
    res 6  ~36 km^2   regional rollups
    res 8  ~0.74 km^2 neighborhood / district
    res 9  ~0.10 km^2 block / street
    res 10 ~0.015 km^2 precise POI matching
"""

from __future__ import annotations

import h3

ANCHOR_RES9 = "89266a40203ffff"  # res-9 cell containing the site anchor


def cell_for_point(lat: float, lon: float, resolution: int = 9) -> str:
    """Return the H3 cell ID containing (lat, lon)."""
    if not -90.0 <= lat <= 90.0:
        raise ValueError(f"latitude out of range: {lat}")
    if not -180.0 <= lon <= 180.0:
        raise ValueError(f"longitude out of range: {lon}")
    if not 0 <= resolution <= 15:
        raise ValueError(f"resolution out of range: {resolution}")
    return h3.latlng_to_cell(lat, lon, resolution)


def cell_center(cell: str) -> tuple[float, float]:
    """Return (lat, lon) of a cell's center."""
    if not h3.is_valid_cell(cell):
        raise ValueError(f"invalid H3 cell: {cell}")
    return h3.cell_to_latlng(cell)


def polyfill_polygon(ring: list[tuple[float, float]], resolution: int = 9) -> set[str]:
    """Return the set of cells whose centers fall inside a lon/lat ring.

    `ring` is [(lon, lat), ...] (GeoJSON order). Guarantees complete coverage
    with no overlaps — use for de-duplicated area crawling.
    """
    polygon = h3.LatLngPoly(outer=[(lat, lon) for lon, lat in ring])
    return set(h3.polygon_to_cells(polygon, resolution))


def rollup_counts(cells: list[str], target_resolution: int) -> dict[str, int]:
    """Aggregate cell IDs up to `target_resolution`, returning parent->count."""
    counts: dict[str, int] = {}
    for cell in cells:
        parent = h3.cell_to_parent(cell, target_resolution)
        counts[parent] = counts.get(parent, 0) + 1
    return counts


def neighbor_disk(cell: str, k: int) -> set[str]:
    """Return all cells within k steps of `cell` (proximity search)."""
    if not h3.is_valid_cell(cell):
        raise ValueError(f"invalid H3 cell: {cell}")
    if k < 0:
        raise ValueError(f"k must be >= 0: {k}")
    return set(h3.grid_disk(cell, k))


def cells_to_geojson_feature_collection(cells: list[str]) -> dict:
    """Convert cells to a GeoJSON FeatureCollection of hexagon boundaries."""
    features = []
    for cell in cells:
        boundary = h3.cell_to_boundary(cell)  # [(lat, lon), ...]
        ring = [[lon, lat] for lat, lon in boundary]
        ring.append(ring[0])
        features.append(
            {
                "type": "Feature",
                "properties": {"h3": cell, "resolution": h3.get_resolution(cell)},
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )
    return {"type": "FeatureCollection", "features": features}
