#!/usr/bin/env python3
"""Operator-controlled Posey ingestion: ArcGIS GeoJSON -> PostGIS -> human review.

Commands:
  fetch-arcgis SOURCE_ID   (only the configured three IGIO FeatureServers)
  import-geojson SOURCE_ID FILE --manifest META.json
  import-asset SOURCE_ID FILE --manifest META.json --kind DEM
  approve SNAPSHOT_UUID --reviewer SUBJECT --reason TEXT --license-note TEXT
All writes are private CLI operations. Public GET APIs never import or approve.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
from urllib.parse import urlsplit

MAX_GEOJSON_BYTES = 120 * 1024 * 1024
MAX_FEATURES = 100_000
ROOT = Path(__file__).resolve().parents[2]
COUNTY_PATH = ROOT / "data/posey-county/boundaries/posey-county.geojson"
ALLOWED_ARCGIS = frozenset({"igio-parcels", "igio-roads", "igio-buildings"})


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def db_connect():
    import psycopg
    from psycopg.rows import dict_row
    dsn = os.environ.get("TSM_GEOSPATIAL_DSN")
    if not dsn:
        raise RuntimeError("TSM_GEOSPATIAL_DSN_REQUIRED")
    return psycopg.connect(dsn, row_factory=dict_row, connect_timeout=10)


def source(conn, source_id: str):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM geotwin.source WHERE source_id=%s", (source_id,))
        row = cur.fetchone()
    if row is None:
        raise ValueError("SOURCE_NOT_IN_GOVERNED_REGISTRY")
    return row


def county_shape():
    from shapely.geometry import shape
    from shapely.ops import unary_union
    data = json.loads(COUNTY_PATH.read_text(encoding="utf-8"))
    if data.get("type") == "FeatureCollection":
        shapes = [shape(f["geometry"]) for f in data["features"]]
        geom = unary_union(shapes)
    elif data.get("type") == "Feature":
        geom = shape(data["geometry"])
    else:
        geom = shape(data)
    if geom.is_empty or not geom.is_valid or geom.geom_type not in {"Polygon", "MultiPolygon"}:
        raise ValueError("POSEY_COUNTY_BOUNDARY_INVALID")
    west, south, east, north = geom.bounds
    if not (-89 < west < east < -87 and 37 < south < north < 39):
        raise ValueError("POSEY_COUNTY_BOUNDARY_CRS_INVALID")
    return geom


def http_json(client, url: str, params: dict, max_bytes: int = 25_000_000):
    response = client.get(url, params=params)
    response.raise_for_status()
    if len(response.content) > max_bytes:
        raise ValueError("UPSTREAM_RESPONSE_TOO_LARGE")
    obj = response.json()
    if not isinstance(obj, dict) or obj.get("error"):
        raise ValueError("UPSTREAM_ARCGIS_ERROR")
    return obj


def fetch_arcgis(src: dict, max_features: int = MAX_FEATURES) -> bytes:
    """Query object IDs within *actual* county-boundary envelope, then fetch
    ID batches in WGS84; exact county intersection is applied before staging.
    Query service must explicitly support geoJSON; no guessed conversions.
    """
    import httpx
    if src["source_id"] not in ALLOWED_ARCGIS or src["ingest_mode"] != "ARCGIS_GEOJSON":
        raise ValueError("LIVE_FETCH_NOT_APPROVED_FOR_SOURCE")
    url = src["endpoint"]
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname != "gisdata.in.gov"
            or not parsed.path.startswith("/server/rest/services/Hosted/")
            or not parsed.path.endswith("/FeatureServer/0")):
        raise ValueError("UPSTREAM_HOST_OR_PATH_NOT_ALLOWED")
    shape = county_shape()
    bbox = ",".join(str(v) for v in shape.bounds)
    with httpx.Client(timeout=45.0, follow_redirects=False,
                      headers={"User-Agent": "TSM-Posey-Snapshot/1.0"}) as client:
        metadata = http_json(client, url, {"f": "json"}, 1_000_000)
        formats = str(metadata.get("supportedQueryFormats", "")).lower()
        if "geojson" not in formats:
            raise ValueError("UPSTREAM_DOES_NOT_SUPPORT_GEOJSON")
        oid_field = metadata.get("objectIdField")
        if not isinstance(oid_field, str) or not oid_field:
            fields = metadata.get("fields", [])
            oid_field = next((f["name"] for f in fields
                              if f.get("type") == "esriFieldTypeOID"), None)
        if not oid_field:
            raise ValueError("UPSTREAM_OBJECT_ID_FIELD_UNKNOWN")
        query = {
            "where": "1=1", "geometry": bbox, "geometryType": "esriGeometryEnvelope",
            "inSR": "4326", "spatialRel": "esriSpatialRelIntersects",
            "returnIdsOnly": "true", "f": "json",
        }
        ids = http_json(client, url + "/query", query, 12_000_000).get("objectIds")
        if ids is None:
            raise ValueError("UPSTREAM_IDS_UNAVAILABLE")
        if not isinstance(ids, list) or len(ids) > max_features:
            raise ValueError("UPSTREAM_FEATURE_CAP_EXCEEDED")
        records = []
        for offset in range(0, len(ids), 250):
            batch = ids[offset:offset + 250]
            payload = http_json(client, url + "/query", {
                "objectIds": ",".join(str(i) for i in batch),
                "outFields": "*", "returnGeometry": "true",
                "outSR": "4326", "f": "geojson",
            })
            if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
                raise ValueError("UPSTREAM_GEOJSON_INVALID")
            records.extend(payload["features"])
    return json.dumps({"type": "FeatureCollection", "features": records},
                      sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def check_features(raw: bytes):
    from shapely.geometry import shape
    county = county_shape()
    if not raw or len(raw) > MAX_GEOJSON_BYTES:
        raise ValueError("INVALID_GEOJSON_SIZE")
    data = json.loads(raw)
    features = data.get("features")
    if data.get("type") != "FeatureCollection" or not isinstance(features, list):
        raise ValueError("GEOJSON_FEATURE_COLLECTION_REQUIRED")
    if not features or len(features) > MAX_FEATURES:
        raise ValueError("INVALID_FEATURE_COUNT")
    accepted, seen = [], set()
    for idx, feature in enumerate(features):
        if feature.get("type") != "Feature" or not isinstance(feature.get("properties"), dict):
            raise ValueError("INVALID_FEATURE_OR_PROPERTIES")
        geom = shape(feature["geometry"])
        if geom.is_empty or not geom.is_valid or geom.geom_type not in {
                "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"}:
            raise ValueError("INVALID_FEATURE_GEOMETRY")
        west, south, east, north = geom.bounds
        if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
            raise ValueError("FEATURE_COORDINATES_NOT_WGS84")
        if not county.intersects(geom):
            continue
        props = feature["properties"]
        fid = feature.get("id")
        if fid is None:
            for key in ("OBJECTID", "objectid", "GlobalID", "globalid", "sourceObjectId"):
                if props.get(key) is not None:
                    fid = props[key]
                    break
        if fid is None:
            fid = digest(json.dumps(feature, sort_keys=True, separators=(",", ":")).encode())
        fid = str(fid)
        if fid in seen or len(fid) > 256:
            raise ValueError("DUPLICATE_OR_INVALID_FEATURE_ID")
        seen.add(fid)
        accepted.append((fid, feature["geometry"], props,
                         digest(json.dumps(feature, sort_keys=True, separators=(",", ":"),
                                           ensure_ascii=False).encode("utf-8"))))
    if not accepted:
        raise ValueError("NO_FEATURES_INTERSECT_POSEY_COUNTY")
    return accepted


def manifest_check(meta: dict, src: dict, *, raster: bool = False):
    for key in ("sourceUrl", "retrievedAt", "attribution", "license"):
        if not isinstance(meta.get(key), str) or not meta[key].strip():
            raise ValueError("MANIFEST_MISSING_" + key)
    date = datetime.fromisoformat(meta["retrievedAt"].replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("RETRIEVAL_TIMESTAMP_REQUIRES_TIMEZONE")
    uri = urlsplit(meta["sourceUrl"])
    base = urlsplit(src["endpoint"])
    if uri.scheme != "https" or uri.username or uri.password or uri.fragment:
        raise ValueError("SOURCE_URL_NOT_HTTPS")
    if uri.hostname != base.hostname:
        raise ValueError("MANIFEST_HOST_NOT_IN_SOURCE_REGISTRY")
    crs = meta.get("horizontalCrs")
    if not isinstance(crs, str) or not crs:
        raise ValueError("EXPLICIT_SOURCE_CRS_REQUIRED")
    if not raster and crs != "EPSG:4326":
        raise ValueError("VECTOR_MUST_BE_REPROJECTED_TO_EPSG_4326")
    if src["ingest_mode"] == "REFERENCE_ONLY" and not raster:
        raise ValueError("HISTORICAL_MAPS_REQUIRE_EXPLICIT_ASSET_STAGING")
    if meta.get("evidenceClass") not in ("SOURCE_OBSERVATION","SOURCE_REFERENCE","DERIVED","HISTORICAL"):
        raise ValueError("EVIDENCE_CLASS_REQUIRED")
    return date


def stage(conn, src: dict, raw: bytes, meta: dict, *, asset: str | None = None):
    from psycopg.types.json import Jsonb
    stamp = manifest_check(meta, src, raster=asset is not None)
    records = None if asset else check_features(raw)
    store = Path(os.environ.get("TSM_GEOSPATIAL_STORE", "/var/lib/tsm/geospatial")).resolve()
    store.mkdir(parents=True, exist_ok=True)
    sha = digest(raw)
    ext = Path(asset).suffix.lower() if asset else ".geojson"
    destination = store / (sha + ext)
    if not destination.exists():
        temp = store / (sha + ext + ".tmp")
        temp.write_bytes(raw)
        temp.replace(destination)
    if digest(destination.read_bytes()) != sha:
        raise ValueError("STAGED_OBJECT_HASH_MISMATCH")
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO geotwin.snapshot (
              source_id,source_url,sha256,byte_length,retrieved_at,
              acquisition_date,effective_date,source_crs,vertical_datum,
              license_note,attribution,raw_object_uri,evidence_class,feature_count,provenance)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT(source_id,sha256) DO NOTHING RETURNING snapshot_id::text
        """, (src["source_id"],meta["sourceUrl"],sha,len(raw),stamp,
              meta.get("acquisitionDate"),meta.get("effectiveDate"),meta["horizontalCrs"],
              meta.get("verticalDatum"),meta["license"],meta["attribution"],
              "file://" + str(destination),meta["evidenceClass"],
              len(records) if records else 0,Jsonb(meta)))
        result = cur.fetchone()
        if result is None:
            raise ValueError("SNAPSHOT_ALREADY_IMPORTED")
        snapshot_id = result["snapshot_id"]
        if records:
            from psycopg import sql
            cur.executemany("""
                INSERT INTO geotwin.feature(snapshot_id,feature_id,geom,properties,feature_sha256)
                VALUES (%s::uuid,%s,ST_SetSRID(ST_GeomFromGeoJSON(%s),4326),%s,%s)
            """, [(snapshot_id,fid,json.dumps(geom),Jsonb(props),h)
                  for fid,geom,props,h in records])
        else:
            cur.execute("""
                INSERT INTO geotwin.asset(snapshot_id,asset_kind,local_path,sha256,
                    byte_length,horizontal_crs,vertical_datum,acquisition_date)
                VALUES (%s::uuid,%s,%s,%s,%s,%s,%s,%s)
            """, (snapshot_id,asset,str(destination),sha,len(raw),meta["horizontalCrs"],
                  meta.get("verticalDatum"),meta.get("acquisitionDate")))
    conn.commit()
    return {"snapshot_id":snapshot_id,"source_id":src["source_id"],"sha256":sha,
            "feature_count":len(records) if records else 0,
            "status":"STAGED_NOT_PUBLISHED","local_path":str(destination)}


