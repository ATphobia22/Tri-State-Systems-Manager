#!/usr/bin/env python3
"""Build six county-scoped, offline, review-only historical flood evidence inventories.

No network, no fake elevation or footprints, no regulatory/NFIP eligibility.
Attaches local evidence only after content SHA-256 verification. No overwrites.
"""
from __future__ import annotations

import argparse
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import sys

COUNTY_FIPS = ("18129", "21101", "21225", "17059", "17185", "17193")
EVIDENCE_CLASSES = (
    "historical_regulatory_map", "building_footprints", "bfe_fis",
    "terrain", "event_measurement", "administrative",
)
SHA256 = re.compile(r"[a-fA-F0-9]{64}\Z")
UTC_TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\Z")


def _date(value: str, label: str) -> date:
    if not isinstance(value, str):
        raise ValueError(label + " must be a YYYY-MM-DD date")
    try:
        result = date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(label + " has invalid calendar date") from error
    if result.isoformat() != value:
        raise ValueError(label + " must be ISO YYYY-MM-DD")
    return result


def validate_catalog(catalog: dict) -> None:
    if not isinstance(catalog, dict) or catalog.get("schema") != (
            "tsm-tri-state-historical-flood-source-catalog"):
        raise ValueError("Wrong historical flood catalog schema")
    counties = catalog.get("counties")
    sources = catalog.get("sources")
    events = catalog.get("events")
    editions = catalog.get("map_editions")
    if not all(isinstance(x, list) and x for x in (counties, sources, events)):
        raise ValueError("Catalog requires nonempty counties, sources and events")
    if not isinstance(editions, list):
        raise ValueError("map_editions must be a list")
    county_ids = [x["fips"] for x in counties]
    source_ids = [x["id"] for x in sources]
    event_ids = [x["id"] for x in events]
    if any(not isinstance(x, str) or not x for x in county_ids + source_ids + event_ids):
        raise ValueError("Empty or nonstring catalog identifiers")
    if (len(set(county_ids)) != len(county_ids)
            or len(set(source_ids)) != len(source_ids)
            or len(set(event_ids)) != len(event_ids)):
        raise ValueError("Duplicate county, source or event IDs")
    if not set(COUNTY_FIPS).issubset(county_ids):
        raise ValueError("One or more required Tri-State counties are absent")
    for source in sources:
        if not isinstance(source.get("counties"), list):
            raise ValueError("Source county scopes must be explicit lists")
        if set(source["counties"]) - set(county_ids):
            raise ValueError("Source references an unknown county")
        if not (isinstance(source.get("url"), str)
                and source["url"].startswith("https://")):
            raise ValueError("Every catalog source requires an HTTPS authority URL")
    for event in events:
        if event.get("source_id") not in source_ids:
            raise ValueError("Event missing authoritative source reference")
        if _date(event["start_date"], "event.start_date") > _date(
                event["end_date"], "event.end_date"):
            raise ValueError("Event start cannot be after end")
    for edition in editions:
        if edition.get("county_fips") not in county_ids:
            raise ValueError("Map edition references unknown county")
        if edition.get("source_id") not in source_ids:
            raise ValueError("Map edition references unknown source")
        _date(edition["effective_date"], "edition.effective_date")


