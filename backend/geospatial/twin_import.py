"""Import independently reviewed, hashed geospatial assets into PostGIS.

No network access, no unknown CRS transformations, no automatic regulatory
promotion. A PASS here is a documented source-review claim, not a field survey.
The public API only serves assets separately approved for viewing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit

ALLOWED_KINDS = frozenset({
    "VECTOR", "DEM", "LIDAR", "ORTHOPHOTO", "HISTORICAL_MAP",
    "ARCHIVAL_PHOTO", "HYDROGRAPHY", "MODEL_OUTPUT",
})
MAX_VECTOR_BYTES = 256 * 1024 * 1024
MAX_FEATURES = 200_000
CHUNK_BYTES = 1024 * 1024
ID_FIELDS = ("OBJECTID", "objectid", "ObjectID", "id")
VECTOR_TYPES = frozenset({
    "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon",
})


def _required_str(manifest: dict, name: str) -> str:
    value = manifest.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ValueError("MISSING_OR_INVALID_" + name)
    return value.strip()


def _check_geometry(geom: dict) -> None:
    if not isinstance(geom, dict) or geom.get("type") not in VECTOR_TYPES:
        raise ValueError("UNSUPPORTED_GEOJSON_GEOMETRY")
    coords = geom.get("coordinates")
    if not isinstance(coords, list) or not coords:
        raise ValueError("MISSING_COORDINATES")
    queue = [coords]
    points = 0
    while queue:
        item = queue.pop()
        if not isinstance(item, list) or not item:
            raise ValueError("INVALID_GEOJSON_COORDINATES")
        if type(item[0]) in (int, float):
            if len(item) < 2:
                raise ValueError("INVALID_COORDINATE_PAIR")
            lon, lat = item[:2]
            if (not all(type(v) in (int, float) and math.isfinite(v) for v in item)
                    or not -180 <= lon <= 180 or not -90 <= lat <= 90):
                raise ValueError("NONFINITE_OR_NON_WGS84_COORDINATES")
            points += 1
            if points > 2_000_000:
                raise ValueError("GEOMETRY_VERTEX_LIMIT_EXCEEDED")
        else:
            queue.extend(item)


def _hash_file(path: Path) -> tuple[str, int]:
    sha = hashlib.sha256()
    length = 0
    with path.open("rb") as stream:
        while block := stream.read(CHUNK_BYTES):
            length += len(block)
            sha.update(block)
    return sha.hexdigest(), length


def prepare(source_path: Path, manifest_path: Path) -> tuple[dict, list[dict]]:
    if (source_path.is_symlink() or manifest_path.is_symlink()
            or not source_path.is_file() or not manifest_path.is_file()
            or manifest_path.stat().st_size > 128 * 1024):
        raise ValueError("MISSING_UNSAFE_OR_OVERSIZE_INPUT")
    manifest = json.loads(manifest_path.read_text("utf8"))
    if not isinstance(manifest, dict):
        raise ValueError("MANIFEST_OBJECT_REQUIRED")
    for key in ("assetId", "sourceId", "assetKind", "sourceUrl", "sourceVersion",
                "retrievedAt", "horizontalCrs", "sha256", "license", "attribution", "reviewId"):
        _required_str(manifest, key)
    kind = manifest["assetKind"]
    if kind not in ALLOWED_KINDS:
        raise ValueError("UNKNOWN_ASSET_KIND")
    if manifest.get("validationStatus") != "PASS" or manifest.get("licenseReviewed") is not True:
        raise ValueError("INDEPENDENT_VALIDATION_AND_LICENSE_REVIEW_REQUIRED")
    if manifest["horizontalCrs"] != "EPSG:4326" and kind in ("VECTOR", "HYDROGRAPHY"):
        raise ValueError("VECTOR_REQUIRES_WGS84_REPROJECTION")
    if kind in ("DEM", "LIDAR"):
        _required_str(manifest, "verticalDatum")
        _required_str(manifest, "units")
    if kind == "ORTHOPHOTO":
        _required_str(manifest, "captureStart")
        _required_str(manifest, "captureEnd")
    parsed = urlsplit(manifest["sourceUrl"])
    if (parsed.scheme != "https" or not parsed.hostname
            or parsed.username or parsed.password or parsed.fragment):
        raise ValueError("INVALID_SOURCE_URL")
    digest, length = _hash_file(source_path)
    if (digest != manifest["sha256"] or length != manifest.get("byteLength")
            or length <= 0):
        raise ValueError("ASSET_HASH_OR_LENGTH_MISMATCH")
    features = []
    if kind in ("VECTOR", "HYDROGRAPHY"):
        if length > MAX_VECTOR_BYTES:
            raise ValueError("VECTOR_FILE_TOO_LARGE")
        payload = json.loads(source_path.read_bytes())
        if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
            raise ValueError("FEATURE_COLLECTION_REQUIRED")
        features = payload.get("features")
        if not isinstance(features, list) or len(features) > MAX_FEATURES:
            raise ValueError("INVALID_FEATURE_COUNT")
        unique = set()
        for feature in features:
            if not isinstance(feature, dict) or feature.get("type") != "Feature":
                raise ValueError("INVALID_FEATURE")
            props = feature.get("properties")
            if not isinstance(props, dict):
                raise ValueError("FEATURE_PROPERTIES_REQUIRED")
            fid = feature.get("id")
            if fid is None:
                fid = next((props[f] for f in ID_FIELDS if props.get(f) is not None), None)
            if fid is None or len(str(fid)) > 256 or str(fid) in unique:
                raise ValueError("MISSING_OR_DUPLICATE_FEATURE_ID")
            feature["id"] = str(fid)
            unique.add(str(fid))
            _check_geometry(feature.get("geometry"))
    return manifest, features


def _archive_copy(source_path: Path, object_store: Path, digest: str) -> Path:
    if object_store.is_symlink():
        raise ValueError("OBJECT_STORE_SYMLINK_REJECTED")
    object_store.mkdir(parents=True, exist_ok=True)
    final = object_store / digest[:2] / digest
    final.parent.mkdir(exist_ok=True)
    if not final.exists():
        temp = final.with_suffix(".tmp-" + str(os.getpid()))
        try:
            with source_path.open("rb") as source, temp.open("xb") as target:
                shutil.copyfileobj(source, target, CHUNK_BYTES)
            if _hash_file(temp)[0] != digest:
                raise ValueError("COPIED_ASSET_CHECKSUM_MISMATCH")
            os.replace(temp, final)
        finally:
            temp.unlink(missing_ok=True)
    if final.is_symlink() or _hash_file(final)[0] != digest:
        raise ValueError("OBJECT_STORE_HASH_MISMATCH")
    return final


def persist(source_path: Path, manifest_path: Path, *,
            object_store: Path, connect=None) -> dict:
    manifest, features = prepare(source_path, manifest_path)
    if connect is None:
        import psycopg2
        connect = psycopg2.connect
    dsn = os.getenv("TSM_POSTGIS_DSN")
    if not dsn:
        raise RuntimeError("TSM_POSTGIS_DSN_REQUIRED")
    # Content-addressed copy is immutable; a failed DB commit may leave an
    # unreferenced object, which is safer than a broken DB pointer.
    archive = _archive_copy(source_path, object_store, manifest["sha256"])
    connection = connect(dsn)
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT endpoint FROM twin_geo.source WHERE source_id=%s",
                        (manifest["sourceId"],))
            row = cur.fetchone()
            if row is None:
                raise ValueError("SOURCE_NOT_REGISTERED_IN_POSTGIS")
            registered = row[0].rstrip("/")
            given = manifest["sourceUrl"]
            if given != registered and not given.startswith(registered + "/"):
                raise ValueError("SOURCE_URL_NOT_MATCHING_REGISTRY")
            if kind := manifest["assetKind"]:
                pass
            cur.execute(
                """INSERT INTO twin_geo.asset (
                   asset_id,source_id,asset_kind,source_version,source_url,
                   retrieved_at,capture_start,capture_end,effective_date,
                   horizontal_crs,vertical_datum,units,raw_sha256,byte_length,
                   storage_uri,license_note,attribution,validation_status,
                   publication_status,review_id,manifest)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                           'PASS','NOT_APPROVED',%s,%s::jsonb)""",
                (manifest["assetId"], manifest["sourceId"], manifest["assetKind"],
                 manifest["sourceVersion"], manifest["sourceUrl"],
                 manifest["retrievedAt"], manifest.get("captureStart"),
                 manifest.get("captureEnd"), manifest.get("effectiveDate"),
                 manifest["horizontalCrs"], manifest.get("verticalDatum"),
                 manifest.get("units"), manifest["sha256"], manifest["byteLength"],
                 archive.resolve().as_uri(), manifest["license"], manifest["attribution"],
                 manifest["reviewId"], json.dumps(manifest, sort_keys=True)),
            )
            for feature in features:
                compact = json.dumps(feature, separators=(",", ":"), sort_keys=True,
                                     ensure_ascii=False, allow_nan=False)
                cur.execute(
                    """INSERT INTO twin_geo.feature
                       (asset_id,feature_id,geom,properties,feature_sha256)
                       VALUES (%s,%s,ST_SetSRID(ST_GeomFromGeoJSON(%s),4326),
                               %s::jsonb,%s)""",
                    (manifest["assetId"], feature["id"],
                     json.dumps(feature["geometry"], separators=(",", ":"), allow_nan=False),
                     json.dumps(feature["properties"], sort_keys=True, allow_nan=False),
                     hashlib.sha256(compact.encode("utf8")).hexdigest()),
                )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"assetId": manifest["assetId"], "featureCount": len(features),
            "sha256": manifest["sha256"], "result": "IMPORTED_NOT_PUBLISHED"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_file", type=Path)
    parser.add_argument("manifest_file", type=Path)
    parser.add_argument("--object-store", type=Path, default=Path(
        os.environ.get("TSM_TWIN_OBJECT_STORE", "backend/outbox/twin-objects")))
    args = parser.parse_args()
    print(json.dumps(persist(args.source_file, args.manifest_file,
                             object_store=args.object_store), indent=2))


if __name__ == "__main__":
    main()
