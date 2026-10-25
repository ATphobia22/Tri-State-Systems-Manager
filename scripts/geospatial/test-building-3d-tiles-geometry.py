#!/usr/bin/env python3
"""Focused regression tests for topology-preserving building triangulation."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
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


def sample_feature(identifier: int, *, height_ft: float | None = 16.0,
                   ground_ft: float = 382.0) -> dict:
    props = {
        "igioObjectId": identifier,
        "groundElevationFt": ground_ft,
        "lidarHeightStatus": "OK" if height_ft is not None else "UNAVAILABLE",
        "heightProvenance": "OBSERVED" if height_ft is not None else "UNAVAILABLE",
        "lidarHeightFt": height_ft,
        "lidarHeightDatum": "NAVD88",
        "lidarHeightUnit": "ftUS",
        "lidarGroundElevM": ground_ft * (1200.0 / 3937.0),
    }
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-87.901, 38.000], [-87.900, 38.000],
                [-87.900, 38.001], [-87.901, 38.001],
                [-87.901, 38.000],
            ]],
        },
    }


def run_builder(features: list[dict], expected: int) -> tuple[subprocess.CompletedProcess, dict | None]:
    with tempfile.TemporaryDirectory(prefix="tsm-building-unit-") as d:
        root = Path(d)
        src = root / "input.geojson"
        out = root / "tiles"
        src.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
        proc = subprocess.run([
            sys.executable, str(MODULE_PATH), "--geojson", str(src),
            "--out-dir", str(out), "--expected-buildings", str(expected),
        ], text=True, capture_output=True)
        if proc.returncode == 0:
            validator = subprocess.run([
                sys.executable, str(MODULE_PATH.with_name("validate-building-3d-tiles.py")),
                "--tileset", str(out / "tileset.json"), "--tiles-dir", str(out),
                "--expected-buildings", str(expected), "--expected-glbs", str(expected),
            ], text=True, capture_output=True)
            assert validator.returncode == 0, (
                "Generated 3D Tiles failed production validation:\n"
                + validator.stdout + validator.stderr
            )
            tileset = json.loads((out / "tileset.json").read_text())
            manifest = json.loads((out / "manifest.json").read_text())
            report = json.loads((out / "rejected-buildings.json").read_text())
            return proc, {"tileset": tileset, "manifest": manifest, "report": report,
                          "files": sorted(x.name for x in out.glob("*.glb"))}
        report = (out / "rejected-buildings.json")
        return proc, {"report": json.loads(report.read_text())} if report.is_file() else None


def test_real_height_from_feature_and_exact_source_id_count() -> None:
    records = [sample_feature(22, height_ft=11.0), sample_feature(5, height_ft=19.5)]
    proc, result = run_builder(records, expected=2)
    assert proc.returncode == 0, proc.stderr
    assert result is not None
    assert result["files"] == ["22.glb", "5.glb"]
    children = result["tileset"]["root"]["children"]
    assert [ch["extras"]["tsm"]["sourceObjectId"] for ch in children] == [5, 22]
    assert [ch["extras"]["tsm"]["lidarHeightFt"] for ch in children] == [19.5, 11.0]
    assert all(ch["extras"]["tsm"]["heightProvenance"] == "OBSERVED" for ch in children)
    assert result["manifest"]["input"]["heightSources"]["OBSERVED"] == 2
    assert result["report"]["rejectedCount"] == 0


def test_missing_height_and_source_id_are_not_silently_skipped() -> None:
    proc, result = run_builder([sample_feature(5), sample_feature(6, height_ft=None)], expected=2)
    assert proc.returncode != 0, "missing LiDAR height must prevent 100% acceptance"
    assert result is not None
    assert result["report"]["generatedContentCount"] == 1
    assert result["report"]["rejectedCount"] == 1
    assert result["report"]["rejected"][0]["sourceObjectId"] == 6
    assert "missing validated" in result["report"]["rejected"][0]["reason"]
    proc, result = run_builder([sample_feature(5), sample_feature(5)], expected=2)
    assert proc.returncode != 0, "duplicate OBJECTIDs must never pass acceptance"
    assert result is not None
    assert "duplicate" in result["report"]["rejected"][0]["reason"]


def test_dem_gap_falls_back_to_measured_navad88_lidar_ground_only() -> None:
    observed = sample_feature(14)
    del observed["properties"]["groundElevationFt"]
    proc, result = run_builder([observed], expected=1)
    assert proc.returncode == 0, proc.stderr
    assert result is not None
    metadata = result["tileset"]["root"]["children"][0]["extras"]["tsm"]
    assert metadata["groundElevationProvenance"] == "LIDAR_GROUND_MEDIAN_NAVD88"
    assert abs(metadata["groundElevationFtNavd88"] - 382.0) < 0.005

    undatumed = sample_feature(15)
    del undatumed["properties"]["groundElevationFt"]
    undatumed["properties"]["lidarHeightDatum"] = "NGVD29"
    proc, result = run_builder([undatumed], expected=1)
    assert proc.returncode != 0
    assert result is not None
    assert result["report"]["rejectedCount"] == 1
    assert "NAVD88" in result["report"]["rejected"][0]["reason"]


def test_expected_count_rejects_incomplete_source_before_mesh_generation() -> None:
    proc, result = run_builder([sample_feature(5)], expected=2)
    assert proc.returncode != 0
    assert "source feature count 1 != 2" in proc.stderr
    assert result is None


if __name__ == "__main__":
    test_polygon_hole_and_multipolygon()
    test_real_height_from_feature_and_exact_source_id_count()
    test_missing_height_and_source_id_are_not_silently_skipped()
    test_expected_count_rejects_incomplete_source_before_mesh_generation()
    test_dem_gap_falls_back_to_measured_navad88_lidar_ground_only()
    print("building geometry and source provenance regression: PASS")
