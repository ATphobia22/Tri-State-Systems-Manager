#!/usr/bin/env python3
"""Acquire a deterministic Posey County parcel GeoJSON snapshot from XSoft ArcGIS.

The snapshot is a delivery artifact for the browser console, not a replacement
for authoritative county records. Source geometry remains attributed to XSoft;
WTH GIS is retained only as a property-record cross-reference.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SOURCE_LAYER = (
    "https://services6.arcgis.com/y6TIO0vqbm8Ixd4w/ArcGIS/rest/services/"
    "Posey_Parcels_(Public)/FeatureServer/0"
)
PAGE_SIZE = 2000
MAX_FEATURES = 100_000
TIMEOUT_SECONDS = 45


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_page(offset: int) -> dict:
    query = urlencode(
        {
            "where": "1=1",
            "outFields": "StateCombi,Parcel,ParcelID,CALC_ACRES,Section,Township,Range",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultRecordCount": PAGE_SIZE,
            "resultOffset": offset,
            "f": "geojson",
        }
    )
    request = Request(
        f"{SOURCE_LAYER}/query?{query}",
        headers={"Accept": "application/geo+json, application/json"},
    )
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        payload = json.load(response)
    if payload.get("type") != "FeatureCollection":
        raise RuntimeError("XSoft response is not a GeoJSON FeatureCollection")
    return payload


def validate_feature(feature: object) -> None:
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        raise RuntimeError("parcel feature is not a GeoJSON Feature")
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
        raise RuntimeError("parcel feature has unsupported geometry")
    if not geometry.get("coordinates"):
        raise RuntimeError("parcel feature has empty geometry")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    features: list[dict] = []
    retrieved_at = utc_now()

    for offset in range(0, MAX_FEATURES, PAGE_SIZE):
        payload = fetch_page(offset)
        page = payload.get("features", [])
        if not isinstance(page, list):
            raise RuntimeError("XSoft page features is not a list")
        for feature in page:
            validate_feature(feature)
        features.extend(page)
        if len(features) > MAX_FEATURES:
            raise RuntimeError("Posey parcel snapshot exceeded feature budget")
        if len(page) < PAGE_SIZE:
            break
        time.sleep(0.05)
    else:
        raise RuntimeError("Posey parcel snapshot reached the hard feature limit")

    if not features:
        raise RuntimeError("Posey parcel snapshot is empty")

    collection = {
        "type": "FeatureCollection",
        "features": features,
        "sourceCrs": "EPSG:4326",
        "sourceAuthority": "Posey County XSoft Engage ArcGIS parcel geometry",
        "recordCrossReference": "Posey County WTH GIS",
        "sourceUri": f"{SOURCE_LAYER}/query",
        "retrievedAt": retrieved_at,
        "featureCount": len(features),
        "humanReviewRequired": True,
        "provisional": True,
    }
    encoded = (json.dumps(collection, sort_keys=True, separators=(",", ":")) + "\n").encode()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    print(json.dumps({"ok": True, "features": len(features), "sha256": digest, "out": str(args.out)}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
