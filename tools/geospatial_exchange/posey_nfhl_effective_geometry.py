#!/usr/bin/env python3
"""Bounded FEMA-effective Posey NFHL geometry capture and offline parcel review.

No network access for verify/screen. The acquire command explicitly retrieves
FEMA's current layer 3 and 28 GeoJSON by exact county DFIRM_ID, validates OID
counts, and stores SHA-256-receipted chunks. This is not a LOMA determination.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

BASE = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer"
ALTERNATE_BASE = "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer"
DFIRM = "18129C"
LAYERS = {"firm_panels": 3, "flood_hazard_zones": 28}
REQUIRED_FIELDS = {
    "firm_panels": {"OBJECTID", "DFIRM_ID", "FIRM_PAN", "EFF_DATE"},
    "flood_hazard_zones": {"OBJECTID", "DFIRM_ID", "FLD_ZONE", "SFHA_TF"},
}
MAX_REPLY = 32 * 1024 * 1024
MAX_FEATURES = 10000
SNAPSHOT_SCHEMA = "tsm.posey.fema-effective-geometry.v1"


class EvidenceError(ValueError):
    """A source cannot be trusted for the intended inference."""


def insist(ok: bool, reason: str) -> None:
    if not ok:
        raise EvidenceError(reason)


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def encoded(value: dict) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"),
                       sort_keys=True, allow_nan=False) + "\n").encode("utf-8")


def get_json(url: str, params: dict) -> dict:
    insist(url.startswith(BASE + "/"), "Unexpected FEMA endpoint")
    suffix = url[len(BASE):] + "?" + urlencode(params)
    for base in (BASE, ALTERNATE_BASE, BASE):
        try:
            return read_json(base + suffix)
        except HTTPError as exc:
            if exc.code != 429 and not 500 <= exc.code <= 599:
                raise
            last_error = exc
        except (URLError, TimeoutError, ConnectionError) as exc:
            last_error = exc
    raise EvidenceError("FEMA transport unavailable on both official routes") from last_error


def read_json(address: str) -> dict:
    req = Request(address, headers={
        "Accept": "application/json", "User-Agent": "TSM-Posey-NFHL-evidence/1.0"
    })
    with urlopen(req, timeout=45) as response:
        redirect = urlsplit(response.geturl())
        insist(redirect.scheme == "https" and redirect.hostname == "hazards.fema.gov",
               "Unexpected FEMA redirect host")
        raw = response.read(MAX_REPLY + 1)
    insist(0 < len(raw) <= MAX_REPLY, "Missing or excessive FEMA response")
    try:
        data = json.loads(raw)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise EvidenceError("Invalid FEMA JSON") from exc
    insist(isinstance(data, dict) and "error" not in data,
           "FEMA service error")
    return data


def acquire_layer(name: str, out: Path, fetch=get_json, page_size: int = 10) -> dict:
    insist(name in LAYERS, "Unregistered effective source layer")
    insist(type(page_size) is int and 1 <= page_size <= 50, "Invalid page limit")
    insist(not out.exists(), "Output directory already exists; no overwrite")
    lid = LAYERS[name]
    root = BASE + f"/{lid}"
    meta = fetch(root, {"f": "pjson"})
    available = {field.get("name") for field in meta.get("fields", [])}
    insist(meta.get("id") == lid and meta.get("geometryType") == "esriGeometryPolygon"
           and REQUIRED_FIELDS[name].issubset(available),
           f"Unexpected FEMA {name} schema")
    where = f"DFIRM_ID='{DFIRM}'"
    query = root + "/query"
    count_response = fetch(query, {"where": where, "returnCountOnly": "true", "f": "json"})
    inventory = fetch(query, {"where": where, "returnIdsOnly": "true", "f": "json"})
    ids = inventory.get("objectIds")
    count = count_response.get("count")
    insist(isinstance(ids, list) and all(type(v) is int for v in ids)
           and len(ids) == len(set(ids)) and 0 < len(ids) <= MAX_FEATURES
           and type(count) is int and count == len(ids),
           f"{name}: FEMA OID count mismatch or invalid inventory")
    expected_ids = sorted(ids)
    out.mkdir(parents=True)
    chunks = []
    for start in range(0, len(expected_ids), page_size):
        batch = expected_ids[start:start + page_size]
        response = fetch(query, {
            "objectIds": ",".join(str(x) for x in batch),
            "where": where,
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
        })
        features = response.get("features")
        insist(response.get("type") == "FeatureCollection" and isinstance(features, list)
               and response.get("exceededTransferLimit") is not True,
               f"{name}: invalid/truncated GeoJSON chunk")
        returned = set()
        for feature in features:
            props = feature.get("properties") or {}
            oid = props.get("OBJECTID")
            insist(type(oid) is int and oid in batch and oid not in returned
                   and props.get("DFIRM_ID") == DFIRM,
                   f"{name}: duplicate, mismatched or out-of-county OBJECTID")
            insist(REQUIRED_FIELDS[name].issubset(props),
                   f"{name}: required GeoJSON attributes missing")
            insist((feature.get("geometry") or {}).get("type") in ("Polygon", "MultiPolygon"),
                   f"{name}: missing or non-polygon FEMA geometry")
            returned.add(oid)
        insist(returned == set(batch), f"{name}: incomplete OID response")
        raw = encoded({"type": "FeatureCollection", "features": features})
        filename = f"features-{start // page_size:04d}.geojson"
        (out / filename).write_bytes(raw)
        chunks.append({"file": filename, "sha256": digest(raw), "bytes": len(raw),
                       "count": len(features), "objectIds": batch})
    manifest = {
        "schema": SNAPSHOT_SCHEMA,
        "dataStatus": "ACQUIRED_FEMA_UNREVIEWED",
        "authority": "FEMA",
        "service": BASE,
        "countyDfirmId": DFIRM,
        "layerName": name,
        "layerId": lid,
        "query": where,
        "sourceSpatialReferenceWkid": (meta.get("sourceSpatialReference") or {}).get("wkid"),
        "exportCrs": "OGC:CRS84 (GeoJSON longitude,latitude)",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "objectIdCount": len(expected_ids),
        "featureCount": sum(chunk["count"] for chunk in chunks),
        "objectIdsSha256": digest(encoded(expected_ids)),
        "chunks": chunks,
        "scientificCertification": False,
        "regulatoryDetermination": False,
    }
    (out / "manifest.json").write_bytes(encoded(manifest))
    return manifest


def load_layer(out: Path, name: str) -> tuple[list, dict, str]:
    insist(name in LAYERS and out.is_dir() and not out.is_symlink(),
           f"{name}: missing source directory")
    manifest_path = out / "manifest.json"
    insist(manifest_path.is_file() and not manifest_path.is_symlink(), "Missing source manifest")
    raw = manifest_path.read_bytes()
    metadata = json.loads(raw)
    insist(metadata.get("schema") == SNAPSHOT_SCHEMA
           and metadata.get("dataStatus") == "ACQUIRED_FEMA_UNREVIEWED"
           and metadata.get("authority") == "FEMA" and metadata.get("service") == BASE
           and metadata.get("countyDfirmId") == DFIRM
           and metadata.get("layerName") == name and metadata.get("layerId") == LAYERS[name]
           and metadata.get("query") == f"DFIRM_ID='{DFIRM}'"
           and metadata.get("exportCrs") == "OGC:CRS84 (GeoJSON longitude,latitude)"
           and metadata.get("scientificCertification") is False
           and metadata.get("regulatoryDetermination") is False,
           f"{name}: unexpected or overstated FEMA acquisition receipt")
    chunks = metadata.get("chunks")
    insist(isinstance(chunks, list) and chunks, "Empty FEMA chunk inventory")
    features, object_ids = [], []
    for i, entry in enumerate(chunks):
        name_file = f"features-{i:04d}.geojson"
        insist(entry.get("file") == name_file and type(entry.get("count")) is int
               and 0 < entry["count"] <= 50, "Unsafe chunk receipt")
        path = out / name_file
        insist(path.is_file() and not path.is_symlink(), "Missing or symlinked FEMA chunk")
        payload = path.read_bytes()
        insist(digest(payload) == entry.get("sha256")
               and len(payload) == entry.get("bytes"), "FEMA chunk SHA-256 mismatch")
        chunk = json.loads(payload)
        rows = chunk.get("features")
        insist(chunk.get("type") == "FeatureCollection"
               and isinstance(rows, list) and len(rows) == entry["count"],
               "FEMA chunk count discrepancy")
        oids = []
        for feature in rows:
            props = feature.get("properties") or {}
            oid = props.get("OBJECTID")
            insist(type(oid) is int and props.get("DFIRM_ID") == DFIRM
                   and REQUIRED_FIELDS[name].issubset(props)
                   and (feature.get("geometry") or {}).get("type") in ("Polygon", "MultiPolygon"),
                   "FEMA source GeoJSON changed or contains invalid properties")
            oids.append(oid)
        insist(oids == entry.get("objectIds") or sorted(oids) == entry.get("objectIds"),
               "FEMA chunk ObjectID mismatch")
        object_ids.extend(oids)
        features.extend(rows)
    insist(len(set(object_ids)) == len(object_ids)
           and len(features) == metadata.get("featureCount") == metadata.get("objectIdCount")
           and digest(encoded(sorted(object_ids))) == metadata.get("objectIdsSha256"),
           "Incomplete, repeated or tampered FEMA layer inventory")
    return features, metadata, digest(raw)


def compare_panels(panels: list[dict], registry: dict) -> dict:
    insist(registry.get("dfirmId") == DFIRM and
           type(registry.get("panelCount")) is int
           and isinstance(registry.get("panels"), list), "Invalid legacy panel registry")
    expected = [x.get("firmPan") for x in registry["panels"]]
    actual = [x["properties"].get("FIRM_PAN") for x in panels]
    insist(all(isinstance(x, str) and len(x) == 11 for x in actual)
           and len(set(actual)) == len(actual)
           and len(set(expected)) == len(expected)
           and len(expected) == registry["panelCount"],
           "Duplicate/invalid FEMA panel identifier")
    missing, added = sorted(set(expected) - set(actual)), sorted(set(actual) - set(expected))
    return {"status": "MATCH" if not missing and not added else "SOURCE_INVENTORY_DRIFT_REVIEW",
            "registryCount": len(expected), "retrievedPanelCount": len(actual),
            "missingLegacyPanelIds": missing, "newOrChangedPanelIds": added,
            "authority": "LIVE_FEMA_DATA_REMAINS_CONTROLLING"}


def safe_shape(feature: dict):
    from shapely.geometry import shape
    value = feature.get("geometry")
    if value is None:
        return None
    try:
        g = shape(value)
    except (TypeError, ValueError, KeyError):
        return None
    if (g.is_empty or not g.is_valid or g.geom_type not in ("Polygon", "MultiPolygon")
            or not math.isfinite(g.area) or g.area <= 0):
        return None
    west, south, east, north = g.bounds
    if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
        return None
    return g


def analyze_parcels(parcels: list[dict], panels: list[dict], zones: list[dict],
                    inventory: dict, *, buildings: bool = False) -> dict:
    from shapely.ops import unary_union
    from shapely.prepared import prep
    from shapely.strtree import STRtree

    panel_shapes = [safe_shape(x) for x in panels]
    zone_shapes = [safe_shape(x) for x in zones]
    insist(all(g is not None for g in panel_shapes + zone_shapes),
           "FEMA geometry invalid; cannot infer absence of flood hazard")
    panel_union, zone_union = prep(unary_union(panel_shapes)), prep(unary_union(zone_shapes))
    panel_tree, zone_tree = STRtree(panel_shapes), STRtree(zone_shapes)
    ids = set()
    rows = []
    counts = Counter()
    kind = "building" if buildings else "parcel"
    id_property = "buildingSourceObjectId" if buildings else "parcelObjectId"
    for subject in parcels:
        props = subject.get("properties") or {}
        is_posey = props.get("county") == "Posey" if buildings else props.get("county_fips") == "18129"
        insist(is_posey, f"Non-Posey {kind} in source snapshot")
        parcel_oid = props.get("objectid")
        insist(type(parcel_oid) is int and parcel_oid not in ids, f"Missing/duplicate {kind} geometry OBJECTID")
        ids.add(parcel_oid)
        geom = safe_shape(subject)
        row = {
            id_property: parcel_oid,
            "firmPanelIds": [], "femaFloodZones": [],
            "femaSfhaAreaOverlap": None, "femaFloodwayReviewed": False,
            "bfeNavd88Ft": None, "lowestAdjacentGradeNavd88Ft": None,
            "femaDetermination": None, "reviewStatus": "INSUFFICIENT_EVIDENCE",
        }
        if not buildings:
            row["stateParcelId"] = props.get("state_parcel_id")
        if geom is None:
            status = f"{kind.upper()}_GEOMETRY_UNAVAILABLE"
        elif inventory["status"] != "MATCH":
            status = "FEMA_PANEL_INVENTORY_CHANGED_REVIEW"
        elif not panel_union.covers(geom):
            status = "FEMA_PANEL_COVERAGE_INCOMPLETE"
        elif not zone_union.covers(geom):
            status = "FEMA_ZONE_COVERAGE_INCOMPLETE"
        else:
            panel_matches = [
                int(i) for i in panel_tree.query(geom)
                if panel_shapes[int(i)].intersection(geom).area > 0
            ]
            zone_matches = [
                int(i) for i in zone_tree.query(geom)
                if zone_shapes[int(i)].intersection(geom).area > 0
            ]
            row["firmPanelIds"] = sorted(set(
                panels[i]["properties"]["FIRM_PAN"] for i in panel_matches))
            flags = [zones[i]["properties"].get("SFHA_TF") for i in zone_matches]
            row["femaFloodZones"] = sorted(set(str(zones[i]["properties"]["FLD_ZONE"])
                                              for i in zone_matches))
            if not zone_matches or not panel_matches or any(x not in ("T", "F") for x in flags):
                status = "FEMA_ZONE_ATTRIBUTE_OR_INDEX_UNVERIFIED"
            else:
                overlap = "T" in flags
                row["femaSfhaAreaOverlap"] = overlap
                status = ("FEMA_SFHA_POLYGON_OVERLAP_REVIEW" if overlap
                          else "NO_SFHA_POLYGON_OVERLAP_IN_PINNED_FEMA_SNAPSHOT")
        row["screeningStatus"] = status
        counts[status] += 1
        rows.append(row)
    return {
        "schema": f"tsm.posey.fema-{kind}-evidence-review.v1",
        "screeningOnly": True,
        "regulatoryEligibilityEstablished": False,
        "sourcePanelInventory": inventory,
        "statusCounts": dict(sorted(counts.items())),
        "rows": sorted(rows, key=lambda r: r[id_property]),
    }


def screen(snapshot: Path, parcel_path: Path, registry_path: Path, *,
           footprint_path: Path | None = None, footprint_sha256: str | None = None) -> dict:
    panels, pm, ph = load_layer(snapshot / "firm_panels", "firm_panels")
    zones, zm, zh = load_layer(snapshot / "flood_hazard_zones", "flood_hazard_zones")
    registry_bytes, parcel_bytes = registry_path.read_bytes(), parcel_path.read_bytes()
    registry, source = json.loads(registry_bytes), json.loads(parcel_bytes)
    insist(source.get("type") == "FeatureCollection" and isinstance(source.get("features"), list),
           "Missing parcel GeoJSON FeatureCollection")
    crs = (source.get("crs") or {}).get("properties", {}).get("name")
    insist(crs in (None, "EPSG:4326", "urn:ogc:def:crs:OGC:1.3:CRS84"),
           "Parcel source must be CRS84 longitude/latitude, not projected feet")
    inventory = compare_panels(panels, registry)
    report = analyze_parcels(source["features"], panels, zones, inventory)
    report["sourceSha256"] = {
        "parcelGeoJson": digest(parcel_bytes),
        "legacyPanelRegistry": digest(registry_bytes),
        "femaPanelReceipt": ph,
        "femaZoneReceipt": zh,
    }
    if footprint_path is not None:
        footprint_bytes = footprint_path.read_bytes()
        insist(digest(footprint_bytes) == footprint_sha256, "Building source SHA-256 does not match")
        footprints = json.loads(footprint_bytes)
        insist(footprints.get("type") == "FeatureCollection"
               and isinstance(footprints.get("features"), list)
               and len(footprints["features"]) == 23082,
               "Expected the full 23,082-record Posey IGIO footprint archive")
        footprint_crs = (footprints.get("crs") or {}).get("properties", {}).get("name")
        insist(footprint_crs in (None, "EPSG:4326", "urn:ogc:def:crs:OGC:1.3:CRS84"),
               "Building source must be CRS84 longitude/latitude")
        report["buildingScreen"] = analyze_parcels(
            footprints["features"], panels, zones, inventory, buildings=True)
        report["sourceSha256"]["buildingGeoJson"] = footprint_sha256
    report["nfhlLayerCounts"] = {"firmPanels": pm["featureCount"],
                                 "floodHazardZones": zm["featureCount"]}
    report["elevationEvidence"] = "NOT_INCLUDED_NO_FEMA_LOMA_ELIGIBILITY_INFERENCE"
    report["rightsAndPrivacy"] = "Public geometry references only; no parcel owner names/addresses"
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    acquire = sub.add_parser("acquire", help="Explicitly download official FEMA geometries")
    acquire.add_argument("--out", type=Path, required=True)
    acquire.add_argument("--page-size", type=int, default=10)
    verify = sub.add_parser("verify", help="Offline checksum and OBJECTID validation")
    verify.add_argument("--snapshot", type=Path, required=True)
    review = sub.add_parser("screen", help="Offline Posey parcel-to-effective-NFHL screening")
    review.add_argument("--snapshot", type=Path, required=True)
    review.add_argument("--parcels", type=Path, required=True)
    review.add_argument("--registry", type=Path, required=True)
    review.add_argument("--out", type=Path, required=True)
    review.add_argument("--footprints", type=Path, help="Archived full Posey IGIO footprint GeoJSON")
    review.add_argument("--footprint-sha256", help="Expected SHA-256 of the footprint archive")
    args = parser.parse_args()
    if args.command == "acquire":
        insist(not args.out.exists(), "Snapshot output already exists; no overwrite")
        args.out.mkdir(parents=True)
        for name in LAYERS:
            manifest = acquire_layer(name, args.out / name, page_size=args.page_size)
            print(f"{name}: {manifest['featureCount']} FEMA polygon features downloaded")
    elif args.command == "verify":
        for name in LAYERS:
            features, _, _ = load_layer(args.snapshot / name, name)
            print(f"{name}: {len(features)} features SHA-256 verified; not survey certified")
    else:
        insist(not args.out.exists(), "Screening output already exists; no overwrite")
        if (args.footprints is None) != (args.footprint_sha256 is None):
            parser.error("--footprints and --footprint-sha256 must be supplied together")
        result = screen(args.snapshot, args.parcels, args.registry,
                        footprint_path=args.footprints, footprint_sha256=args.footprint_sha256)
        args.out.write_bytes(encoded(result))
        print(json.dumps({"status": "REVIEW_ONLY", "counts": result["statusCounts"],
                          "panelInventory": result["sourcePanelInventory"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
