#!/usr/bin/env python3
"""Join Posey parcel context to local CRS84 reference snapshots."""

import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path

from shapely.geometry import shape
from shapely.strtree import STRtree


def load(path):
    raw = path.read_bytes()
    doc = json.loads(raw)
    crs = doc.get("crs", {}).get("properties", {}).get("name")
    if doc.get("type") != "FeatureCollection" or crs not in (
            None, "urn:ogc:def:crs:OGC:1.3:CRS84", "urn:ogc:def:crs:OGC::CRS84", "EPSG:4326",
            "urn:ogc:def:crs:EPSG::4326"):
        raise ValueError(f"{path.name}: expected a CRS84 GeoJSON FeatureCollection")
    return doc["features"], sha256(raw).hexdigest()


def geometry(feature, kinds):
    value = shape(feature["geometry"])
    if value.is_empty or not value.is_valid or value.geom_type not in kinds:
        raise ValueError("Invalid source geometry")
    west, south, east, north = value.bounds
    if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
        raise ValueError("Source geometry requires longitude and latitude in degrees")
    return value


def contexts(parcels, wells, overlays):
    ids = [p["properties"]["objectid"] for p in parcels]
    if any(type(key) is not int for key in ids) or len(ids) != len(set(ids)):
        raise ValueError("Parcel geometry records require unique source object IDs")
    usable, excluded = [], set()
    polygons, excluded_extents = [], []
    for key, parcel in zip(ids, parcels):
        if parcel["properties"].get("county_fips") != "18129":
            raise ValueError("Only Posey County parcel records are supported")
        try:
            polygon = geometry(parcel, {"Polygon", "MultiPolygon"})
        except ValueError:
            excluded.add(key)
            if parcel["geometry"] is not None:
                excluded_extents.append(shape(parcel["geometry"]).envelope)
            continue
        usable.append(key)
        polygons.append(polygon)
    tree, excluded_tree = STRtree(polygons), STRtree(excluded_extents)
    matches, method_counts = defaultdict(list), Counter()
    seen = set()
    for well in wells:
        p = well["properties"]
        object_id = p["objectid"]
        if type(object_id) is not int or object_id in seen or p["strcounty"].strip().upper() != "POSEY":
            raise ValueError("Invalid or duplicate IDNR Posey record")
        seen.add(object_id)
        if p.get("location_quality") != "field-located":
            method_counts["APPROXIMATE_OR_UNKNOWN_NOT_ASSIGNED"] += 1
            continue
        if well["geometry"] is None:
            method_counts["NO_GEOMETRY"] += 1
            continue
        point = geometry(well, {"Point"})
        if len(excluded_tree.query(point, predicate="intersects")):
            method_counts["NEAR_INVALID_PARCEL_GEOMETRY"] += 1
            continue
        candidates = tree.query(point, predicate="intersects")
        if len(candidates) != 1 or not polygons[candidates[0]].contains(point):
            method_counts["BOUNDARY_OR_OVERLAP" if len(candidates) else "NO_PARCEL_MATCH"] += 1
            continue
        ref = p.get("dblrefno")
        matches[usable[candidates[0]]].append({"sourceObjectId": object_id, "wellRecordNumber": ref,
                                          "relation": "FIELD_LOCATED_POINT_INSIDE_PARCEL"})
        method_counts["FIELD_LOCATED_POINT_INSIDE_PARCEL"] += 1

    rows = {key: {"parcelObjectId": key, "stateParcelId": parcel["properties"].get("state_parcel_id"),
                  "geometryStatus": "INVALID_OR_MISSING" if key in excluded else "VALID",
                  "sourceWellReferences": matches[key]} for key, parcel in zip(ids, parcels)}
    excluded_overlays = {}
    for name, features, field in overlays:
        found, uncertain = defaultdict(set), set()
        rejected = 0
        if features is not None:
            for feature in features:
                try:
                    polygon = geometry(feature, {"Polygon", "MultiPolygon"})
                except ValueError:
                    rejected += 1
                    if feature["geometry"] is None:
                        uncertain.update(usable)
                    else:
                        envelope = shape(feature["geometry"]).envelope
                        uncertain.update(usable[i] for i in tree.query(envelope, predicate="intersects"))
                    continue
                source_id = feature["properties"][field]
                if type(source_id) not in (str, int) or not str(source_id).strip():
                    raise ValueError(f"{name}: invalid source ID")
                for index in tree.query(polygon, predicate="intersects"):
                    if polygon.intersection(polygons[index]).area > 0:
                        found[usable[index]].add(str(source_id))
        excluded_overlays[name] = rejected if features is not None else None
        for key in ids:
            keys = sorted(found[key])
            rows[key][name] = {
                "status": ("SOURCE_UNAVAILABLE" if features is None else
                           "PARCEL_GEOMETRY_UNAVAILABLE" if key in excluded else
                           "INCOMPLETE_GEOMETRY_COVERAGE" if key in uncertain else
                           "GEOMETRY_OVERLAP" if keys else "NO_OVERLAP_IN_SUPPLIED_SNAPSHOT"),
                "sourceIds": keys,
            }
    return {"excludedParcelGeometries": len(excluded), "excludedOverlayGeometries": excluded_overlays,
            "wellCounts": dict(method_counts), "parcels": [rows[key] for key in sorted(ids)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parcels", type=Path, required=True)
    parser.add_argument("--wells", type=Path, required=True)
    parser.add_argument("--soils", type=Path, help="Official SSURGO map unit polygons with mukey")
    parser.add_argument("--controls", type=Path, help="IDEM institutional control polygons")
    parser.add_argument("--control-id-field", default="objectid")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    parcels, parcel_sha = load(args.parcels)
    wells, well_sha = load(args.wells)
    receipt = json.loads(args.wells.with_suffix(".receipt.json").read_bytes())
    if receipt.get("sha256") != well_sha or receipt.get("feature_count") != len(wells):
        raise ValueError("IDNR snapshot does not match its acquisition receipt")
    soils, soil_sha = load(args.soils) if args.soils else (None, None)
    controls, control_sha = load(args.controls) if args.controls else (None, None)
    output = contexts(parcels, wells, [("soilMapUnits", soils, "mukey"),
                                        ("institutionalControls", controls, args.control_id_field)])
    output.update(schema="tsm-posey-subsurface-context-v1", engineeringUse=False, regulatoryUse=False,
                  sourceSha256={"parcels": parcel_sha, "idnrWells": well_sha,
                                "soils": soil_sha, "controls": control_sha})
    with args.out.open("x", encoding="utf-8") as stream:
        json.dump(output, stream, allow_nan=False, separators=(",", ":"))
        stream.write("\n")


if __name__ == "__main__":
    main()
