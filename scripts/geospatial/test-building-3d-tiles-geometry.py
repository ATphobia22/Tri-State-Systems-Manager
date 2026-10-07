#!/usr/bin/env python3
"""Focused regression tests for topology-preserving building triangulation."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from shapely.geometry import Polygon


MODULE_PATH = Path(__file__).with_name("build-building-3d-tiles.py")
spec = importlib.util.spec_from_file_location("building_tiles", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def test_polygon_hole_and_multipolygon() -> None:
    polygon = {
        "type": "Polygon",
        "coordinates": [[
            [-87.90, 38.00], [-87.89, 38.00], [-87.89, 38.01],
            [-87.90, 38.01], [-87.90, 38.00],
        ], [
            [-87.897, 38.003], [-87.893, 38.003], [-87.893, 38.007],
            [-87.897, 38.007], [-87.897, 38.003],
        ]],
    }
    parts = module.geometry_for_feature(polygon)
    assert len(parts) == 1
    assert len(parts[0].interiors) == 1

    origin = module.surface(-87.895, 38.005)
    axes = module.enu_basis(-87.895, 38.005)
    triangles = module.triangulate_polygon(parts[0], origin, axes)
    local = module.local_polygon(parts[0], origin, axes)
    triangle_area = sum(abs(module.signed_area_2d([(p[0], p[1]) for p in tri])) for tri in triangles)
    assert abs(triangle_area - local.area) / local.area < 1e-9

    multi = {
        "type": "MultiPolygon",
        "coordinates": [
            [polygon["coordinates"][0]],
            [[
                [-87.88, 38.00], [-87.87, 38.00], [-87.87, 38.01],
                [-87.88, 38.01], [-87.88, 38.00],
            ]],
        ],
    }
    multi_parts = module.geometry_for_feature(multi)
    assert len(multi_parts) == 2
    positions, normals = module.build_prism(multi_parts, 100.0, 103.0, origin, axes)
    assert positions
    assert len(positions) == len(normals)


if __name__ == "__main__":
    test_polygon_hole_and_multipolygon()
    print("building geometry regression: PASS")
