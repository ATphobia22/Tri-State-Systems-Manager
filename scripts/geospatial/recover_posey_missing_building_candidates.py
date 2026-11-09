#!/usr/bin/env python3
"""Retrieve ONLY missing Posey footprint IDs from Indiana's live LiDAR-derived service.

The archived 23,082-object source is a separately pinned release artifact. Modern
FeatureServer OBJECTIDs can change: recovered candidates are never merged or
declared identical without geometry/vintage and identity review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SERVICE = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0/query"
ITEM_ID = "384f2d5041a14c34bd9e807c568784da"
DELTA = Path(__file__).resolve().parents[2] / "data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json"
MAX_RESPONSE_BYTES = 15_000_000


def recover_missing_ids(delta_path: Path, output: Path, fetch=None) -> dict:
    record = json.loads(delta_path.read_text(encoding="utf8"))
    missing = record["missingArchivedSourceObjectIds"]
    if (record["status"] != "RECONCILIATION_INCOMPLETE"
            or record["sourceFeatureCount"] != 23082
            or record["idDifferenceCount"] != len(missing)
            or not missing or len(missing) != len(set(missing))
            or not all(isinstance(i, int) and i > 0 for i in missing)):
        raise ValueError("POSEY_RECONCILIATION_DELTA_INVALID")
    if output.exists():
        raise FileExistsError("OUTPUT_ALREADY_EXISTS")
    results: list[dict] = []
    query_urls: list[str] = []
    for start in range(0, len(missing), 75):
        ids = missing[start:start + 75]
        query = urlencode({
            "objectIds": ",".join(map(str, ids)),
            "outFields": "objectid,county,lidaryear",
            "returnGeometry": "true", "outSR": "4326", "f": "geojson",
        })
        url = SERVICE + "?" + query
        query_urls.append(url)
        if fetch is None:
            with urlopen(Request(url, headers={"User-Agent": "TSM-Posey-Source-Reconciliation/1.0"}),
                         timeout=30) as response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
        else:
            raw = fetch(url)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ValueError("OFFICIAL_BUILDING_RESPONSE_TOO_LARGE")
        payload = json.loads(raw)
        if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
            raise ValueError("OFFICIAL_BUILDING_RESPONSE_INVALID")
        for feature in payload.get("features", []):
            if not isinstance(feature, dict) or feature.get("type") != "Feature":
                raise ValueError("OFFICIAL_BUILDING_FEATURE_INVALID")
            attrs = feature.get("properties")
            if not isinstance(attrs, dict) or "objectid" not in attrs:
                raise ValueError("OFFICIAL_OBJECTID_MISSING")
            object_id = attrs["objectid"]
            if not isinstance(object_id, int) or object_id not in ids:
                raise ValueError("OFFICIAL_OBJECTID_UNREQUESTED")
            if str(attrs.get("county", "")).strip().casefold() != "posey":
                raise ValueError("OFFICIAL_COUNTY_NOT_POSEY")
            if not isinstance(feature.get("geometry"), dict):
                raise ValueError("OFFICIAL_BUILDING_GEOMETRY_MISSING")
            results.append(feature)
    ids_returned = [f["properties"]["objectid"] for f in results]
    if len(ids_returned) != len(set(ids_returned)):
        raise ValueError("OFFICIAL_BUILDING_DUPLICATE_OBJECTID")
    missing_live = sorted(set(missing) - set(ids_returned))
    features = sorted(results, key=lambda f: f["properties"]["objectid"])
    body = json.dumps({"type": "FeatureCollection", "features": features},
                      sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    provenance = {
        "schemaVersion": "tsm.posey.live-building-candidate.v1",
        "sourceLayer": SERVICE.rsplit("/", 1)[0], "sourceItemId": ITEM_ID,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "archivedSourceHash": record["sourceAssetSha256"],
        "archivedSourceCount": 23082,
        "missingArchivedIdsRequested": len(missing),
        "retrievedLiveCandidates": len(features), "notReturnedFromLiveService": missing_live,
        "sha256": hashlib.sha256(body).hexdigest(), "byteLength": len(body),
        "validationStatus": "UNVERIFIED",
        "engineeringUse": False, "regulatoryUse": False,
        "approvalStatus": "NOT_EVIDENCED",
        "notice": "Live service candidates are NOT the archived source. Recheck IDs, geometries, lidar year and heights before publishing.",
        "queries": query_urls,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        stream.write(body)
    Path(str(output) + ".provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf8")
    return provenance


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--delta", type=Path, default=DELTA)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(recover_missing_ids(args.delta, args.output), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
