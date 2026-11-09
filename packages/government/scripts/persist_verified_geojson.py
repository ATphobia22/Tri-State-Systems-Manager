#!/usr/bin/env python3
"""Persist reviewed GeoJSON snapshots with bound evidence hashes in local PostGIS.

Requires psycopg>=3 and TSM_POSTGIS_DSN. This is not a regulatory acceptance service.
"""
from __future__ import annotations
import hashlib
import json
import os
import sys
from pathlib import Path

SHA256 = set("0123456789abcdef")
AUTHORIZED = {
    "FEMA": {"fema-nfhl"}, "USGS": {"usgs-3dep", "usgs-hydrography"},
    "USACE": {"usace-levees"}, "NOAA": {"noaa-weather"},
    "CENSUS": {"census-tiger"}, "USDA": {"usda-soils"},
    "EPA": {"epa-waters"},
}
MAX_BYTES = 100_000_000


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def prepare(geojson_path: str, manifest_path: str) -> tuple[dict, list[dict], bytes]:
    src = Path(geojson_path)
    if not src.is_file() or src.stat().st_size > MAX_BYTES:
        raise ValueError("GEOJSON_MISSING_OR_TOO_LARGE")
    raw = src.read_bytes()
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError("GEOJSON_MISSING_OR_TOO_LARGE")
    manifest = json.loads(Path(manifest_path).read_text("utf8"))
    if manifest.get("validationStatus") != "PASS":
        raise ValueError("GEOJSON_REQUIRES_INDEPENDENT_VALIDATION_PASS")
    if manifest.get("horizontalCrs") != "EPSG:4326":
        raise ValueError("GEOJSON_REPROJECT_TO_WGS84_REQUIRED")
    if manifest.get("sha256") != sha(raw) or manifest.get("byteLength") != len(raw):
        raise ValueError("GEOJSON_MANIFEST_HASH_OR_LENGTH_MISMATCH")
    authority, source_id = manifest.get("authority"), manifest.get("sourceId")
    if source_id not in AUTHORIZED.get(authority, set()):
        raise ValueError("GOVERNMENT_SOURCE_AUTHORITY_MISMATCH")
    if not isinstance(manifest.get("datasetId"), str) or not manifest["datasetId"]:
        raise ValueError("DATASET_ID_REQUIRED")
    url = manifest.get("sourceUrl", "")
    if not isinstance(url, str) or not url.startswith("https://") or "@" in url.split("/", 3)[2]:
        raise ValueError("SOURCE_URL_INVALID")
    for field in ("retrievedAt", "sourceVersion", "attribution", "license"):
        if not isinstance(manifest.get(field), str) or not manifest[field].strip():
            raise ValueError("MISSING_MANIFEST_FIELD_" + field)
    if manifest.get("classification") not in {"OBSERVED", "DERIVED"}:
        raise ValueError("GOVERNMENT_INGEST_CLASSIFICATION_NOT_ALLOWED")
    data = json.loads(raw)
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError("GEOJSON_FEATURE_COLLECTION_REQUIRED")
    features = data["features"]
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ValueError("INVALID_FEATURE")
        if not isinstance(feature.get("geometry"), dict) or not isinstance(feature.get("properties"), dict):
            raise ValueError("INVALID_FEATURE_GEOMETRY_OR_PROPERTIES")
    return manifest, features, raw


def persist(geojson_path: str, manifest_path: str, connect=None) -> dict:
    manifest, features, raw = prepare(geojson_path, manifest_path)
    if connect is None:
        import psycopg
        connect = psycopg.connect
    dsn = os.getenv("TSM_POSTGIS_DSN")
    if not dsn:
        raise RuntimeError("TSM_POSTGIS_DSN_REQUIRED")
    dataset_id = manifest["datasetId"]
    source_id = manifest["sourceId"]
    with connect(dsn) as connection:
        with connection.cursor() as cur:
            cur.execute(
                """INSERT INTO government.source(source_id,authority,endpoint,catalog_version)
                   VALUES (%s,%s,%s,%s) ON CONFLICT(source_id) DO NOTHING""",
                (source_id, manifest["authority"], manifest["sourceUrl"], manifest["sourceVersion"]),
            )
            cur.execute(
                """INSERT INTO government.dataset(
                   dataset_id,source_id,dataset_version,retrieved_at,acquisition_date,
                   source_crs,vertical_datum,units,classification,validation_status,
                   authorization_status,sha256,byte_length,media_type,attribution,license,manifest)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'NOT_EVIDENCED',%s,%s,%s,%s,%s,%s::jsonb)""",
                (dataset_id, source_id, manifest["sourceVersion"], manifest["retrievedAt"],
                 manifest.get("acquisitionDate"), manifest["horizontalCrs"],
                 manifest.get("verticalDatum"), manifest.get("units"),
                 manifest["classification"], "PASS", manifest["sha256"], len(raw),
                 manifest.get("mediaType", "application/geo+json"), manifest["attribution"],
                 manifest["license"], json.dumps(manifest, sort_keys=True)),
            )
            for i, feature in enumerate(features):
                payload = json.dumps(feature, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
                feature_id = str(feature.get("id") if feature.get("id") is not None else i)
                cur.execute(
                    """INSERT INTO government.feature(dataset_id,feature_id,geom,properties,source_feature_hash)
                       VALUES(%s,%s,ST_SetSRID(ST_GeomFromGeoJSON(%s),4326),%s::jsonb,%s)""",
                    (dataset_id, feature_id,
                     json.dumps(feature["geometry"], separators=(",", ":")),
                     json.dumps(feature["properties"], sort_keys=True),
                     sha(payload.encode("utf8"))),
                )
            cur.execute(
                """INSERT INTO government.evidence_event(
                   dataset_id,event_type,actor_type,actor_id,artifact_sha256,data)
                   VALUES (%s,'SOURCE_IMPORTED','SYSTEM','tsm-government-postgis-import',%s,%s::jsonb)""",
                (dataset_id, manifest["sha256"],
                 json.dumps({"manifest": manifest, "featureCount": len(features)}, sort_keys=True)),
            )
        connection.commit()
    return {"datasetId": dataset_id, "featureCount": len(features),
            "sha256": manifest["sha256"], "authorizationStatus": "NOT_EVIDENCED",
            "result": "PERSISTED_NOT_REGULATORY"}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python persist_verified_geojson.py input.geojson input.manifest.json")
    try:
        print(json.dumps(persist(sys.argv[1], sys.argv[2]), indent=2))
    except Exception as error:
        print(f"POSTGIS_PERSIST_FAILED: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
