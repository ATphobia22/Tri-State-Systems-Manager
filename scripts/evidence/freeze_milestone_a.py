#!/usr/bin/env python3
"""Freeze or verify the Posey Milestone A evidence manifest, without a network request.

A SHA-256 digest proves exact bytes, not source authority, survey accuracy, or regulatory status.
The initial tracked manifest is deliberately DRAFT_UNVERIFIED with no hashes. Do not
publish a SHA-256 receipt until the source inventory and reconciliation are complete.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
RELATIVE = Path("evidence/milestone-a")
MANIFEST = "manifest.milestone-a.json"
CHECKSUM = "manifest.milestone-a.sha256.txt"
INPUTS = ("posey_buildings_source.csv", "posey_reconciliation.csv", "posey_style.json")
SOURCE_FIELDS = ("source_object_id", "county_geoid", "source_dataset",
                 "footprint_evidence_sha256", "height_source", "height_m",
                 "vertical_datum", "acquired_at_utc")
MATCH_FIELDS = ("source_object_id", "osm_element_type", "osm_element_id",
                "geometry_iou", "match_status", "height_source",
                "decision_reason", "reviewed_at_utc")
MATCH = {"MATCHED_VERIFIED", "POSSIBLE_MATCH", "CONFLICT", "UNMATCHED"}
HEIGHT = {"OBSERVED", "DERIVED", "UNAVAILABLE"}
SHA256 = re.compile(r"^[a-f0-9]{64}$")
EXPECTED = 23082


class EvidenceError(ValueError):
    pass


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as src:
        for block in iter(lambda: src.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def read_csv(path: Path, fields: tuple[str, ...]) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as src:
        reader = csv.DictReader(src)
        if tuple(reader.fieldnames or ()) != fields:
            raise EvidenceError(f"{path.name}: unexpected CSV header")
        rows = list(reader)
    if any(None in row or any(v is None for v in row.values()) for row in rows):
        raise EvidenceError(f"{path.name}: malformed CSV columns")
    return rows


def validate_headers(folder: Path) -> None:
    read_csv(folder / INPUTS[0], SOURCE_FIELDS)
    read_csv(folder / INPUTS[1], MATCH_FIELDS)
    style = json.loads((folder / INPUTS[2]).read_text(encoding="utf-8"))
    conditions = style.get("color", {}).get("conditions")
    if not isinstance(conditions, list) or not conditions or conditions[-1][0] != "true":
        raise EvidenceError("posey_style.json must contain a neutral final fallback")
    if style.get("show") is not True:
        raise EvidenceError("posey_style.json must not silently hide unclassified buildings")


def validate_manifest(manifest: dict, *, frozen: bool) -> None:
    if manifest.get("schema_version") != "1.0.0" or manifest.get("milestone") != "A":
        raise EvidenceError("unsupported Milestone A manifest")
    scope = manifest.get("scope", {})
    if scope.get("county_geoid") != "18129":
        raise EvidenceError("Posey County exact GEOID must be 18129")
    if scope.get("expected_source_building_ids") != EXPECTED or scope.get("expected_reconciliation_rows") != EXPECTED:
        raise EvidenceError("building count target cannot be lowered")
    entries = manifest.get("frozen_inputs")
    if not isinstance(entries, list) or [e.get("path") for e in entries] != [
        str(RELATIVE / filename) for filename in INPUTS
    ]:
        raise EvidenceError("frozen input set must be the three fixed relative paths")
    expected_state = "FROZEN" if frozen else "DRAFT_UNVERIFIED"
    if manifest.get("status") != expected_state:
        raise EvidenceError(f"manifest state must be {expected_state}")
    for entry in entries:
        value = entry.get("sha256")
        if frozen:
            if not isinstance(value, str) or not SHA256.fullmatch(value):
                raise EvidenceError("frozen input SHA-256 missing or invalid")
        elif value is not None or entry.get("rows") is not None:
            raise EvidenceError("draft cannot claim input hashes or row counts")


def validate_complete(folder: Path, manifest: dict) -> dict[str, int]:
    source = read_csv(folder / INPUTS[0], SOURCE_FIELDS)
    matches = read_csv(folder / INPUTS[1], MATCH_FIELDS)
    if len(source) != EXPECTED or len(matches) != EXPECTED:
        raise EvidenceError(f"need exactly {EXPECTED} source and reconciliation rows")
    observed_ids: set[str] = set()
    heights: dict[str, str] = {}
    for row in source:
        key = row["source_object_id"].strip()
        if not key.isdigit() or key in observed_ids:
            raise EvidenceError("duplicate or invalid authoritative source OBJECTID")
        observed_ids.add(key)
        if row["county_geoid"] != "18129" or not row["source_dataset"].strip():
            raise EvidenceError("source geometry must be explicitly Posey with a dataset ID")
        digest = row["footprint_evidence_sha256"].strip().lower()
        if not SHA256.fullmatch(digest):
            raise EvidenceError("every frozen building requires its source-footprint evidence hash")
        height_source = row["height_source"]
        if height_source not in HEIGHT:
            raise EvidenceError("unsupported source height evidence class")
        if height_source == "UNAVAILABLE" and row["height_m"].strip():
            raise EvidenceError("UNAVAILABLE must not contain an inferred height")
        if height_source != "UNAVAILABLE":
            try:
                h = float(row["height_m"])
                if not math.isfinite(h) or h <= 0:
                    raise ValueError()
            except ValueError:
                raise EvidenceError("source height must be finite positive meters")
            if not row["vertical_datum"].strip():
                raise EvidenceError("source height vertical datum is mandatory")
        if not row["acquired_at_utc"].strip():
            raise EvidenceError("source acquisition timestamp is required")
        heights[key] = height_source
    reconciled: set[str] = set()
    osm_index: dict[tuple[str, str], str] = {}
    for row in matches:
        key = row["source_object_id"].strip()
        if key in reconciled or key not in observed_ids:
            raise EvidenceError("reconciliation duplicates or invents a source identity")
        reconciled.add(key)
        if row["height_source"] != heights[key] or row["match_status"] not in MATCH:
            raise EvidenceError("height provenance mismatch or invalid OSM matching state")
        status = row["match_status"]
        if status in {"MATCHED_VERIFIED", "POSSIBLE_MATCH"}:
            t, identity = row["osm_element_type"], row["osm_element_id"]
            if t not in {"way", "relation"} or not identity.isdigit():
                raise EvidenceError("OSM matches need element type and numeric ID")
            try:
                overlap = float(row["geometry_iou"])
                if not math.isfinite(overlap) or not (0 <= overlap <= 1):
                    raise ValueError()
            except ValueError:
                raise EvidenceError("OSM matches require measured geometry IoU [0, 1]")
            if status == "MATCHED_VERIFIED" and (not row["decision_reason"].strip() or not row["reviewed_at_utc"].strip()):
                raise EvidenceError("a verified match needs a reason and review time")
            osm_key = (t, identity)
            if status == "MATCHED_VERIFIED" and osm_key in osm_index:
                raise EvidenceError("OSM identifier double-matched; mark conflict for review")
            if status == "MATCHED_VERIFIED":
                osm_index[osm_key] = key
    if reconciled != observed_ids:
        raise EvidenceError("source and reconciliation OBJECTID sets differ")
    source_info = manifest.get("source", {})
    for key in ("service_url", "source_snapshot_utc", "acquisition_utc", "crs", "units"):
        if not source_info.get(key):
            raise EvidenceError(f"source metadata {key} must be supplied")
    if not str(source_info["service_url"]).startswith("https://"):
        raise EvidenceError("source service URL must use HTTPS")
    if source_info.get("license_review") != "APPROVED" or source_info.get("coverage_verification") != "VERIFIED":
        raise EvidenceError("release requires explicit source license/coverage review")
    return {INPUTS[0]: len(source), INPUTS[1]: len(matches), INPUTS[2]: 0}


def load(folder: Path) -> dict:
    return json.loads((folder / MANIFEST).read_text(encoding="utf-8"))


def freeze(folder: Path) -> None:
    if (folder / CHECKSUM).exists():
        raise EvidenceError("checksum sidecar exists: immutable receipt cannot be overwritten")
    manifest = load(folder)
    validate_manifest(manifest, frozen=False)
    validate_headers(folder)
    counts = validate_complete(folder, manifest)
    for entry, name in zip(manifest["frozen_inputs"], INPUTS):
        entry["sha256"] = sha256_file(folder / name)
        entry["rows"] = counts[name]
    manifest["status"] = "FROZEN"
    manifest["freeze_timestamp_utc"] = datetime.now(timezone.utc).isoformat()
    manifest["freeze_note"] = "SHA-256 receipt binds manifest and its three frozen local inputs, not the live ion stream."
    encoded = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()
    tmp_manifest = folder / (MANIFEST + ".tmp")
    tmp_sidecar = folder / (CHECKSUM + ".tmp")
    tmp_manifest.write_bytes(encoded)
    tmp_sidecar.write_text(digest + "  " + MANIFEST + "\n", encoding="ascii")
    tmp_manifest.replace(folder / MANIFEST)
    tmp_sidecar.replace(folder / CHECKSUM)
    print(f"FROZEN {digest}  {MANIFEST}")


def verify(folder: Path) -> None:
    manifest = load(folder)
    validate_manifest(manifest, frozen=True)
    validate_headers(folder)
    counts = validate_complete(folder, manifest)
    for entry, name in zip(manifest["frozen_inputs"], INPUTS):
        if entry["sha256"] != sha256_file(folder / name) or entry["rows"] != counts[name]:
            raise EvidenceError(f"{name}: source bytes or row count changed after freeze")
    expected = sha256_file(folder / MANIFEST) + "  " + MANIFEST + "\n"
    if not (folder / CHECKSUM).exists() or (folder / CHECKSUM).read_text(encoding="ascii") != expected:
        raise EvidenceError("Milestone A manifest SHA-256 sidecar is missing or mismatched")
    print("VERIFIED Milestone A frozen manifest + exact source identities")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--lint", action="store_true", help="validate draft structure without claiming evidence")
    modes.add_argument("--freeze", action="store_true", help="freeze only after 23,082 real source and matching rows")
    modes.add_argument("--verify", action="store_true", help="verify a completed frozen evidence receipt")
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root (testing only)")
    args = parser.parse_args()
    folder = args.root / RELATIVE
    try:
        if args.freeze:
            freeze(folder)
        elif args.verify:
            verify(folder)
        else:
            data = load(folder)
            validate_manifest(data, frozen=False)
            validate_headers(folder)
            if (folder / CHECKSUM).exists():
                raise EvidenceError("draft must not ship a SHA-256 receipt")
            print("PASS Milestone A draft schema; no building/source evidence claimed")
        return 0
    except (OSError, KeyError, ValueError, json.JSONDecodeError) as error:
        print(f"NOT VERIFIED: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
