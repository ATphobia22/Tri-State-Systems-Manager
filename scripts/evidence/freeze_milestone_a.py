#!/usr/bin/env python3
"""Create a detached SHA256 evidence receipt for real Posey source files.

This makes no claim about independent geometry or vertical-datum verification.
Cloud asset IDs are context, never immutable geometry source hashes.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

CHUNK = 1024 * 1024
SHA = re.compile(r"^[0-9a-fA-F]{64}$")
COMMIT = re.compile(r"^[0-9a-fA-F]{40}$")
STATUSES = frozenset({"MATCHED_GEOMETRY_VERIFIED", "MATCHED_CANDIDATE",
                      "GEOMETRY_CONFLICT", "NO_OSM_MATCH", "SOURCE_UNAVAILABLE"})
FIELDS = {
    "official_source_csv": ("source_object_id", "county_geoid", "source_agency",
        "source_dataset_id", "source_vintage", "source_crs", "source_geometry_sha256",
        "height_m", "height_source", "vertical_datum", "record_source_url"),
    "published_buildings_csv": ("source_object_id", "tileset_content_uri",
        "published_geometry_sha256", "height_source"),
    "posey_reconciliation_csv": ("source_object_id", "osm_element_type",
        "osm_element_id", "match_status", "geometry_confidence",
        "source_geometry_sha256", "osm_geometry_sha256",
        "geometry_validation_receipt_sha256", "height_source", "notes"),
}

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for data in iter(lambda: source.read(CHUNK), b""):
            digest.update(data)
    return digest.hexdigest()

def read_csv(path: Path, role: str) -> tuple[set[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != list(FIELDS[role]):
            raise ValueError(role + ": unexpected CSV headers")
        rows = list(reader)
    if not rows:
        raise ValueError(role + ": no real records; template is not evidence")
    ids: set[str] = set()
    for row in rows:
        key = (row.get("source_object_id") or "").strip()
        if not re.fullmatch(r"[1-9][0-9]*", key):
            raise ValueError(role + ": invalid source ID")
        if key in ids:
            raise ValueError(role + ": duplicate source ID: " + key)
        ids.add(key)
        if None in row or any("\x00" in (val or "") for val in row.values()):
            raise ValueError(role + ": invalid CSV row")
        if role == "official_source_csv":
            if row["county_geoid"] != "18129":
                raise ValueError("source must be Posey County GEOID 18129")
            if not all(row[x] for x in ("source_agency", "source_dataset_id", "source_crs")):
                raise ValueError("agency, source dataset and declared CRS required")
            if not SHA.fullmatch(row["source_geometry_sha256"].strip()):
                raise ValueError("source geometry SHA256 missing or invalid")
        if role == "posey_reconciliation_csv":
            status = row["match_status"]
            if status not in STATUSES:
                raise ValueError("unknown match_status: " + status)
            osm_type = row["osm_element_type"].strip()
            osm_id = row["osm_element_id"].strip()
            if bool(osm_type) != bool(osm_id) or (osm_type and
                 (osm_type not in ("node", "way", "relation") or not re.fullmatch(r"[1-9][0-9]*", osm_id))):
                raise ValueError("OSM identity must include type and numeric element ID")
            if status.startswith("MATCHED_") and not osm_type:
                raise ValueError("matched record without actual OSM identity")
            if status == "MATCHED_GEOMETRY_VERIFIED":
                if not all(SHA.fullmatch(row[k].strip()) for k in (
                        "source_geometry_sha256", "osm_geometry_sha256",
                        "geometry_validation_receipt_sha256")):
                    raise ValueError("verified geometry requires source hashes and independent receipt")
    return ids, rows

def freeze(source_csv: Path, published_csv: Path, reconciliation_csv: Path,
           style: Path, out_dir: Path, commit: str, source_uri: str,
           retrieved_at: str, expected_source_count: int | None = None) -> dict:
    if not COMMIT.fullmatch(commit):
        raise ValueError("40-character immutable TSM source commit required")
    if not source_uri.startswith("https://"):
        raise ValueError("official source URI must be HTTPS")
    try:
        stamp = datetime.fromisoformat(retrieved_at.replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            raise ValueError("timezone missing")
    except ValueError as error:
        raise ValueError("retrieval timestamp must include timezone") from error
    files = {"official_source_csv": source_csv, "published_buildings_csv": published_csv,
             "posey_reconciliation_csv": reconciliation_csv,
             "reconciliation_overlay_style": style}
    for role, file in files.items():
        if not file.is_file() or not file.stat().st_size:
            raise ValueError(role + ": missing or empty input")
    records = {role: read_csv(files[role], role) for role in FIELDS}
    source = records["official_source_csv"][0]
    pub = records["published_buildings_csv"][0]
    recon = records["posey_reconciliation_csv"][0]
    if expected_source_count is not None and len(source) != expected_source_count:
        raise ValueError("official source count does not match expected target")
    if not pub.issubset(source):
        raise ValueError("published IDs absent from official source")
    if recon != source:
        raise ValueError("reconciliation requires exactly one row per source building")
    verified = [row for row in records["posey_reconciliation_csv"][1]
                if row["match_status"] == "MATCHED_GEOMETRY_VERIFIED"]
    osm_ids = [(row["osm_element_type"], row["osm_element_id"]) for row in verified]
    if len(set(osm_ids)) != len(verified):
        raise ValueError("one verified OSM element mapped to multiple source buildings")
    style_doc = json.loads(style.read_text(encoding="utf-8"))
    if not isinstance(style_doc, dict) or not isinstance(style_doc.get("color"), dict) or \
       not isinstance(style_doc["color"].get("conditions"), list):
        raise ValueError("invalid Cesium 3D Tiles styling format")
    if out_dir.exists() and any(out_dir.iterdir()):
        raise ValueError("frozen output may not be overwritten")
    inputs = []
    for role, file in files.items():
        inputs.append({"role": role, "sourceFileBasename": file.name,
                       "sha256": sha256_file(file), "sizeBytes": file.stat().st_size,
                       "rowCount": len(records[role][1]) if role in records else None})
    manifest = {
        "schema": "tsm.posey.milestone-a.v1",
        "status": "INPUT_BYTES_FROZEN_NOT_GEOMETRICALLY_CERTIFIED",
        "scope": {"countyGEOID": "18129", "expectedInventoryCount": expected_source_count,
                  "observedSourceCount": len(source), "observedPublishedCount": len(pub),
                  "observedReconciliationCount": len(recon)},
        "source": {"uri": source_uri, "retrievedAt": retrieved_at,
                   "horizontalCRSVerified": False, "verticalDatumVerified": False},
        "code": {"repository": "ATphobia22/Tri-State-Systems-Manager", "commit": commit},
        "external": {"cesiumOsmBuildingsAssetId": 96188,
                     "cesiumWorldBathymetryAssetId": 2426648,
                     "remoteAssetBytesFrozen": False,
                     "privateUnrealSourceBuiltAndVerified": False},
        "inputs": inputs, "independentGeometryVerified": False,
        "completeLoD2LoD4Verified": False,
        "regulatoryUseApproved": False, "humanAuthorityFinal": True,
    }
    frozen = (json.dumps(manifest, sort_keys=True, ensure_ascii=False,
                         separators=(",", ":")) + "\n").encode("utf-8")
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "manifest.milestone-a.json"
    with path.open("xb") as f:
        f.write(frozen)
    with (out_dir / "manifest.milestone-a.sha256.txt").open("x", encoding="ascii") as f:
        f.write(hashlib.sha256(frozen).hexdigest() + "  " + path.name + "\n")
    return manifest

def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    for flag in ("source-csv", "published-csv", "reconciliation-csv", "style", "out-dir"):
        cli.add_argument("--" + flag, type=Path, required=True)
    for flag in ("tsm-commit", "source-uri", "source-retrieved-at"):
        cli.add_argument("--" + flag, required=True)
    cli.add_argument("--expected-source-count", type=int)
    a = cli.parse_args()
    result = freeze(a.source_csv, a.published_csv, a.reconciliation_csv,
                    a.style, a.out_dir, a.tsm_commit, a.source_uri,
                    a.source_retrieved_at, a.expected_source_count)
    print("Frozen", result["scope"]["observedSourceCount"],
          "real source IDs; manifest SHA-256 stored separately in", a.out_dir)

if __name__ == "__main__":
    main()
