#!/usr/bin/env python3
"""Reproducible official IGIO Posey footprint inventory and evidence receipts.

This is a *source identity* gate independent of 3D reconstruction. A valid
footprint is not evidence of a roof height, DEM sample, survey, or BFE.
The live inventory is discovered from the Indiana service, not a fixed count.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LAYER = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
WHERE = "county='Posey'"
HEX = re.compile(r"^[0-9a-f]{64}$")
MAX_RESPONSE = 48 * 1024 * 1024


def canonical(obj: object) -> bytes:
    return (json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
            + "\n").encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def request_json(path: str, params: dict[str, object]) -> tuple[dict, dict]:
    """Only the fixed official HTTPS host; never dereference URLs from responses."""
    url = LAYER + path
    if not url.startswith("https://gisdata.in.gov/"):
        raise ValueError("Refusing non-government source")
    query = urllib.parse.urlencode(sorted(params.items()))
    request = urllib.request.Request(
        url + "?" + query,
        headers={"User-Agent": "TSM-Official-Source-Receipt/1.0", "Accept": "application/json"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read(MAX_RESPONSE + 1)
                if len(data) > MAX_RESPONSE:
                    raise ValueError("Official response exceeds bounded input")
                if response.status != 200:
                    raise ValueError("Unexpected official HTTP response")
            payload = json.loads(data)
            if not isinstance(payload, dict) or "error" in payload:
                raise ValueError("Official ArcGIS response reported an error")
            return payload, {"request": request.full_url, "bytes": len(data),
                             "sha256": digest(data)}
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == 2:
                raise RuntimeError("Official IGIO endpoint unavailable") from exc
            time.sleep(2 ** attempt)
    raise AssertionError("Unreachable")


def validate_ids(ids: object, count: object) -> list[int]:
    """Two independently requested response modes must agree."""
    if type(count) is not int or count < 1:
        raise ValueError("Official query count missing or invalid")
    if not isinstance(ids, list) or len(ids) != count:
        raise ValueError("Official count differs from the OBJECTID inventory")
    if any(type(value) is not int or value < 0 for value in ids):
        raise ValueError("Official source IDs are malformed")
    if len(set(ids)) != count:
        raise ValueError("Official OBJECTID inventory contains duplicates")
    return sorted(ids)


def validate_snapshot(path: Path, official_ids: list[int]) -> dict:
    """Byte-pin an optionally supplied original/derived GeoJSON and compare IDs.

    A submitted GeoJSON may be transformed, clipped or enriched. It must not
    be relabelled as byte-identical raw government geometry.
    """
    if path.is_symlink() or not path.is_file():
        raise ValueError("Snapshot is not an ordinary local file")
    size = path.stat().st_size
    if not 0 < size <= 512 * 1024 * 1024:
        raise ValueError("Snapshot is empty or exceeds bounded size")
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    with path.open(encoding="utf-8") as stream:
        doc = json.load(stream)
    if doc.get("type") != "FeatureCollection" or not isinstance(doc.get("features"), list):
        raise ValueError("Snapshot is not a GeoJSON FeatureCollection")
    observed = []
    for feat in doc["features"]:
        if not isinstance(feat, dict) or feat.get("type") != "Feature":
            raise ValueError("Malformed GeoJSON feature")
        prop = feat.get("properties")
        if not isinstance(prop, dict) or prop.get("county") not in ("Posey", None):
            raise ValueError("Invalid county metadata")
        oid = prop.get("igioObjectId", prop.get("objectid"))
        if type(oid) is not int or oid < 0:
            raise ValueError("Missing source OBJECTID")
        if "igioObjectId" in prop and "objectid" in prop and prop["igioObjectId"] != prop["objectid"]:
            raise ValueError("Conflicting source OBJECTID aliases")
        if not isinstance(feat.get("geometry"), dict) or feat["geometry"].get("type") not in ("Polygon", "MultiPolygon"):
            raise ValueError("Source footprint geometry absent or nonpolygon")
        observed.append(oid)
    same = len(observed) == len(set(observed)) and sorted(observed) == official_ids
    return {
        "path": path.name,
        "size_bytes": size,
        "sha256": h.hexdigest(),
        "unique_objectids": len(set(observed)),
        "identity_complete": same,
        "data_class": "LOCAL_SNAPSHOT_REQUIRES_GEOMETRY_PROVENANCE_REVIEW",
        "survey_certified": False,
    }


def download_geometry(ids: list[int], directory: Path) -> list[dict]:
    """Acquire exact source response bytes in bounded, ID-keyed pages.

    Each batch includes source IDs, county, lidar year and raw geometry. All
    expected IDs must appear exactly once; counts are not sourced from a
    historical constant. No silent truncation or placeholder geometry.
    """
    directory.mkdir(parents=True, exist_ok=True)
    records = []
    seen = set()
    for start in range(0, len(ids), 200):
        batch = ids[start:start + 200]
        response, receipt = request_json("/query", {
            "f": "json", "objectIds": ",".join(map(str, batch)),
            "outFields": "objectid,county,lidaryear",
            "returnGeometry": "true", "outSR": 4326,
        })
        feats = response.get("features")
        if not isinstance(feats, list) or len(feats) != len(batch):
            raise ValueError("Geometry response missing one or more requested OBJECTIDs")
        found = []
        for feature in feats:
            attrs = feature.get("attributes", {})
            ident = attrs.get("objectid")
            if type(ident) is not int or ident not in batch or ident in seen:
                raise ValueError("Unexpected, missing or duplicated geometry OBJECTID")
            if attrs.get("county") != "Posey" or not feature.get("geometry"):
                raise ValueError("Geometry response has missing geometry or incorrect county")
            found.append(ident)
            seen.add(ident)
        if set(found) != set(batch):
            raise ValueError("Geometry batch is not identity-complete")
        path = directory / f"igio-posey-{start:06d}-{start + len(batch) - 1:06d}.json"
        if path.exists():
            raise FileExistsError("Refusing to overwrite existing source evidence")
        raw = canonical(response)
        path.write_bytes(raw)
        records.append({"file": path.name, "sha256": digest(raw), "bytes": len(raw),
                        "object_id_count": len(batch),
                        "response_sha256": receipt["sha256"],
                        "query_url": receipt["request"],
                        "representation": "NORMALIZED_ARCGIS_JSON_FROM_OFFICIAL_RESPONSE"})
    if seen != set(ids):
        raise ValueError("Downloaded geometry does not cover the source ID inventory")
    return records


def build_inventory(*, snapshot: Path | None = None, geometry_dir: Path | None = None) -> dict:
    layer, layer_receipt = request_json("", {"f": "json"})
    oid_field = layer.get("objectIdField") or layer.get("objectIdFieldName")
    if oid_field != "objectid" or layer.get("hasZ") is not False:
        raise ValueError("Source feature schema or dimensionality changed")
    if layer.get("name") != "Indiana Building Footprints 2016-2020":
        raise ValueError("Unexpected Indiana footprint layer")
    counted, count_receipt = request_json("/query", {
        "f": "json", "where": WHERE, "returnCountOnly": "true",
    })
    identified, ids_receipt = request_json("/query", {
        "f": "json", "where": WHERE, "returnIdsOnly": "true",
    })
    ids = validate_ids(identified.get("objectIds"), counted.get("count"))
    if identified.get("objectIdFieldName") not in ("objectid", "OBJECTID"):
        raise ValueError("Official ID field changed")
    version = layer.get("editingInfo", {}).get("lastEditDate")
    if not isinstance(version, int):
        raise ValueError("Official layer version timestamp missing; cannot prove stable snapshot")
    receipts = {"metadata": layer_receipt, "count": count_receipt, "ids": ids_receipt}
    snapshot_result = validate_snapshot(snapshot, ids) if snapshot else None
    geometry = download_geometry(ids, geometry_dir) if geometry_dir else None
    after, after_receipt = request_json("", {"f": "json"})
    if after.get("editingInfo", {}).get("lastEditDate") != version:
        raise ValueError("Official feature service changed during acquisition")
    receipts["metadata_after"] = after_receipt
    result = {
        "schema_version": "tsm.indiana-posey-source-inventory.v1",
        "generated_utc": utc_now(), "county": "Posey", "state": "Indiana",
        "source": LAYER, "source_dataset": layer["name"],
        "source_has_z": False, "source_crs_wkid": layer["spatialReference"].get("latestWkid", layer["spatialReference"].get("wkid")),
        "source_last_edit_epoch_ms": version,
        "source_filter": WHERE, "source_objectid_field": "objectid",
        "official_feature_count": len(ids),
        "official_sorted_objectids_sha256": digest(canonical(ids)),
        "official_response_receipts": receipts,
        "snapshot": snapshot_result,
        "downloaded_geometry_pages": geometry,
        "source_identity_complete": True,
        "geometry_download_complete": geometry is not None,
        "local_snapshot_identity_complete": bool(snapshot_result and snapshot_result["identity_complete"]),
        "heights_complete": False, "dem_coverage_verified": False,
        "survey_grade": False, "regulatory_use": False,
        "classification": "GOVERNMENT_SOURCE_IDENTITY_VERIFIED_ONLY",
    }
    return result


def write_sealed(receipt: dict, output: Path) -> str:
    """Content-addressed receipt, SHA-256 sidecar, no fabricated signature."""
    if output.exists() or output.with_suffix(output.suffix + ".sha256").exists():
        raise FileExistsError("Evidence is immutable; use a new versioned path")
    output.parent.mkdir(parents=True, exist_ok=True)
    data = canonical(receipt)
    output.write_bytes(data)
    hash_hex = digest(data)
    output.with_suffix(output.suffix + ".sha256").write_text(
        f"{hash_hex}  {output.name}\n", encoding="ascii"
    )
    return hash_hex


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--snapshot", type=Path, help="Optional existing ID-bearing GeoJSON")
    p.add_argument("--geometry-dir", type=Path, help="Download and hash all official geometry pages")
    a = p.parse_args()
    receipt = build_inventory(snapshot=a.snapshot, geometry_dir=a.geometry_dir)
    value = write_sealed(receipt, a.output)
    print(json.dumps({
        "status": receipt["classification"],
        "source_count": receipt["official_feature_count"],
        "geometry_pages": len(receipt["downloaded_geometry_pages"] or []),
        "receipt_sha256": value,
        "receipt_path": str(a.output),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
