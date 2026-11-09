#!/usr/bin/env python3
"""Evidence-gated vertical reconciliation for externally sampled Mount Vernon roofs.

This does NOT infer roof heights, sample rasters, reproject coordinates, perform
geoid transformations, certify accuracy, or create LOD2 geometry. It combines
independently sourced, datum-declared ground and above-ground roof measurements,
and refuses missing datum/units/provenance instead of inventing heights.

Input schema tsm.mount-vernon-vertical-samples.v1:
{
  "schema": "tsm.mount-vernon-vertical-samples.v1",
  "ground_vertical_datum": "NAVD88",
  "ground_height_type": "ORTHOMETRIC",
  "ground_units": "m",
  "ground_dataset_sha256": "<64 lowercase hex>",
  "ground_datum_metadata_sha256": "<64 lowercase hex>",
  "roof_source_sha256": "<64 lowercase hex>",
  "roof_height_type": "ABOVE_GROUND",
  "roof_units": "m",
  "records": [
    {"tsm_id": "IGIO:building:123", "source_feature_sha256": "<64 hex>",
     "ground_elevation": 120.0, "roof_height_agl": 8.0,
     "ground_sample_method": "GROUND_CLASSIFIED_POINT_MEDIAN",
     "roof_height_method": "CLASSIFIED_ROOF_POINT_MEDIAN",
     "ground_sample_count": 10, "roof_sample_count": 15}
  ]
}
Output is DERIVED_UNREVIEWED, never ENGINEERING_APPROVED. Dataset labels
are supplied claims, not independent validation of authoritative metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path

HEX = re.compile(r"^[0-9a-f]{64}$")
IDENTITY = re.compile(r"^IGIO:building:[0-9]+$")
SCHEMA = "tsm.mount-vernon-vertical-samples.v1"
OUT_SCHEMA = "tsm.mount-vernon-vertical-derivatives.v1"
FTUS_TO_METRE = 1200.0 / 3937.0
MAX_INPUT_BYTES = 30_000_000
MAX_RECORDS = 100_000
ALLOWED_METHODS = {
    "GROUND_CLASSIFIED_POINT_MEDIAN",
    "DEM_BARE_EARTH_FOOTPRINT_MEDIAN",
}
ROOF_METHODS = {"CLASSIFIED_ROOF_POINT_MEDIAN", "MANUALLY_SURVEYED_ROOF_HEIGHT"}


def require_hash(value: object, field: str) -> str:
    if not isinstance(value, str) or not HEX.fullmatch(value):
        raise ValueError(f"INVALID_SHA256: {field}")
    return value


def number(value: object, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise ValueError(f"INVALID_NUMERIC_VALUE: {field}")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"NONFINITE_VALUE: {field}")
    return result


def to_meters(value: object, unit: str, field: str) -> float:
    if unit not in {"m", "ftUS"}:
        raise ValueError(f"UNSUPPORTED_UNIT: {unit}")
    return number(value, field) * (FTUS_TO_METRE if unit == "ftUS" else 1.0)


def reconcile(payload: dict) -> dict:
    if not isinstance(payload, dict) or payload.get("schema") != SCHEMA:
        raise ValueError("VERTICAL_INPUT_SCHEMA_INVALID")
    if payload.get("ground_vertical_datum") != "NAVD88":
        raise ValueError("GROUND_DATUM_UNDECLARED_OR_NOT_NAVD88")
    if payload.get("ground_height_type") != "ORTHOMETRIC":
        raise ValueError("GROUND_HEIGHT_NOT_ORTHOMETRIC")
    if payload.get("roof_height_type") != "ABOVE_GROUND":
        raise ValueError("ROOF_HEIGHT_MUST_BE_RELATIVE")
    ground_units = payload.get("ground_units")
    roof_units = payload.get("roof_units")
    if ground_units not in {"m", "ftUS"} or roof_units not in {"m", "ftUS"}:
        raise ValueError("VERTICAL_UNITS_MISSING_OR_UNSUPPORTED")
    for field in ("ground_dataset_sha256", "ground_datum_metadata_sha256", "roof_source_sha256"):
        require_hash(payload.get(field), field)
    records = payload.get("records")
    if not isinstance(records, list) or not records or len(records) > MAX_RECORDS:
        raise ValueError("INVALID_VERTICAL_RECORD_COUNT")
    seen: set[str] = set()
    results: list[dict] = []
    for row in records:
        if not isinstance(row, dict):
            raise ValueError("INVALID_VERTICAL_RECORD")
        ident = row.get("tsm_id")
        if not isinstance(ident, str) or not IDENTITY.fullmatch(ident) or ident in seen:
            raise ValueError("INVALID_OR_DUPLICATE_BUILDING_ID")
        seen.add(ident)
        source_hash = require_hash(row.get("source_feature_sha256"), "source_feature_sha256")
        ground_method = row.get("ground_sample_method")
        roof_method = row.get("roof_height_method")
        if ground_method not in ALLOWED_METHODS or roof_method not in ROOF_METHODS:
            raise ValueError(f"UNSUPPORTED_SAMPLING_METHOD: {ident}")
        for count in ("ground_sample_count", "roof_sample_count"):
            n = row.get(count)
            if type(n) is not int or n < 1:
                raise ValueError(f"INVALID_SAMPLE_COUNT: {ident}/{count}")
        base = to_meters(row.get("ground_elevation"), ground_units, "ground_elevation")
        height = to_meters(row.get("roof_height_agl"), roof_units, "roof_height_agl")
        if not 0 < height < 1000:
            raise ValueError(f"IMPLAUSIBLE_OR_MISSING_ROOF_HEIGHT: {ident}")
        results.append({
            "tsm_id": ident,
            "source_feature_sha256": source_hash,
            "ground_elevation_navd88_m": base,
            "roof_height_agl_m": height,
            "roof_elevation_navd88_m": base + height,
            "vertical_datum": "NAVD88",
            "ground_sample_method": ground_method,
            "roof_height_method": roof_method,
            "ground_sample_count": row["ground_sample_count"],
            "roof_sample_count": row["roof_sample_count"],
            "evidence_status": "DERIVED_UNREVIEWED",
            "engineering_approved": False,
        })
    results.sort(key=lambda r: int(r["tsm_id"].split(":")[-1]))
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return {
        "schema": OUT_SCHEMA,
        "source_samples_sha256": hashlib.sha256(raw).hexdigest(),
        "source_datum": "NAVD88_DECLARED_BY_INPUT_NOT_INDEPENDENTLY_VERIFIED",
        "ground_dataset_sha256": payload["ground_dataset_sha256"],
        "ground_datum_metadata_sha256": payload["ground_datum_metadata_sha256"],
        "roof_source_sha256": payload["roof_source_sha256"],
        "units": "m",
        "method": "GROUND_ORTHOMETRIC_PLUS_ABOVE_GROUND_ROOF_HEIGHT",
        "engineering_approved": False,
        "survey_certified": False,
        "validation_status": "DERIVED_UNREVIEWED",
        "records": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input.is_symlink() or not args.input.is_file():
        raise ValueError("INPUT_NOT_REGULAR_FILE")
    with args.input.open("rb") as file:
        raw = file.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        raise ValueError("INPUT_TOO_LARGE")
    result = reconcile(json.loads(raw))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, sort_keys=True, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "count": len(result["records"]),
                      "status": result["validation_status"], "engineering_approved": False}))


if __name__ == "__main__":
    main()
