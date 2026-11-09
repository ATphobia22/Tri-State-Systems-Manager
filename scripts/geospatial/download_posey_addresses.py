#!/usr/bin/env python3
"""Bounded Indiana GIO Posey County 2025 address-point snapshot acquisition.

This is a one-time online acquisition script. The resulting GeoJSON supports
offline repeatable spatial joins and must stay out of the public repository.
Do not conflate a state-issued address point with certified parcel location.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import requests

SERVICE = "https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2025/FeatureServer/0"
PAGE_SIZE = 1000
MAX_FEATURES = 100000
SOURCE_WHERE = "county = 'Posey County'"
FIELDS = "objectid,county,geofulladdress,geocity,geostate,geozip,valid_geo_address"


def get_json(url: str, params: dict) -> dict:
    response = requests.get(url, params=params, timeout=(10, 90), allow_redirects=False)
    response.raise_for_status()
    if not response.headers.get("Content-Type", "").lower().startswith("application/json") and "json" not in response.headers.get("Content-Type", "").lower():
        # ArcGIS occasionally returns application/geo+json or text/plain.
        if not (params.get("f") == "geojson" and "json" in response.text[:100]):
            raise ValueError("UNEXPECTED_ADDRESS_RESPONSE_CONTENT_TYPE")
    data = response.json()
    if not isinstance(data, dict) or "error" in data:
        raise ValueError("ARCGIS_ADDRESS_SERVICE_ERROR")
    return data


def download() -> tuple[dict, dict]:
    url = SERVICE + "/query"
    counted = get_json(url, {"where": SOURCE_WHERE, "returnCountOnly": "true", "f": "json"})
    expected = counted.get("count")
    if type(expected) is not int or not 0 <= expected <= MAX_FEATURES:
        raise ValueError("INVALID_OR_EXCESSIVE_ADDRESS_SOURCE_COUNT")
    features: list[dict] = []
    seen: set[int] = set()
    while len(features) < expected:
        data = get_json(url, {
            "where": SOURCE_WHERE,
            "outFields": FIELDS,
            "returnGeometry": "true",
            "outSR": "4326",
            "orderByFields": "objectid ASC",
            "resultOffset": str(len(features)),
            "resultRecordCount": str(PAGE_SIZE),
            "f": "geojson",
        })
        batch = data.get("features")
        if data.get("type") != "FeatureCollection" or not isinstance(batch, list) or not batch:
            raise ValueError("TRUNCATED_ADDRESS_SNAPSHOT")
        for feature in batch:
            p = feature.get("properties") or {}
            oid = p.get("objectid")
            if type(oid) is not int or oid in seen or p.get("county") not in ("Posey", "Posey County"):
                raise ValueError("DUPLICATED_OR_OUT_OF_SCOPE_ADDRESS")
            seen.add(oid)
        features.extend(batch)
        if len(features) > expected:
            raise ValueError("INCONSISTENT_ADDRESS_POINT_COUNT")
    if len(features) != expected or len(seen) != expected:
        raise ValueError("ADDRESS_SOURCE_SNAPSHOT_COUNT_MISMATCH")
    collection = {"type": "FeatureCollection", "features": features}
    receipt = {
        "schema": "tsm.igio-posey-address-snapshot.v1",
        "source_layer": SERVICE,
        "where": SOURCE_WHERE,
        "count_from_server": expected,
        "features_saved": len(features),
        "out_fields": FIELDS.split(","),
        "crs": "OGC:CRS84",
        "vertical_datum": "NOT_VERIFIED",
        "source_publication": "2025 Indiana Data Harvest, released March 6, 2025",
        "data_class": "OFFICIAL_PUBLIC_ADDRESS_POINT_NOT_BUILDING_FOOTPRINT",
        "not_survey_certification": True,
    }
    return collection, receipt


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--receipt", required=True, type=Path)
    args = p.parse_args()
    if args.out.resolve() == args.receipt.resolve():
        p.error("output and receipt must be separate")
    collection, receipt = download()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(collection, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf8")
    receipt["sha256"] = hashlib.sha256(args.out.read_bytes()).hexdigest()
    args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"count": receipt["features_saved"], "sha256": receipt["sha256"]}))


if __name__ == "__main__":
    main()