def _asset_fingerprint(base_dir: Path, relative_path: str) -> tuple[str, int]:
    if not isinstance(relative_path, str) or not relative_path:
        raise ValueError("Asset relative path missing")
    path = Path(relative_path)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError("Asset paths must remain inside the evidence root")
    root = base_dir.resolve(strict=True)
    target = (root / path).resolve(strict=True)
    if not target.is_relative_to(root) or not target.is_file() or target.is_symlink():
        raise ValueError("Asset must be a regular file below the evidence root")
    digest = hashlib.sha256()
    size = 0
    with target.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def build_county_bundle(catalog: dict, county_fips: str, asset_rows: list,
                        artifact_root: Path, as_of_utc: str) -> dict:
    validate_catalog(catalog)
    if not UTC_TIMESTAMP.fullmatch(as_of_utc):
        raise ValueError("as_of_utc must be a timestamp ending in Z")
    counties = {c["fips"]: c for c in catalog["counties"]}
    sources = {s["id"]: s for s in catalog["sources"]}
    events = {e["id"]: e for e in catalog["events"]}
    if county_fips not in counties:
        raise ValueError("Unknown Tri-State county FIPS")
    if not isinstance(asset_rows, list):
        raise ValueError("Asset manifest must be a list")
    selected = []
    for row in asset_rows:
        if not isinstance(row, dict):
            raise ValueError("Asset manifest records must be objects")
        if row.get("county_fips") != county_fips:
            continue
        event_id, source_id = row.get("event_id"), row.get("source_id")
        if event_id not in events or source_id not in sources:
            raise ValueError("Asset event or source not in approved catalog")
        source = sources[source_id]
        if source["counties"] and county_fips not in source["counties"]:
            raise ValueError("Asset source is outside county coverage")
        kind = row.get("evidence_type")
        if kind not in EVIDENCE_CLASSES:
            raise ValueError("Unsupported evidence class")
        if source["spatial_authority"] == "NONE_ADMINISTRATIVE":
            if kind != "administrative":
                raise ValueError("Administrative source is not parcel geometry")
            if set(row).intersection({"parcel_id", "building_id", "personal_address",
                                       "policy_number", "claim_number"}):
                raise ValueError("No NFIP person/parcel reidentification fields")
        declared_hash = row.get("sha256", "")
        if not isinstance(declared_hash, str) or not SHA256.fullmatch(declared_hash):
            raise ValueError("Valid declared SHA-256 hash is required")
        computed_hash, size = _asset_fingerprint(
            artifact_root, row.get("relative_path"))
        if computed_hash != declared_hash.lower():
            raise ValueError("Evidence SHA-256 hash mismatch")
        effective = row.get("effective_date")
        if effective is not None:
            _date(effective, "asset.effective_date")
        if row.get("claim_used_during_event") is True:
            if effective is None:
                raise ValueError("Cannot claim map used during event without effective date")
            if _date(effective, "asset.effective_date") > _date(
                    events[event_id]["end_date"], "event.end_date"):
                raise ValueError("Map postdates the flood event")
            # Even with temporal plausibility, only an agency can establish past use.
            if not row.get("agency_use_evidence_url"):
                raise ValueError("Historical agency use needs archival evidence URL")
        selected.append({
            "county_fips": county_fips, "event_id": event_id,
            "source_id": source_id, "evidence_type": kind,
            "relative_path": row["relative_path"], "sha256": computed_hash,
            "bytes": size, "effective_date": effective,
            "acquisition_date": row.get("acquisition_date"),
            "published_date": row.get("published_date"),
            "retrieved_at_utc": row.get("retrieved_at_utc"),
            "horizontal_crs": row.get("horizontal_crs", "UNKNOWN"),
            "vertical_datum": row.get("vertical_datum", "UNKNOWN"),
            "units": row.get("units", "UNKNOWN"),
            "resolution": row.get("resolution"),
            "quality_method": row.get("quality_method", "UNREVIEWED"),
            "agency_use_status": "SUBMITTED_FOR_REVIEW" if row.get(
                "claim_used_during_event") is True else "NOT_VERIFIED",
            "agency_use_evidence_url": row.get("agency_use_evidence_url"),
            "engineering_validation": "NOT_VERIFIED",
        })
    selected.sort(key=lambda x: (x["event_id"], x["source_id"], x["relative_path"]))
    source_candidates = [{
        "id": s["id"], "authority": s["authority"], "product_kind": s["product_kind"],
        "url": s["url"], "construction_method": s["construction_method"],
        "quality_basis": s["quality_basis"],
        "metadata_evidence_status": s["metadata_evidence_status"],
        "spatial_authority": s["spatial_authority"],
    } for s in catalog["sources"]
        if not s["counties"] or county_fips in s["counties"]]
    historical_map_index_records = []
    for index_record in catalog.get("historical_map_index_records", []):
        if index_record["county_fips"] != county_fips:
            continue
        if index_record["source_id"] not in sources:
            raise ValueError("USGS historical map record has unknown source")
        if index_record["qualitative_reliability"] not in ("RECON", "STANDARD", "HIGH"):
            raise ValueError("Invalid original USGS map reliability class")
        if (index_record.get("map_geometry_attached") is not False
                or index_record.get("agency_use_during_1937_verified") is not False):
            raise ValueError("USGS index cannot assert an unverified map or 1937 use")
        historical_map_index_records.append(dict(index_record))
    edition_contexts = []
    for edition in catalog["map_editions"]:
        if edition["county_fips"] != county_fips:
            continue
        for event in catalog["events"]:
            effective = _date(edition["effective_date"], "map.effective_date")
            event_start = _date(event["start_date"], "event.start_date")
            event_end = _date(event["end_date"], "event.end_date")
            when = ("POST_EVENT_NOT_AVAILABLE" if effective > event_end
                    else "EFFECTIVE_DURING_EVENT_NOT_USE_VERIFIED" if effective <= event_start
                    else "EFFECTIVE_DATE_WITHIN_EVENT_WINDOW_REVIEW")
            edition_contexts.append({
                "event_id": event["id"], "panel_id": edition["panel_id"],
                "effective_date": edition["effective_date"], "temporal_relation": when,
                "source_validation": edition["source_validation"],
                "agency_actual_use_verified": False,
            })
    present = {record["evidence_type"] for record in selected}
    return {
        "schema": "tsm-tri-state-historical-flood-evidence-bundle",
        "version": "1.0.0", "inventory_as_of_utc": as_of_utc,
        "county": counties[county_fips],
        "evidence_status": "PARTIAL_ASSETS_ATTACHED" if selected else "INVENTORY_ONLY",
        "regulatory_determination": False, "county_event_impact_verified": False,
        "full_evidence_bundle_verified": False, "asset_count": len(selected),
        "event_contexts": [{"event_id": e["id"], "event_title": e["title"],
                            "event_time_precision": e["date_precision"],
                            "county_impact_status": "REGIONAL_CONTEXT_NOT_COUNTY_VERIFIED"}
                           for e in catalog["events"]],
        "map_edition_temporal_review": edition_contexts,
        "historical_map_index_records": historical_map_index_records,
        "source_candidates": source_candidates, "assets": selected,
        "evidence_class_coverage": {
            kind: "ASSET_ATTACHED_UNREVIEWED" if kind in present
            else "SOURCE_FILE_NOT_ATTACHED" for kind in EVIDENCE_CLASSES},
        "limitations": catalog["limitations"] + [
            "Source portal identification does not prove local tile geometry or coverage",
            "File SHA-256 is byte integrity, not independent accuracy or legal approval",
            "Historical agency map usage requires separate primary archival verification",
            "No NFIP claim or policy is assigned to a building, parcel or person",
        ],
    }


