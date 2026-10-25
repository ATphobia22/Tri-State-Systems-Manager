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





def test_full_pipeline_uses_measured_heights_and_reconciles_ids() -> None:
    import json
    import tempfile
    from unittest.mock import patch
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        source = root / "source.geojson"
        output = root / "tiles"
        square = [[-87.9, 38.0], [-87.899, 38.0], [-87.899, 38.001],
                  [-87.9, 38.001], [-87.9, 38.0]]
        def feature(sid: int, height: float, *, status: str = "OK") -> dict:
            return {
                "type": "Feature",
                "properties": {
                    "igioObjectId": sid, "groundElevationMeanFt": 375.0,
                    "lidarHeightStatus": status, "heightProvenance": "OBSERVED",
                    "lidarHeightFt": height,
                },
                "geometry": {"type": "Polygon", "coordinates": [square]},
            }
        payload = {"type": "FeatureCollection", "features": [feature(17, 15.0), feature(19, 22.5)]}
        source.write_text(json.dumps(payload))
        with patch.object(sys, "argv", ["builder", "--geojson", str(source),
                                        "--out-dir", str(output),
                                        "--expected-buildings", "2"]):
            module.main()
        manifest = json.loads((output / "manifest.json").read_text())
        tileset = json.loads((output / "tileset.json").read_text())
        rejected = json.loads((output / "rejected-features.json").read_text())
        assert manifest["input"]["featureCount"] == 2
        assert manifest["input"]["tileCount"] == 2
        assert manifest["parameters"]["extrusionEstimated"] is False
        assert rejected["rejectedCount"] == 0
        assert [t["extras"]["tsm"]["sourceObjectId"] for t in tileset["root"]["children"]] == [17, 19]
        assert (output / "17.glb").is_file() and (output / "19.glb").is_file()
        assert (output / "SHA256SUMS").is_file()
        assert tileset["root"]["children"][1]["boundingVolume"]["box"][11] > tileset["root"]["children"][0]["boundingVolume"]["box"][11]

        # Replacing one measured height with unavailability must never allow
        # a 2/2 claim and must produce precise non-secret ID diagnostics.
        payload["features"][1]["properties"]["lidarHeightStatus"] = "UNAVAILABLE"
        source.write_text(json.dumps(payload))
        with patch.object(sys, "argv", ["builder", "--geojson", str(source),
                                        "--out-dir", str(root / "incomplete"),
                                        "--expected-buildings", "2"]):
            try:
                module.main()
                raise AssertionError("incomplete source unexpectedly accepted")
            except SystemExit as exc:
                assert "source-to-tile identity coverage 1/2" in str(exc)
        gap = json.loads((root / "incomplete" / "rejected-features.json").read_text())
        assert gap["rejectedCount"] == 1
        assert gap["rejectedSourceObjectIdsAndReasons"][0]["sourceObjectId"] == 19
        assert gap["rejectedSourceObjectIdsAndReasons"][0]["reason"] == "unavailable_lidar_height"


if __name__ == "__main__":
    test_full_pipeline_uses_measured_heights_and_reconciles_ids()
    test_polygon_hole_and_multipolygon()
    print("building geometry regression: PASS")
