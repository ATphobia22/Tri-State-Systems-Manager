#!/usr/bin/env python3
"""Read-only official Posey IGIO geometry parity gate; never certifies roof heights.

The caller supplies a SHA-256-pinned archive; all comparison data are requested
from Indiana Geographic Information Office FeatureServer layer 0. Exact JSON
geometry equality is deliberately conservative, not survey certification.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LAYER = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
PINNED_SHA256 = "d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f"
EXPECTED_COUNT = 23082
MAX_ARCHIVE_BYTES = 50_000_000
MAX_RESPONSE_BYTES = 15_000_000


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(obj: object) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def source_id(feature: dict) -> int:
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        raise ValueError("invalid source Feature record")
    props = feature.get("properties")
    if not isinstance(props, dict):
        raise ValueError("source Feature lacks attributes")
    values = [props[key] for key in ("igioObjectId", "objectid", "OBJECTID") if key in props]
    if (not values or any(type(v) is not int or v < 0 for v in values)
            or len(set(values)) != 1):
        raise ValueError("missing, invalid, or conflicting source OBJECTID")
    if feature.get("geometry", {}).get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("invalid source building polygon geometry")
    return values[0]


def request_json(url: str) -> dict:
    """Read bounded public JSON only; retries do not approve empty responses."""
    last_error = None
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "TSM-Posey-IGIO-Source-Parity/1.0"})
            with urlopen(request, timeout=50) as response:
                data = response.read(MAX_RESPONSE_BYTES + 1)
            if len(data) > MAX_RESPONSE_BYTES:
                raise ValueError("official response exceeds bounded size")
            doc = json.loads(data)
            if not isinstance(doc, dict) or "error" in doc:
                raise ValueError("official IGIO returned an error or unexpected JSON")
            return doc
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError("official IGIO request unavailable or malformed") from last_error


def get(fetch, **params):
    return fetch(LAYER + "/query?" + urlencode(params))


def metadata(fetch):
    doc = fetch(LAYER + "?f=pjson")
    if (not isinstance(doc, dict) or doc.get("id") != 0
            or doc.get("name") != "Indiana Building Footprints 2016-2020"
            or doc.get("objectIdField") not in ("objectid", None)
            or doc.get("geometryType") not in ("esriGeometryPolygon", None)
            or doc.get("hasZ") is not False):
        raise ValueError("official source layer metadata contract changed")
    stamp = (doc.get("editingInfo") or {}).get("lastEditDate")
    if type(stamp) is not int or stamp <= 0:
        raise ValueError("official source edit timestamp missing")
    return stamp


def audit(archive: Path, fetch, expected_sha256: str = PINNED_SHA256,
          *, expected_count: int = EXPECTED_COUNT, batch_size: int = 500) -> dict:
    if not 1 <= batch_size <= 1000 or not 1 <= expected_count <= 100_000:
        raise ValueError("invalid bounded batch size or expected count")
    if archive.is_symlink() or not archive.is_file() or archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("pinned IGIO archive is missing or too large")
    raw = archive.read_bytes()
    digest = sha256(raw)
    if digest != expected_sha256:
        raise ValueError("pinned archive SHA-256 mismatch (no live fetch permitted)")
    doc = json.loads(raw)
    if doc.get("type") != "FeatureCollection" or len(doc.get("features", [])) != expected_count:
        raise ValueError("pinned archive FeatureCollection/count mismatch")
    indexed = {}
    for feature in doc["features"]:
        oid = source_id(feature)
        if oid in indexed:
            raise ValueError("pinned archive contains duplicate IDs")
        indexed[oid] = feature

    edit_start = metadata(fetch)
    count = get(fetch, where="county='Posey'", returnCountOnly="true", f="pjson")
    id_response = get(fetch, where="county='Posey'", returnIdsOnly="true", f="pjson")
    ids = id_response.get("objectIds")
    if (id_response.get("objectIdFieldName") != "objectid" or not isinstance(ids, list)
            or any(type(v) is not int or v < 0 for v in ids) or len(ids) != len(set(ids))
            or type(count.get("count")) is not int or count["count"] != len(ids)):
        raise ValueError("official Posey identity response is invalid or partial")
    live_set = set(ids)
    archive_set = set(indexed)
    report = {
        "schemaVersion": "tsm.posey.igio-live-geometry-parity.v1",
        "sourceAuthority": "Indiana Geographic Information Office",
        "sourceLayer": LAYER,
        "checkedAtUtc": datetime.now(timezone.utc).isoformat(),
        "sourceEditDateMs": edit_start,
        "geometryRequestedCrs": "EPSG:4326",
        "archiveSha256": digest,
        "archiveFeatureCount": len(indexed),
        "sourceFeatureCount": len(ids),
        "sourceIdSha256": sha256(json.dumps(sorted(ids), separators=(",", ":")).encode()),
        "matchedGeometryCount": 0,
        "geometryMismatchObjectIds": [],
        "lidarYearMismatchObjectIds": [],
        "countyMismatchObjectIds": [],
        "liveOnlyIds": sorted(live_set - archive_set),
        "archivedOnlyIds": sorted(archive_set - live_set),
        "geometryTypes": {},
        "engineeringUse": False,
        "regulatoryUse": False,
        "heightVerified": False,
        "datumVerified": False,
        "surveyCertified": False,
        "notice": "Live 2D polygon/identity comparison only; not building height, geodesy, survey, or 3D Tiles certification",
    }
    if live_set != archive_set or len(ids) != expected_count:
        report["status"] = "SOURCE_IDENTITY_DRIFT"
        return report

    types = Counter()
    for start in range(0, len(ids), batch_size):
        batch = sorted(ids)[start:start+batch_size]
        fresh = get(fetch, objectIds=",".join(map(str, batch)), outFields="objectid,county,lidaryear",
                    returnGeometry="true", outSR="4326", f="geojson")
        if fresh.get("type") != "FeatureCollection" or not isinstance(fresh.get("features"), list):
            raise ValueError("live IGIO geometry batch is malformed")
        fetched = {}
        for ft in fresh["features"]:
            oid = source_id(ft)
            if oid in fetched:
                raise ValueError("duplicate live OBJECTID in geometry page")
            fetched[oid] = ft
        if set(fetched) != set(batch):
            raise ValueError("missing, extra, or partial live geometry page")
        for oid in batch:
            live = fetched[oid]
            prior = indexed[oid]
            types[live["geometry"]["type"]] += 1
            if live["geometry"] == prior["geometry"]:
                report["matchedGeometryCount"] += 1
            else:
                report["geometryMismatchObjectIds"].append(oid)
            for key, dest in (("county", "countyMismatchObjectIds"), ("lidaryear", "lidarYearMismatchObjectIds")):
                if live["properties"].get(key) != prior["properties"].get(key):
                    report[dest].append(oid)
    report["geometryTypes"] = dict(types)
    edit_end = metadata(fetch)
    report["sourceEditDateEndMs"] = edit_end
    if edit_end != edit_start:
        report["status"] = "SOURCE_CHANGED_DURING_AUDIT"
    elif (report["geometryMismatchObjectIds"] or report["countyMismatchObjectIds"]
          or report["lidarYearMismatchObjectIds"]):
        report["status"] = "SOURCE_GEOMETRY_OR_ATTRIBUTE_DRIFT"
    else:
        report["status"] = "LIVE_GEOMETRY_EQUALS_PINNED_SOURCE"
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--expected-sha256", default=PINNED_SHA256)
    parser.add_argument("--expected-count", default=EXPECTED_COUNT, type=int)
    args = parser.parse_args()
    if args.archive.resolve() == args.receipt.resolve():
        parser.error("archive and receipt paths must differ")
    report = audit(args.archive, request_json, args.expected_sha256, expected_count=args.expected_count)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(report, indent=2, sort_keys=True) + "\n"
    with tempfile.NamedTemporaryFile(dir=args.receipt.parent, mode="w", encoding="utf-8", delete=False) as stream:
        tmp = Path(stream.name)
        stream.write(payload)
    os.replace(tmp, args.receipt)
    print(json.dumps({k: report[k] for k in ("status", "archiveFeatureCount", "sourceFeatureCount", "matchedGeometryCount")}))
    return 0 if report["status"] == "LIVE_GEOMETRY_EQUALS_PINNED_SOURCE" else 1


if __name__ == "__main__":
    raise SystemExit(main())