def approve(conn, snapshot_id: str, reviewer: str, reason: str, license_note: str):
    allowlist = set(filter(None, (x.strip() for x in
                        os.environ.get("TSM_REVIEWER_SUBJECTS","").split(","))))
    if not allowlist or reviewer not in allowlist:
        raise ValueError("REVIEWER_NOT_AUTHORIZED")
    if len(reason.strip()) < 12 or len(license_note.strip()) < 8:
        raise ValueError("REASON_AND_LICENSE_REVIEW_REQUIRED")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT source_id, sha256, raw_object_uri, review_status
            FROM geotwin.snapshot WHERE snapshot_id=%s::uuid FOR UPDATE
        """, (snapshot_id,))
        snap=cur.fetchone()
        if not snap or snap["review_status"] != "STAGED":
            raise ValueError("SNAPSHOT_NOT_STAGED")
        path=Path(snap["raw_object_uri"].removeprefix("file://"))
        if digest(path.read_bytes()) != snap["sha256"]:
            raise ValueError("STORED_BYTES_FAIL_SHA256_RECHECK")
        cur.execute("""UPDATE geotwin.snapshot SET review_status='APPROVED_FOR_VIEW',
                 license_note=%s WHERE snapshot_id=%s::uuid""", (license_note,snapshot_id))
        cur.execute("""INSERT INTO geotwin.review_event
                 (snapshot_id,reviewer_id,decision,scope,rationale)
                 VALUES (%s::uuid,%s,'APPROVED_FOR_VIEW','PUBLIC_VISUALIZATION_ONLY',%s)""",
                 (snapshot_id,reviewer,reason))
    conn.commit()
    return {"snapshot_id":snapshot_id,"status":"APPROVED_FOR_VIEW",
            "scope":"PUBLIC_VISUALIZATION_ONLY","regulatory_certification":False}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest="command",required=True)
    fetch=sub.add_parser("fetch-arcgis")
    fetch.add_argument("source_id",choices=sorted(ALLOWED_ARCGIS))
    fetch.add_argument("--max-features",type=int,default=MAX_FEATURES)
    local=sub.add_parser("import-geojson")
    local.add_argument("source_id")
    local.add_argument("file",type=Path)
    local.add_argument("--manifest",required=True,type=Path)
    raster=sub.add_parser("import-asset")
    raster.add_argument("source_id")
    raster.add_argument("file",type=Path)
    raster.add_argument("--manifest",required=True,type=Path)
    raster.add_argument("--kind",choices=["DEM","COPC","ORTHOPHOTO","SCAN","PHOTO","OTHER"],required=True)
    review=sub.add_parser("approve")
    review.add_argument("snapshot_id")
    review.add_argument("--reviewer",required=True)
    review.add_argument("--reason",required=True)
    review.add_argument("--license-note",required=True)
    args=parser.parse_args()
    with db_connect() as conn:
        if args.command == "approve":
            result=approve(conn,args.snapshot_id,args.reviewer,args.reason,args.license_note)
        else:
            src=source(conn,args.source_id)
            if args.command == "fetch-arcgis":
                if not (1 <= args.max_features <= MAX_FEATURES):
                    raise ValueError("INVALID_MAX_FEATURES")
                raw=fetch_arcgis(src,args.max_features)
                meta={"sourceUrl":src["endpoint"],"retrievedAt":datetime.now(timezone.utc).isoformat(),
                      "attribution":src["agency"],"license":"REVIEW_REQUIRED",
                      "horizontalCrs":"EPSG:4326","evidenceClass":"SOURCE_REFERENCE",
                      "collectionDateStatus":"NOT_VERIFIED",
                      "collectionMethod":"ArcGIS FeatureServer objectId batch fetch"}
                result=stage(conn,src,raw,meta)
            else:
                if not args.file.is_file() or args.file.stat().st_size > MAX_GEOJSON_BYTES:
                    raise ValueError("SOURCE_FILE_MISSING_OR_EXCEEDS_LIMIT")
                raw=args.file.read_bytes()
                meta=json.loads(args.manifest.read_text(encoding="utf8"))
                result=stage(conn,src,raw,meta,
                             asset=args.kind if args.command=="import-asset" else None)
    print(json.dumps(result,indent=2))


if __name__=="__main__":
    main()
