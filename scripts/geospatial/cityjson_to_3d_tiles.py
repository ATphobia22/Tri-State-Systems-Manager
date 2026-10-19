#!/usr/bin/env python3
"""Blueprint P1.5 — CityJSON → Space graph GeoJSON → minimal 3D Tiles 1.1 tileset.

Chains citygml_compiler outputs into a DERIVED tileset shell that existing
build-building-3d-tiles / implicit builders can consume or replace content URIs.

Usage:
  python3 cityjson_to_3d_tiles.py input.city.json -o out_dir/
  python3 cityjson_to_3d_tiles.py --self-test
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from citygml_compiler import (  # noqa: E402
    compile_cityjson,
    compile_file,
    result_to_geojson,
)


def _bbox_from_features(fc: Dict[str, Any]) -> Optional[Tuple[float, float, float, float, float, float]]:
    xs: List[float] = []
    ys: List[float] = []
    zs: List[float] = []
    for f in fc.get("features") or []:
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates") or []
        rings = coords if geom.get("type") == "Polygon" else []
        for ring in rings:
            for c in ring:
                if len(c) >= 2:
                    xs.append(float(c[0]))
                    ys.append(float(c[1]))
                    zs.append(float(c[2]) if len(c) > 2 else 0.0)
    if not xs:
        return None
    return min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)


def _region_radians(west: float, south: float, east: float, north: float, zmin: float, zmax: float) -> List[float]:
    return [
        math.radians(west),
        math.radians(south),
        math.radians(east),
        math.radians(north),
        zmin,
        max(zmax, zmin + 1.0),
    ]


def build_tileset_from_geojson(fc: Dict[str, Any], content_uri: str = "buildings.geojson") -> Dict[str, Any]:
    bbox = _bbox_from_features(fc)
    if bbox is None:
        region = _region_radians(-88.1, 37.7, -87.7, 38.2, 0.0, 200.0)
        ge = 1000.0
    else:
        west, south, zmin, east, north, zmax = bbox
        region = _region_radians(west, south, east, north, zmin, zmax)
        span = max(east - west, north - south)
        ge = max(50.0, span * 111_000.0 * 0.25)

    n = len(fc.get("features") or [])
    return {
        "asset": {
            "version": "1.1",
            "tilesetVersion": "1.0.0",
            "extras": {
                "tsm": {
                    "authorityClass": "DERIVED",
                    "source": "cityjson_to_3d_tiles",
                    "featureCount": n,
                    "engineeringUse": False,
                    "regulatoryUse": False,
                }
            },
        },
        "geometricError": ge,
        "root": {
            "boundingVolume": {"region": region},
            "geometricError": ge * 0.5,
            "refine": "REPLACE",
            "content": {"uri": content_uri},
            "extras": {
                "tsmStateWordLayoutVersion": 1,
                "authorityClass": "DERIVED",
            },
        },
    }


def convert_cityjson_file(path: Path, out_dir: Path) -> Dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    result = compile_file(path, out_dir)
    fc_path = out_dir / "buildings.geojson"
    if not fc_path.is_file():
        fc = result_to_geojson(result)
        fc_path.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    else:
        fc = json.loads(fc_path.read_text(encoding="utf-8"))
    tileset = build_tileset_from_geojson(fc, content_uri="buildings.geojson")
    tileset_path = out_dir / "tileset.json"
    tileset_path.write_text(json.dumps(tileset, indent=2), encoding="utf-8")
    return {"tileset": str(tileset_path), "geojson": str(fc_path), "features": len(fc.get("features") or [])}


def self_test() -> None:
    here = Path(__file__).resolve()
    candidates = []
    if len(here.parents) > 2:
        candidates.append(here.parents[2] / "tests" / "fixtures" / "sample_building.city.json")
    if len(here.parents) > 1:
        candidates.append(here.parents[1] / "tests" / "fixtures" / "sample_building.city.json")
    candidates.append(Path("tests/fixtures/sample_building.city.json"))
    fixture = next((c for c in candidates if c.is_file()), None)
    if fixture is None:
        doc = {
            "type": "CityJSON",
            "version": "2.0",
            "transform": {"scale": [1, 1, 1], "translate": [0, 0, 0]},
            "vertices": [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
            "CityObjects": {
                "b1": {
                    "type": "Building",
                    "geometry": [{
                        "type": "Solid",
                        "lod": 2,
                        "boundaries": [[[[0, 1, 2, 3]]]],
                    }],
                    "attributes": {"measuredHeight": 10},
                }
            },
            "metadata": {"referenceSystem": "urn:ogc:def:crs:EPSG::4326"},
        }
        result = compile_cityjson(doc)
        fc = result_to_geojson(result)
        ts = build_tileset_from_geojson(fc)
        assert ts["asset"]["version"] == "1.1"
        assert ts["root"]["content"]["uri"] == "buildings.geojson"
        print("cityjson_to_3d_tiles self-test OK (inline)", result.stats)
        return
    out = Path("/tmp/cityjson_tiles_test")
    info = convert_cityjson_file(fixture, out)
    print("cityjson_to_3d_tiles self-test OK", info)


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", nargs="?", type=Path)
    p.add_argument("-o", "--out", type=Path, default=Path("out_tiles"))
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    if not args.input:
        p.error("input required unless --self-test")
    info = convert_cityjson_file(args.input, args.out)
    print(json.dumps(info))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
