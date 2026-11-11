#!/usr/bin/env python3
"""CityJSON → evidence-first 3D Tiles staging, NOT an automatic renderable tileset.

The previous implementation advertised a .geojson file as OGC 3D Tiles 1.1
renderable tile content and treated raw Z as ellipsoidal height. GeoJSON is
an intermediate footprint representation, not glTF/GLB tile content. Until
actual geometry, CRS, units, datum and placement are independently validated,
write a candidate manifest rather than a misleading tileset.json.

Usage: python scripts/geospatial/cityjson_to_3d_tiles.py input.city.json -o out/
       python scripts/geospatial/cityjson_to_3d_tiles.py --self-test
"""

from __future__ import annotations

import argparse
import hashlib
import json
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


def build_candidate_manifest(fc: Dict[str, Any]) -> Dict[str, Any]:
    """Stage data for a *future* 3D Tiles build. This is not a tileset.

    Never interpret raw projected X/Y as longitude/latitude or NAVD88 Z as
    ellipsoidal height. The actual GLB, source-to-ECEF transformation, datum
    provenance, geometric error and material inputs require separate gates.
    """
    if fc.get("type") != "FeatureCollection":
        raise ValueError("Expected GeoJSON FeatureCollection")
    features = fc.get("features")
    if not isinstance(features, list):
        raise ValueError("GeoJSON features must be an array")
    geo_crs = (fc.get("crs") or {}).get("properties") or {}
    source_crs = geo_crs.get("name")
    bbox = _bbox_from_features(fc)
    ids = [str((f.get("properties") or {}).get("id") or "")
           for f in features if isinstance(f, dict)]
    lods: Dict[str, int] = {}
    for f in features:
        lod = str((f.get("properties") or {}).get("lod") or "UNKNOWN")
        lods[lod] = lods.get(lod, 0) + 1
    canonical_geojson = json.dumps(fc, separators=(",", ":"), sort_keys=True,
                                   ensure_ascii=True, allow_nan=False).encode("utf-8")
    return {
        "schema": "tsm.geospatial.cityjson-tiles-candidate.v1",
        "authorityClass": "DERIVED",
        "renderable": False,
        "regulatoryUse": False,
        "engineeringUse": False,
        "sourceCrs": source_crs,
        "sourceGeojsonSha256": hashlib.sha256(canonical_geojson).hexdigest(),
        "sourceFeatureCount": len(features),
        "sourceIdCount": len({identifier for identifier in ids if identifier}),
        "lodCounts": dict(sorted(lods.items())),
        "rawInputBounds": list(bbox) if bbox is not None else None,
        "geodeticPlacementVerified": False,
        "verticalDatumVerified": False,
        "lengthUnitsVerified": False,
        "geometryExported": False,
        "materialsVerified": False,
        "renderableContentUri": None,
        "requiredNextGates": [
            "IFC/CityJSON identity and geometry topology",
            "horizontal CRS and explicit transformation to WGS84/ECEF",
            "source vertical datum and geoid-backed height transformation",
            "verified linear units and reference control points",
            "actual glTF/GLB mesh export with source metadata",
            "OGC 3D Tiles 1.1 validation and headed rendering",
        ],
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
    candidate = build_candidate_manifest(fc)
    candidate["sourceCityjsonSha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    candidate_path = out_dir / "tileset-candidate.json"
    candidate_path.write_text(json.dumps(candidate, indent=2, sort_keys=True) + "\\n", encoding="utf-8")
    return {"tileset": None, "candidate": str(candidate_path),
            "geojson": str(fc_path), "features": len(fc.get("features") or []),
            "renderable": False}


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
        ts = build_candidate_manifest(fc)
        assert ts["renderable"] is False
        assert ts["renderableContentUri"] is None
        assert "root" not in ts
        print("cityjson_to_3d_tiles self-test OK (inline)", result.stats)
        return
    out = Path("/tmp/cityjson_tiles_test")
    info = convert_cityjson_file(fixture, out)
    assert info["renderable"] is False
    assert not (out / "tileset.json").exists()
    print("cityjson_to_3d_tiles candidate self-test OK", info)


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
