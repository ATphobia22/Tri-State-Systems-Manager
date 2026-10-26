#!/usr/bin/env python3
"""Strict, offline CRS/datum validation for TSM's device-compass waypoints.

This is a *pre-ingestion evidence gate*, not a datum transformer, coordinate
surveyor, or NAVD88 certification. Numeric elevations are never silently
shifted. Validation errors use record indices / hashed IDs, not coordinates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any

# Set before importing PROJ; do not download transformation grids implicitly.
os.environ['PROJ_NETWORK'] = 'OFF'

from jsonschema import Draft202012Validator, FormatChecker
from pyproj import CRS
from pyproj.exceptions import CRSError

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SCHEMA = ROOT / "schemas" / "compass-waypoint.schema.json"
DEFAULT_TARGET_VERTICAL_DATUM = "NAVD88"
ALLOWED_GEOGRAPHIC_EPSG = {4326, 4269, 6318}
ALLOWED_CRS84 = {"OGC:CRS84", "urn:ogc:def:crs:OGC::CRS84"}
NAVD88 = "NAVD88"
PROJ_NETWORK_DISABLED = "OFF"


def _record_ref(value: Any, index: int) -> str:
    # Never emit a user-supplied waypoint label, address, or coordinate.
    raw = value.get("id") if isinstance(value, dict) else None
    token = str(raw) if isinstance(raw, str) else str(index)
    return f"record-{index}-{hashlib.sha256(token.encode('utf-8')).hexdigest()[:12]}"


def _crs_errors(raw: Any) -> list[str]:
    if not isinstance(raw, str) or not raw.strip():
        return ["CRS_UNDECLARED"]
    raw = raw.strip()
    if raw.upper() not in ALLOWED_CRS84 and not raw.upper().startswith("EPSG:"):
        return ["CRS_IDENTIFIER_NOT_SUPPORTED"]
    try:
        crs = CRS.from_user_input(raw)
    except (CRSError, ValueError, TypeError):
        return ["CRS_UNRESOLVABLE"]
    if not crs.is_geographic:
        return ["PROJECTED_CRS_WITH_LATITUDE_LONGITUDE_FIELDS"]
    code = crs.to_epsg()
    if code in (4979, 6319) or len(crs.axis_info) != 2:
        return ['THREE_DIMENSIONAL_ELLIPSOID_CRS_WITH_NAVD88_HEIGHT_FIELD']
    if raw.upper() not in ALLOWED_CRS84 and code not in ALLOWED_GEOGRAPHIC_EPSG:
        return ["GEOGRAPHIC_CRS_NOT_IN_APPROVED_WAYPOINT_SET"]
    if len(crs.axis_info) < 2 or any(axis.unit_name.lower() not in ("degree", "degrees") for axis in crs.axis_info[:2]):
        return ["CRS_AXIS_UNIT_NOT_DEGREES"]
    return []


def validate_record(record: Any, validator: Draft202012Validator, *, target_vertical_datum: str = NAVD88) -> list[str]:
    errors = [
        f"SCHEMA:{'/'.join(str(p) for p in e.absolute_path) or 'root'}:{e.validator}"
        for e in validator.iter_errors(record)
    ]
    if not isinstance(record, dict):
        return sorted(set(errors + ["RECORD_NOT_OBJECT"]))

    errors.extend(_crs_errors(record.get("coordinateReferenceSystem")))
    coords = record.get("coordinates")
    if not isinstance(coords, dict):
        return sorted(set(errors + ["COORDINATES_MISSING"]))

    value = coords.get("elevation")
    unit = coords.get("elevationUnit")
    datum = coords.get("verticalDatum")
    epoch = record.get("coordinateEpoch")
    crs_string = record.get("coordinateReferenceSystem", "")

    if value is not None:
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
            errors.append("ELEVATION_NONFINITE_OR_NONNUMERIC")
        if unit not in ("m", "ft"):
            errors.append("ELEVATION_UNIT_REQUIRED")
        if not isinstance(datum, str) or datum.strip() == "":
            errors.append("VERTICAL_DATUM_REQUIRED_FOR_ELEVATION")
        elif datum != target_vertical_datum:
            # Do NOT relabel unknown, NGVD29, local MSL or ellipsoid heights as NAVD88.
            errors.append("VERTICAL_DATUM_TRANSFORMATION_REQUIRED_NOT_EXECUTED")
    elif unit is not None or datum is not None:
        errors.append("ELEVATION_METADATA_WITHOUT_ELEVATION")

    if isinstance(crs_string, str) and crs_string.upper() in ("EPSG:6318", "EPSG:6319"):
        if epoch is None:
            errors.append("NAD83_2011_COORDINATE_EPOCH_REQUIRED")
    if epoch is not None and (
        not isinstance(epoch, (int, float)) or isinstance(epoch, bool)
        or not math.isfinite(epoch) or epoch < 1900 or epoch > 2100
    ):
        errors.append("COORDINATE_EPOCH_OUT_OF_RANGE")

    # Height and CRS labels are only metadata, not a PROJ operation receipt.
    # Device GNSS cannot be silently promoted to field-survey evidence.
    if record.get("engineeringUse") not in (None, "not-authorized"):
        errors.append("WAYPOINT_ENGINEERING_USE_NOT_AUTHORIZED")
    return sorted(set(errors))


def validate_batch(payload: Any, schema: dict, *, target_vertical_datum: str = NAVD88,
                   max_errors: int = 100) -> dict:
    if max_errors < 0:
        raise ValueError("max_errors must be >= 0")
    records = payload if isinstance(payload, list) else [payload]
    v = Draft202012Validator(schema, format_checker=FormatChecker())
    issues = []
    passed = 0
    for i, record in enumerate(records):
        errors = validate_record(record, v, target_vertical_datum=target_vertical_datum)
        if errors:
            if len(issues) < max_errors:
                issues.append({"ref": _record_ref(record, i), "codes": errors})
        else:
            passed += 1
    return {
        "schemaVersion": "tsm.compass-waypoint-validation.v1",
        "classification": "INFORMATIONAL_ONLY",
        "surveyCertification": False,
        "datumTransformationExecuted": False,
        "networkAccess": False,
        "records": len(records),
        "valid": passed,
        "invalid": len(records) - passed,
        "errorsTruncated": len(records) - passed > len(issues),
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Waypoint object or JSON array")
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--report", type=Path, help="Optional safe, redacted JSON result")
    parser.add_argument("--target-vertical-datum", choices=[NAVD88], default=NAVD88)
    parser.add_argument("--max-errors", type=int, default=100)
    args = parser.parse_args()
    # Prevent pyproj from silently retrieving network grids.
    os.environ["PROJ_NETWORK"] = PROJ_NETWORK_DISABLED
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    result = validate_batch(payload, schema,
                            target_vertical_datum=args.target_vertical_datum,
                            max_errors=args.max_errors)
    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.report:
        if args.report.resolve() == args.input.resolve() or args.report.resolve() == args.schema.resolve():
            parser.error("--report cannot overwrite input or schema")
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text, encoding="utf-8")
    print(text, end="")
    return 1 if result["invalid"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
