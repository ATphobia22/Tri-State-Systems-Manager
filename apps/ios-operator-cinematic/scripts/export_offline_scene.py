#!/usr/bin/env python3
"""Convert a supplied EPSG:2966 GeoJSON footprint file into bounded iOS display tiles.

All input GIS evidence must be independently verified; no coordinate transformation
other than the EXACT US-survey-foot -> metre scaling is performed. Tiles are
rectangular bbox previews, NOT full-footprint LoD2/LoD3 building reconstructions.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

FOOT_TO_M = 1200 / 3937  # US survey foot, exact
MAX_TILE = 6000


def points_of_geometry(geometry):
    t = geometry.get("type")
    coords = geometry.get("coordinates", [])
    if t == "Polygon":
        rings = coords
    elif t == "MultiPolygon":
        rings = [ring for polygon in coords for ring in polygon]
    else:
        return []
    return [p for ring in rings for p in ring if isinstance(p, list) and len(p) >= 2]


def convert_features(raw, height_field, origin_e, origin_n):
    result = []
    skipped = {"missing_height": 0, "invalid_geometry": 0, "duplicate_id": 0}
    seen = set()
    for feature in raw.get("features", []):
        props = feature.get("properties") or {}
        name = props.get("source_id") or feature.get("id")
        if name is None or not str(name).strip():
            skipped["invalid_geometry"] += 1
            continue
        name = str(name)
        if name in seen:
            skipped["duplicate_id"] += 1
            continue
        seen.add(name)
        try:
            height = float(props[height_field])
            if not math.isfinite(height) or not 0 < height <= 2000:
                raise ValueError()
        except (KeyError, TypeError, ValueError):
            skipped["missing_height"] += 1
            continue
        points = points_of_geometry(feature.get("geometry") or {})
        try:
            xy = [(float(p[0]), float(p[1])) for p in points]
            if not xy or not all(math.isfinite(x) and math.isfinite(y) for x, y in xy):
                raise ValueError()
            e0, e1 = min(p[0] for p in xy), max(p[0] for p in xy)
            n0, n1 = min(p[1] for p in xy), max(p[1] for p in xy)
            east = ((e0 + e1) * 0.5 - origin_e) * FOOT_TO_M
            north = ((n0 + n1) * 0.5 - origin_n) * FOOT_TO_M
            width, depth = (e1-e0)*FOOT_TO_M, (n1-n0)*FOOT_TO_M
            if (width <= 0 or depth <= 0 or width > 1000 or depth > 1000
                    or abs(east) > 50000 or abs(north) > 50000):
                raise ValueError()
            # No source terrain/BFE is silently assigned: zero is a local
            # visualization base, intentionally NOT an elevation.
            result.append({"id": name, "eastMeters": east, "northMeters": north,
                           "baseMeters": 0.0, "widthMeters": width,
                           "depthMeters": depth, "heightMeters": height * FOOT_TO_M,
                           "rotationDegrees": 0.0})
        except ValueError:
            skipped["invalid_geometry"] += 1
    return result, skipped


def export(source, output, height_field, origin_e, origin_n, authority):
    if not math.isfinite(origin_e) or not math.isfinite(origin_n):
        raise ValueError("source origin must be finite")
    src = Path(source)
    data = src.read_bytes()
    source_sha = hashlib.sha256(data).hexdigest()
    raw = json.loads(data)
    if raw.get("type") != "FeatureCollection":
        raise ValueError("source must be GeoJSON FeatureCollection")
    # GeoJSON has no reliable automatic embedded projection. Operator explicitly
    # attests original EPSG:2966 US-ft and must retain that external evidence.
    features, skipped = convert_features(raw, height_field, origin_e, origin_n)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    names = []
    acquired_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for offset in range(0, len(features), MAX_TILE):
        batch = features[offset:offset + MAX_TILE]
        index = offset // MAX_TILE
        payload = {"schema": "tsm.ios.scene.v1", "datasetID": f"{src.stem}-tile-{index:03d}",
                   "title": f"Building footprint bbox preview: {src.stem} / {index}",
                   "authority": authority, "horizontalCRS": "EPSG:2966",
                   "verticalDatum": "UNVERIFIED",
                   "sourceSHA256": source_sha,
                   "transformReceipt": "Declared EPSG:2966 US-ft; offsets relative to origin multiplied by exact 1200/3937; rectangles are source footprint BBOX; height from " + height_field + " US-ft; zero base is local visual placeholder, NOT NAVD88",
                   "originEastFeet": origin_e, "originNorthFeet": origin_n,
                   "acquiredAt": acquired_at, "buildings": batch}
        encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=True,
                             allow_nan=False, sort_keys=True).encode("utf-8")
        envelope = {"schema": "tsm.ios.envelope.v1",
                    "payloadBase64": base64.b64encode(encoded).decode("ascii"),
                    "payloadSHA256": hashlib.sha256(encoded).hexdigest()}
        name = f"{src.stem}-{index:03d}.tsm-scene.json"
        (output / name).write_text(json.dumps(envelope, separators=(",", ":")))
        names.append({"path": name, "count": len(batch),
                      "payload_sha256": envelope["payloadSHA256"]})
    inventory = {"source": str(src.name), "sourceSHA256": source_sha,
                 "sourceCRSoperatorDeclared": "EPSG:2966", "sourceCoordinates": "US survey foot",
                 "sourceHeightFieldUSft": height_field, "totalFeaturesInput": len(raw.get("features", [])),
                 "included": len(features), "skipped": skipped, "tiles": names,
                 "status": "UNREVIEWED_PRESENTATION_ONLY"}
    (output / "scene-inventory.json").write_text(json.dumps(inventory, indent=2))
    return inventory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("geojson", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--height-field", required=True,
                        help="source property in US survey feet; no fallback heights")
    parser.add_argument("--origin-easting-usft", required=True, type=float)
    parser.add_argument("--origin-northing-usft", required=True, type=float)
    parser.add_argument("--authority", required=True)
    args = parser.parse_args()
    inventory = export(args.geojson, args.output, args.height_field,
                       args.origin_easting_usft, args.origin_northing_usft,
                       args.authority)
    print(json.dumps(inventory, indent=2))

if __name__ == "__main__":
    main()
