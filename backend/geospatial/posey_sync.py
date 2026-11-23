"""Bounded, user-invoked Posey IGIO ArcGIS snapshots. No implicit publication.

The county polygon is fetched from the official IGIO county boundary service,
then used as an Esri polygon spatial filter for footprints, parcels and roads.
Source pages are bounded, counted, and written only after complete retrieval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

COUNTY_URL = "https://gisdata.in.gov/server/rest/services/Hosted/County_Boundaries_of_Indiana_Current/FeatureServer/0"
SOURCES = {
    "igio-buildings": (
        "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0",
        "county = 'Posey'",
    ),
    "igio-parcels": (
        "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0",
        "county_fips = '18129'",
    ),
    "igio-roads": (
        "https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer/0",
        "1=1",
    ),
    "indnr-flood": (
        "https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Watergdb/FeatureServer/0",
        "1=1",
    ),
}
PAGE_SIZE = 500
MAX_FEATURES = 200_000
MAX_HTTP_BYTES = 24 * 1024 * 1024
MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024


def _get_json(client: httpx.Client, url: str, params: dict) -> dict:
    # No user-entered URLs. Redirects are intentionally disabled.
    if not url.startswith("https://gisdata.in.gov/server/rest/services/Hosted/") or not (
        url.endswith("/query") or url.endswith("/0")
    ):
        raise ValueError("ARCGIS_ENDPOINT_NOT_ALLOWLISTED")
    with client.stream("GET", url, params=params, follow_redirects=False, timeout=30) as response:
        response.raise_for_status()
        if 300 <= response.status_code < 400:
            raise ValueError("ARCGIS_REDIRECT_BLOCKED")
        chunks, count = [], 0
        for chunk in response.iter_bytes():
            count += len(chunk)
            if count > MAX_HTTP_BYTES:
                raise ValueError("ARCGIS_RESPONSE_TOO_LARGE")
            chunks.append(chunk)
        payload = json.loads(b"".join(chunks))
    if not isinstance(payload, dict) or "error" in payload:
        raise ValueError("ARCGIS_RESPONSE_INVALID_OR_ERROR")
    return payload


def _posey_polygon(client: httpx.Client) -> dict:
    response = _get_json(client, COUNTY_URL + "/query", {
        "f": "json", "where": "fips = '18129'", "outFields": "fips",
        "outSR": "4326", "returnGeometry": "true",
    })
    features = response.get("features")
    if not isinstance(features, list) or len(features) != 1:
        raise ValueError("OFFICIAL_POSEY_AOI_NOT_UNIQUE")
    geometry = features[0].get("geometry")
    if not isinstance(geometry, dict) or not geometry.get("rings"):
        raise ValueError("OFFICIAL_POSEY_AOI_MISSING_GEOMETRY")
    return geometry


def retrieve(source_id: str, client: httpx.Client) -> tuple[dict, dict]:
    if source_id not in SOURCES:
        raise ValueError("UNSUPPORTED_ARCGIS_SOURCE")
    source_url, where = SOURCES[source_id]
    geometry = _posey_polygon(client)
    filter_args = {
        "where": where, "geometry": json.dumps(geometry, separators=(",", ":")),
        "geometryType": "esriGeometryPolygon", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects", "outSR": "4326",
    }
    meta = _get_json(client, source_url, {"f": "json"})
    object_id_field = meta.get("objectIdField")
    if not isinstance(object_id_field, str) or not object_id_field:
        fields = meta.get("fields") or []
        matches = [f.get("name") for f in fields if f.get("type") == "esriFieldTypeOID"]
        if len(matches) != 1:
            raise ValueError("ARCGIS_OBJECT_ID_FIELD_UNAVAILABLE")
        object_id_field = matches[0]
    count = _get_json(client, source_url + "/query", {
        **filter_args, "f": "json", "returnCountOnly": "true",
    }).get("count")
    if type(count) is not int or not 0 <= count <= MAX_FEATURES:
        raise ValueError("ARCGIS_FEATURE_COUNT_UNTRUSTWORTHY")
    all_features, seen = [], set()
    for offset in range(0, count, PAGE_SIZE):
        page = _get_json(client, source_url + "/query", {
            **filter_args, "f": "geojson", "outFields": "*",
            "returnGeometry": "true", "resultOffset": offset,
            "resultRecordCount": min(PAGE_SIZE, count - offset),
            "orderByFields": object_id_field,
        })
        features = page.get("features")
        if page.get("type") != "FeatureCollection" or not isinstance(features, list):
            raise ValueError("ARCGIS_PAGE_NOT_GEOJSON")
        if len(features) != min(PAGE_SIZE, count - offset):
            raise ValueError("ARCGIS_PAGE_TRUNCATED")
        for feature in features:
            properties = feature.get("properties") or {}
            fid = feature.get("id")
            if fid is None:
                fid = properties.get(object_id_field)
            if fid is None or str(fid) in seen:
                raise ValueError("ARCGIS_OBJECT_ID_MISSING_OR_DUPLICATE")
            if not isinstance(feature.get("geometry"), dict):
                raise ValueError("ARCGIS_MISSING_GEOMETRY")
            feature["id"] = str(fid)
            seen.add(str(fid))
            all_features.append(feature)
    if len(all_features) != count:
        raise ValueError("ARCGIS_FEATURE_COUNT_MISMATCH")
    geojson = {"type": "FeatureCollection", "features": all_features}
    report = {"sourceId": source_id, "sourceUrl": source_url, "sourceCount": count,
              "spatialFilter": "OFFICIAL_POSEY_COUNTY_POLYGON_INTERSECTS",
              "countyFips": "18129", "sourceObjectIdField": object_id_field,
              "sourceMetadata": {"name": meta.get("name"),
                                 "serviceItemId": meta.get("serviceItemId"),
                                 "maxRecordCount": meta.get("maxRecordCount")},
              "validationStatus": "UNVERIFIED",
              "publicationStatus": "NOT_APPROVED",
              "note": "Spatial intersection includes cross-border geometries; it is not a survey or polygon clipping."}
    return geojson, report


def stage(source_id: str, output_dir: Path, *, client: httpx.Client | None = None) -> dict:
    if source_id not in SOURCES:
        raise ValueError("UNSUPPORTED_ARCGIS_SOURCE")
    if output_dir.is_symlink():
        raise ValueError("OUTPUT_DIR_SYMLINK_REJECTED")
    if client is None:
        with httpx.Client(headers={"User-Agent": "TSM-Geospatial/1.0"}) as own_client:
            return stage(source_id, output_dir, client=own_client)
    geojson, report = retrieve(source_id, client)
    raw = json.dumps(geojson, sort_keys=True, separators=(",", ":"),
                     ensure_ascii=False, allow_nan=False).encode("utf-8")
    if not raw or len(raw) > MAX_SNAPSHOT_BYTES:
        raise ValueError("ARCGIS_SNAPSHOT_TOO_LARGE")
    digest = hashlib.sha256(raw).hexdigest()
    output_dir.mkdir(parents=True, exist_ok=True)
    asset_id = f"{source_id}-{digest[:20]}"
    dst = output_dir / f"{asset_id}.geojson"
    manifest_path = output_dir / f"{asset_id}.manifest.json"
    if dst.exists() or manifest_path.exists():
        raise FileExistsError("IMMUTABLE_SNAPSHOT_ALREADY_STAGED")
    dst.write_bytes(raw)
    manifest = {
        "assetId": asset_id, "sourceId": source_id,
        "assetKind": "VECTOR", "sourceVersion": digest[:20],
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "horizontalCrs": "EPSG:4326",
        "sha256": digest, "byteLength": len(raw),
        "attribution": "Indiana Geographic Information Office; original local government agencies",
        "license": "NEEDS_LICENSE_REVIEW",
        "licenseReviewed": False,
        "reviewId": None,
        **report,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    return {"assetId": asset_id, "geojson": str(dst), "manifest": str(manifest_path),
            "count": report["sourceCount"], "sha256": digest,
            "status": "STAGED_UNVERIFIED_NOT_PUBLISHED"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, choices=sorted(SOURCES))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(stage(args.source, args.output), indent=2))


if __name__ == "__main__":
    main()
