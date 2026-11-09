#!/usr/bin/env python3
"""Acquire bounded Mount Vernon IGIO buildings/roads and emit integrity-bound scene.

Only source geodata: no guessed roof heights, elevations, or parcel matches.
The output is an unreviewed visualization derivative until individually validated.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BUILDINGS = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
ROADS = "https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2024/FeatureServer/0"
DEFAULT_BBOX = (-88.03, 37.87, -87.84, 38.01)  # Discovery AOI, NOT a municipal legal boundary.
MAX_IDS = 100000
BATCH = 250
MAX_RESPONSE_BYTES = 12_000_000


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")


def query(url: str, params: dict[str, object], *, max_bytes: int = MAX_RESPONSE_BYTES) -> tuple[dict, str]:
    qs = urlencode(params)
    request = Request(url + "/query?" + qs, headers={"User-Agent": "TSM-Government-Scene/1.0", "Accept": "application/json"})
    with urlopen(request, timeout=45) as response:
        # Prevent unbounded anonymous-government-service responses.
        raw = response.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError("ARCGIS_RESPONSE_TOO_LARGE")
    payload = json.loads(raw)
    if not isinstance(payload, dict) or "error" in payload:
        raise ValueError(f"ARCGIS_QUERY_FAILED: {str(payload.get('error'))[:200] if isinstance(payload, dict) else 'invalid JSON'}")
    return payload, digest(raw)


def valid_bbox(bbox: list[float] | tuple[float, ...]) -> tuple[float, float, float, float]:
    if len(bbox) != 4 or any(not math.isfinite(float(n)) for n in bbox):
        raise ValueError("BBOX_MUST_BE_FOUR_FINITE_NUMBERS")
    west, south, east, north = tuple(float(n) for n in bbox)
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("INVALID_WGS84_BBOX")
    if east - west > 0.5 or north - south > 0.5:
        raise ValueError("AOI_TOO_LARGE_FOR_CITY_SLICE")
    return west, south, east, north


def valid_geometry(geometry: object, kind: str) -> bool:
    if not isinstance(geometry, dict):
        return False
    shapes = {"building": {"Polygon", "MultiPolygon"}, "road": {"LineString", "MultiLineString"}}
    if geometry.get("type") not in shapes[kind]:
        return False
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or not coords:
        return False
    def walk(node: object) -> list[tuple[float, float]]:
        if isinstance(node, list) and len(node) >= 2 and all(isinstance(x, (float, int)) for x in node[:2]):
            return [(float(node[0]), float(node[1]))]
        if not isinstance(node, list):
            raise ValueError("INVALID_COORDINATES")
        return [point for sub in node for point in walk(sub)]
    try:
        points = walk(coords)
    except (ValueError, TypeError, OverflowError):
        return False
    return bool(points) and all(math.isfinite(x) and math.isfinite(y) and -180 <= x <= 180 and -90 <= y <= 90 for x, y in points)


def collect_layer(kind: str, service: str, bbox: tuple[float, float, float, float]) -> tuple[list[dict], dict]:
    west, south, east, north = bbox
    bounds = f"{west},{south},{east},{north}"
    common = {"geometry": bounds, "geometryType": "esriGeometryEnvelope",
              "spatialRel": "esriSpatialRelIntersects", "inSR": 4326, "where": "1=1"}
    ids_response, ids_hash = query(service, {**common, "returnIdsOnly": "true", "f": "json"})
    ids = ids_response.get("objectIds")
    if not isinstance(ids, list) or any(not isinstance(i, int) for i in ids):
        raise ValueError("ARCGIS_OBJECT_IDS_MISSING")
    ids = sorted(set(ids))
    if len(ids) > MAX_IDS:
        raise ValueError("SCENE_EXCEEDS_FEATURE_LIMIT")
    provenance_batches = [ids_hash]
    seen: set[int] = set()
    results = []
    for start in range(0, len(ids), BATCH):
        subset = ids[start:start + BATCH]
        response, response_hash = query(service, {
            "objectIds": ",".join(str(i) for i in subset),
            "outFields": "*", "outSR": 4326, "returnGeometry": "true", "f": "geojson",
        })
        provenance_batches.append(response_hash)
        if response.get("type") != "FeatureCollection" or not isinstance(response.get("features"), list):
            raise ValueError("ARCGIS_GEOJSON_NOT_A_FEATURE_COLLECTION")
        for feature in response["features"]:
            if not isinstance(feature, dict):
                raise ValueError("INVALID_ARCGIS_FEATURE")
            props = feature.get("properties")
            if not isinstance(props, dict):
                raise ValueError("ARCGIS_ATTRIBUTES_MISSING")
            raw_oid = props.get("objectid", props.get("OBJECTID"))
            if isinstance(raw_oid, bool) or not isinstance(raw_oid, int):
                raise ValueError("ARCGIS_STABLE_OBJECTID_MISSING")
            if raw_oid not in subset or raw_oid in seen:
                raise ValueError("ARCGIS_OBJECTID_MISMATCH_OR_DUPLICATE")
            if not valid_geometry(feature.get("geometry"), kind):
                raise ValueError("ARCGIS_GEOMETRY_MISSING_OR_INVALID")
            seen.add(raw_oid)
            identity = f"IGIO:{kind}:{raw_oid}"
            source_hash = digest(canonical(feature))
            name = props.get("st_name", props.get("ST_NAME")) if kind == "road" else None
            results.append({
                "type": "Feature", "id": identity, "geometry": feature["geometry"],
                "properties": {
                    "tsm_id": identity,
                    "source_objectid": raw_oid,
                    "kind": kind,
                    "name": str(name)[:180] if name is not None else None,
                    "height_m": None, "height_status": "NOT_EVIDENCED",
                    "source_url": service, "source_feature_sha256": source_hash,
                    "evidence_status": "SOURCE_OBSERVED_UNREVIEWED",
                    "engineering_approved": False,
                },
            })
    if len(seen) != len(ids):
        raise ValueError(f"ARCGIS_INCOMPLETE_DOWNLOAD_EXPECTED_{len(ids)}_GOT_{len(seen)}")
    return sorted(results, key=lambda x: x["properties"]["source_objectid"]), {
        "agency": "Indiana Geographic Information Office",
        "dataset": "Indiana Building Footprints 2016-2020" if kind == "building" else "Indiana Road Centerlines 2024",
        "layer_url": service, "layer_id": 0, "source_object_count": len(ids),
        "raw_response_sha256": provenance_batches,
        "source_crs": "EPSG:3857" if kind == "building" else "EPSG:26916",
        "output_crs": "EPSG:4326",
        "acquisition_date": "2016-2020" if kind == "building" else "2024",
        "vertical_datum": "NOT_APPLICABLE_2D",
        "approval": "NOT_EVIDENCED",
    }


def build_scene(bbox: tuple[float, float, float, float], build: tuple[list[dict], dict], road: tuple[list[dict], dict]) -> dict:
    return {
        "schema": "tsm.mount-vernon-city-scene.v1",
        "scene_name": "Mount Vernon, Indiana — governmental planimetric context",
        "aoi_bbox_wgs84": list(bbox),
        "crs": "EPSG:4326", "vertical_datum": "NOT_ESTABLISHED_FOR_GEOMETRY",
        "accuracy_claim": "REFERENCE_ONLY_NOT_SURVEY_OR_ENGINEERING",
        "terrain": {"status": "EXTERNAL_EXISTING_TSM_TERRAIN_LAYER", "height_datum": "MUST_BE_VERIFIED_SEPARATELY"},
        "sources": {"buildings": build[1], "roads": road[1]},
        "buildings": {"type": "FeatureCollection", "features": build[0]},
        "roads": {"type": "FeatureCollection", "features": road[0]},
    }


def write_scene(scene: dict, destination: Path) -> tuple[Path, Path]:
    destination.mkdir(parents=True, exist_ok=True)
    payload = canonical(scene)
    scene_file = destination / "scene.json"
    receipt_file = destination / "scene.receipt.json"
    # Write receipt AFTER full scene data. No false cryptographic claim for server responses.
    scene_file.write_bytes(payload)
    receipt = {
        "schema": "tsm.mount-vernon-city-receipt.v1",
        "scene_path": "./scene.json",
        "sha256": digest(payload),
        "byte_length": len(payload),
        "feature_counts": {"buildings": len(scene["buildings"]["features"]), "roads": len(scene["roads"]["features"])},
        "review": "NOT_EVIDENCED",
        "regulatory_approval": False,
    }
    receipt_file.write_bytes(canonical(receipt))
    return scene_file, receipt_file


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bbox", nargs=4, type=float, default=DEFAULT_BBOX, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parser.add_argument("--output", type=Path, default=Path("tsm-console/public/mount-vernon-scene"))
    args = parser.parse_args()
    bbox = valid_bbox(args.bbox)
    buildings = collect_layer("building", BUILDINGS, bbox)
    roads = collect_layer("road", ROADS, bbox)
    paths = write_scene(build_scene(bbox, buildings, roads), args.output)
    print(json.dumps({"files": [str(p) for p in paths], "buildings": len(buildings[0]), "roads": len(roads[0]),
                      "source_status": "OBSERVED_UNREVIEWED", "engineering_use": False}))


if __name__ == "__main__":
    main()
