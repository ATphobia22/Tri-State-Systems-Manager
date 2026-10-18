#!/usr/bin/env python3
"""TSM CityGML 3.0 / CityJSON compiler (Core + Building subset).

CityJSON 2.x is the practical encoding of a CityGML 3.0 subset.
Maps CityObjects to Space/SpaceBoundary, emits GeoJSON + state-word v1.
Full GML XML: use external citygml-tools. Not a full ADE/17-module compiler.

Usage:
  python3 citygml_compiler.py input.city.json -o out_dir/
  python3 citygml_compiler.py --self-test
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

STATE_WORD_LAYOUT_VERSION = 1
DEFAULT_STATE = {"B": 3, "D": 5, "C": 2, "T": 3, "S": 2}

SPACE_TYPES = {
    "Building", "BuildingPart", "BuildingRoom", "BuildingStorey", "BuildingUnit",
    "Bridge", "BridgeRoom", "Tunnel", "TunnelSpace", "WaterBody",
    "PlantCover", "SolitaryVegetationObject", "LandUse", "CityFurniture",
    "GenericCityObject", "Road", "Railway", "TransportSquare",
}


def encode_state_word(s: Dict[str, int]) -> int:
    return (
        (s["B"] & 0xF)
        | ((s["D"] & 0x7) << 4)
        | ((s["C"] & 0x7) << 7)
        | ((s["T"] & 0x7) << 10)
        | ((s["S"] & 0x7) << 13)
    ) & 0xFFFF


def lod_to_d_level(lod: Any) -> int:
    try:
        v = float(lod)
    except (TypeError, ValueError):
        return 2
    if v < 0.5:
        return 1
    if v < 1.5:
        return 2
    if v < 2.5:
        return 4
    return 6


@dataclass
class SpaceBoundary:
    id: str
    semantic: Optional[str]
    parent_space_id: str
    lod: Optional[str]
    coordinates: List[List[float]]


@dataclass
class Space:
    id: str
    city_object_type: str
    is_occupied: bool
    parents: List[str]
    children: List[str]
    attributes: Dict[str, Any]
    lod: Optional[str]
    footprint: Optional[List[List[float]]]
    boundaries: List[str] = field(default_factory=list)


@dataclass
class CompileResult:
    spaces: List[Space]
    boundaries: List[SpaceBoundary]
    crs: str
    cityjson_version: str
    stats: Dict[str, int]


class CityGmlCompilerError(Exception):
    pass


def _parse_crs(meta: Dict[str, Any], root: Dict[str, Any]) -> str:
    rs = None
    if isinstance(meta, dict):
        rs = meta.get("referenceSystem") or meta.get("crs")
    if not rs and isinstance(root.get("metadata"), dict):
        rs = root["metadata"].get("referenceSystem")
    if not rs:
        return "EPSG:4326"
    s = str(rs)
    if "EPSG" in s.upper():
        digits = "".join(ch if ch.isdigit() else " " for ch in s).split()
        if digits:
            return f"EPSG:{digits[-1]}"
    return s


def _apply_transform(vertex: List[float], transform: Optional[Dict[str, Any]]) -> List[float]:
    if not transform:
        return [float(vertex[0]), float(vertex[1]), float(vertex[2]) if len(vertex) > 2 else 0.0]
    scale = transform.get("scale") or [1, 1, 1]
    translate = transform.get("translate") or [0, 0, 0]
    out = []
    for i in range(3):
        v = float(vertex[i]) if i < len(vertex) else 0.0
        out.append(v * float(scale[i]) + float(translate[i]))
    return out


def _ring_from_indices(indices: List[int], vertices: List[List[float]], transform: Optional[Dict[str, Any]]) -> List[List[float]]:
    ring = []
    for idx in indices:
        if idx < 0 or idx >= len(vertices):
            raise CityGmlCompilerError(f"vertex index out of range: {idx}")
        ring.append(_apply_transform(vertices[idx], transform))
    return ring


def _extract_footprint_from_geometry(geom: Dict[str, Any], vertices: List[List[float]], transform: Optional[Dict[str, Any]]) -> Optional[List[List[float]]]:
    gtype = geom.get("type")
    boundaries = geom.get("boundaries")
    if not boundaries:
        return None
    try:
        if gtype in ("MultiSurface", "CompositeSurface"):
            return _ring_from_indices(boundaries[0][0], vertices, transform)
        if gtype == "Solid":
            return _ring_from_indices(boundaries[0][0][0], vertices, transform)
        if gtype in ("MultiSolid", "CompositeSolid"):
            return _ring_from_indices(boundaries[0][0][0][0], vertices, transform)
    except (IndexError, TypeError, CityGmlCompilerError):
        return None
    return None


def compile_cityjson(doc: Dict[str, Any]) -> CompileResult:
    if doc.get("type") != "CityJSON":
        raise CityGmlCompilerError("root type must be CityJSON")
    version = str(doc.get("version") or "")
    if not version.startswith(("1.", "2.")):
        raise CityGmlCompilerError(f"unsupported CityJSON version: {version}")

    vertices = doc.get("vertices") or []
    if not isinstance(vertices, list):
        raise CityGmlCompilerError("vertices must be an array")
    transform = doc.get("transform")
    city_objects = doc.get("CityObjects") or {}
    if not isinstance(city_objects, dict):
        raise CityGmlCompilerError("CityObjects must be an object")

    crs = _parse_crs(doc.get("metadata") or {}, doc)
    allowed = {"EPSG:4326", "EPSG:4269", "EPSG:2966", "EPSG:2968", "EPSG:3857"}

    spaces: List[Space] = []
    boundaries: List[SpaceBoundary] = []
    children_map: Dict[str, List[str]] = {k: [] for k in city_objects}

    for oid, obj in city_objects.items():
        if not isinstance(obj, dict):
            continue
        for p in obj.get("parents") or []:
            if p in children_map:
                children_map[p].append(oid)

    for oid, obj in city_objects.items():
        if not isinstance(obj, dict):
            continue
        otype = str(obj.get("type") or "GenericCityObject")
        geoms = obj.get("geometry") or []
        lod = None
        footprint = None
        if isinstance(geoms, list) and geoms and isinstance(geoms[0], dict):
            g0 = geoms[0]
            lod = str(g0.get("lod")) if g0.get("lod") is not None else None
            footprint = _extract_footprint_from_geometry(g0, vertices, transform)
            semantics = g0.get("semantics")
            if isinstance(semantics, dict):
                for s in semantics.get("surfaces") or []:
                    if not isinstance(s, dict):
                        continue
                    sem = s.get("type")
                    boundaries.append(
                        SpaceBoundary(
                            id=f"{oid}:{sem}:{len(boundaries)}",
                            semantic=str(sem) if sem else None,
                            parent_space_id=oid,
                            lod=lod,
                            coordinates=footprint or [],
                        )
                    )

        attrs = obj.get("attributes") if isinstance(obj.get("attributes"), dict) else {}
        occupied = otype not in {"BuildingRoom", "BridgeRoom", "TunnelSpace", "WaterBody"}
        spaces.append(
            Space(
                id=oid,
                city_object_type=otype,
                is_occupied=occupied,
                parents=list(obj.get("parents") or []),
                children=children_map.get(oid, []),
                attributes=attrs,
                lod=lod,
                footprint=footprint,
                boundaries=[b.id for b in boundaries if b.parent_space_id == oid],
            )
        )

    stats = {
        "spaces": len(spaces),
        "boundaries": len(boundaries),
        "vertices": len(vertices),
        "crs_allowed": 1 if crs in allowed else 0,
    }
    return CompileResult(spaces=spaces, boundaries=boundaries, crs=crs, cityjson_version=version, stats=stats)


def result_to_geojson(result: CompileResult) -> Dict[str, Any]:
    features = []
    for sp in result.spaces:
        if not sp.footprint or len(sp.footprint) < 3:
            continue
        ring = list(sp.footprint)
        if ring[0] != ring[-1]:
            ring = ring + [ring[0]]
        coords = [[c[0], c[1], c[2] if len(c) > 2 else 0.0] for c in ring]
        state = dict(DEFAULT_STATE)
        state["D"] = lod_to_d_level(sp.lod)
        if not sp.is_occupied:
            state["C"] = max(state["C"], 3)
            state["S"] = max(state["S"], 3)
        word = encode_state_word(state)
        props = {
            "id": sp.id,
            "cityObjectType": sp.city_object_type,
            "isOccupiedSpace": sp.is_occupied,
            "lod": sp.lod,
            "parents": sp.parents,
            "children": sp.children,
            "tsmStateWord": word,
            "tsmStateWordLayoutVersion": STATE_WORD_LAYOUT_VERSION,
            "tsmLod": state,
            "height_m": sp.attributes.get("measuredHeight"),
            "authorityClass": "DERIVED",
            "engineeringUse": False,
            "regulatoryUse": False,
            "source": "citygml_compiler CityJSON->Space",
        }
        features.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [coords]}, "properties": props})
    return {"type": "FeatureCollection", "crs": {"type": "name", "properties": {"name": result.crs}}, "features": features}


def result_to_space_graph(result: CompileResult) -> Dict[str, Any]:
    return {
        "schema": "tsm-citygml-space-graph-v1",
        "crs": result.crs,
        "cityjsonVersion": result.cityjson_version,
        "spaces": [asdict(s) for s in result.spaces],
        "boundaries": [asdict(b) for b in result.boundaries],
        "stats": result.stats,
    }


def compile_file(path: Path, out_dir: Path) -> CompileResult:
    doc = json.loads(path.read_text(encoding="utf-8"))
    result = compile_cityjson(doc)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "spaces.geojson").write_text(json.dumps(result_to_geojson(result), indent=2) + "\n", encoding="utf-8")
    (out_dir / "space_graph.json").write_text(json.dumps(result_to_space_graph(result), indent=2) + "\n", encoding="utf-8")
    (out_dir / "compile_report.json").write_text(
        json.dumps({"stats": result.stats, "crs": result.crs, "version": result.cityjson_version}, indent=2) + "\n",
        encoding="utf-8",
    )
    return result


def self_test(fixture: Path) -> None:
    result = compile_file(fixture, Path("/tmp/citygml-compiler-out"))
    assert result.stats["spaces"] >= 1
    assert result_to_geojson(result)["type"] == "FeatureCollection"
    print("citygml_compiler self-test OK", result.stats, result.crs)


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", nargs="?", type=Path)
    p.add_argument("-o", "--out-dir", type=Path, default=Path("citygml_out"))
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args(argv)
    try:
        if args.self_test:
            fix = Path(__file__).resolve().parents[2] / "tests/fixtures/sample_building.city.json"
            if not fix.is_file():
                fix = Path("tests/fixtures/sample_building.city.json")
            self_test(fix)
            return 0
        if not args.input:
            p.error("input required unless --self-test")
        r = compile_file(args.input, args.out_dir)
        print(json.dumps({"ok": True, "stats": r.stats, "crs": r.crs, "out": str(args.out_dir)}))
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
