#!/usr/bin/env python3
"""Reconcile Posey buildings with Indiana GIO's real 2016-2020 DEM tile polygons.

The official source is layer 0:
https://gisdata.in.gov/server/rest/services/Hosted/Indiana_DEM_Tile_Footprints/FeatureServer/0

Accepts separately downloaded GeoJSON data (request with outSR=4326). No
remote requests, no guessing filenames, no elevation inference or certification.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

EXPECTED_POSEY_BUILDINGS = 23082
SOURCE_URL = ("https://gisdata.in.gov/server/rest/services/Hosted/"
              "Indiana_DEM_Tile_Footprints/FeatureServer/0")
MAX_BYTES = 220 * 1024 * 1024
FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.tif$", re.I)


def read_source(path: Path) -> tuple[dict, str]:
    if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_BYTES:
        raise ValueError("missing, symlinked or oversized source GeoJSON")
    payload = path.read_bytes()
    document = json.loads(payload)
    if (not isinstance(document, dict) or document.get("type") != "FeatureCollection"
            or not isinstance(document.get("features"), list)):
        raise ValueError("input is not a GeoJSON FeatureCollection")
    crs = document.get("crs")
    if crs is not None and crs not in ({"type":"name","properties":{"name":"EPSG:4326"}},
                                       {"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}}):
        raise ValueError("provide GeoJSON explicitly exported to WGS84 lon/lat")
    return document, hashlib.sha256(payload).hexdigest()


def _props(feature: dict) -> dict:
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        raise ValueError("malformed GeoJSON feature")
    p = feature.get("properties")
    if not isinstance(p, dict):
        raise ValueError("missing source properties")
    return {str(k).lower(): v for k,v in p.items()}


def _geom(feature: dict):
    geom = shape(feature.get("geometry"))
    if (geom.geom_type not in ("Polygon", "MultiPolygon") or not geom.is_valid
            or geom.is_empty or geom.area <= 0 or
            any(not math.isfinite(v) for v in geom.bounds)):
        raise ValueError("invalid polygon in authoritative source")
    x1,y1,x2,y2 = geom.bounds
    if not (-90.5 < x1 < -86 and -90.5 < x2 < -86
            and 36 < y1 < 40 and 36 < y2 < 40):
        raise ValueError("source is not southwest Indiana lon/lat")
    return geom


def reconcile(buildings: dict, tiles: dict, expected_count: int=EXPECTED_POSEY_BUILDINGS) -> dict:
    features = buildings["features"]
    if (type(expected_count) is not int or expected_count < 1
            or len(features) != expected_count):
        raise ValueError("building inventory cardinality mismatch")
    tile_geoms, tile_names = [], []
    for row in tiles["features"]:
        p = _props(row)
        if str(p.get("county","")).strip().casefold() != "posey" or str(p.get("image_year")) != "2020":
            continue
        name = p.get("filename")
        if not isinstance(name, str) or not FILENAME.fullmatch(name) or name in (".",".."):
            raise ValueError("unsafe or missing GIO source filename")
        geom = _geom(row)
        tile_geoms.append(geom)
        tile_names.append(name)
    if not tile_geoms:
        raise ValueError("GIO tile-footprint export lacks 2020 Posey County tiles")
    index = STRtree(tile_geoms)
    idset, required_tiles, uncovered, unlinked = set(), set(), [], []
    for row in features:
        p = _props(row)
        oid = p.get("igioobjectid")
        if type(oid) is not int or oid < 0 or oid in idset:
            raise ValueError("missing or duplicate building igioObjectId")
        idset.add(oid)
        geom = _geom(row)
        matches = index.query(geom, predicate="intersects")
        if len(matches) == 0:
            uncovered.append(oid)
            unlinked.append(oid)
            continue
        geometries = [tile_geoms[int(i)] for i in matches]
        for i in matches:
            required_tiles.add(tile_names[int(i)])
        remaining = geom.difference(unary_union(geometries))
        if not remaining.is_empty and remaining.area > max(geom.area*1e-8,1e-14):
            uncovered.append(oid)
    return {
        "schemaVersion": "tsm.posey-official-dem-tiles.v1",
        "sourceService": SOURCE_URL,
        "sourceLayer": 0,
        "sourceYear": 2020,
        "county": "Posey",
        "sourceFootprintRows": len(tile_geoms),
        "authoritativeBuildingCount": len(idset),
        "requiredFilenameCount": len(required_tiles),
        "requiredFilenames": sorted(required_tiles),
        "buildingsWithoutCompletePolygonCoverage": len(uncovered),
        "uncoveredObjectIds": sorted(uncovered),
        "buildingsWithNoTileIntersection": len(unlinked),
        "polygonCoverageVerified": len(uncovered)==0,
        "rasterPixelsVerified": False,
        "verticalDatumVerified": False,
        "buildingHeightsVerified": False,
        "regulatoryApproved": False,
        "warnings": [
            "Intersecting authoritative footprints is not a raster value or nodata audit.",
            "The DEM is bare-earth and does not establish building roof elevations.",
            "Tile filenames and URL paths are metadata only; no remote content is trusted.",
        ]
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--buildings", type=Path, required=True)
    ap.add_argument("--tile-footprints", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--expected-buildings", type=int, default=EXPECTED_POSEY_BUILDINGS)
    ap.add_argument("--require-covered", action="store_true")
    a = ap.parse_args()
    try:
        if (a.output.exists() or a.output.resolve() == a.buildings.resolve()
                or a.output.resolve() == a.tile_footprints.resolve()):
            raise ValueError("refusing to overwrite existing evidence")
        b, bh = read_source(a.buildings)
        t, th = read_source(a.tile_footprints)
        result = reconcile(b,t,a.expected_buildings)
        result["buildingInputSha256"] = bh
        result["tileFootprintsInputSha256"] = th
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
        print(json.dumps({"tileCount":result["requiredFilenameCount"],
                          "uncovered":result["buildingsWithoutCompletePolygonCoverage"]}))
        return 2 if a.require_covered and not result["polygonCoverageVerified"] else 0
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("Source tile-footprint audit rejected: "+str(exc))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