def save_county_bundles(catalog: dict, asset_rows: list, artifact_root: Path,
                        out: Path, as_of_utc: str) -> list[Path]:
    if out.is_symlink() or (out.exists() and
                           (not out.is_dir() or any(out.iterdir()))):
        raise FileExistsError("Destination must be new/empty; will not overwrite evidence")
    documents = [(c["fips"], build_county_bundle(
        catalog, c["fips"], asset_rows, artifact_root, as_of_utc))
                 for c in catalog["counties"] if c["fips"] in COUNTY_FIPS]
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for county_fips, document in documents:
        path = out / ("historical-flood-evidence-" + county_fips + ".json")
        data = (json.dumps(document, ensure_ascii=False, sort_keys=True, indent=2)
                + "\n").encode("utf-8")
        digest = hashlib.sha256(data).hexdigest()
        with path.open("xb") as stream:
            stream.write(data)
        with Path(str(path) + ".sha256").open("x", encoding="ascii") as stream:
            stream.write(digest + "  " + path.name + "\n")
        paths.append(path)
    return paths


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--asset-manifest", type=Path,
                        help="Optional operator-reviewed JSON list of local source assets")
    parser.add_argument("--asset-root", type=Path, default=Path("."))
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--as-of", default="2026-11-18T00:00:00Z",
                        help="Inventory creation timestamp; not source retrieval time")
    args = parser.parse_args()
    try:
        catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
        rows = (json.loads(args.asset_manifest.read_text(encoding="utf-8"))
                if args.asset_manifest else [])
        files = save_county_bundles(catalog, rows, args.asset_root,
                                    args.out, args.as_of)
        print(json.dumps({"status": "REVIEW_ONLY_INVENTORY_WRITTEN",
                          "counties": len(files),
                          "asset_rows": len(rows),
                          "files": [str(path) for path in files]}, indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        print("Historical flood evidence not published: " + str(error),
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
