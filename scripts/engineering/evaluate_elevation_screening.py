#!/usr/bin/env python3
"""Headless, provenance-gated elevation screening. NOT a regulatory determination."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

REQUIRED = ("structure_id", "source_sha256", "source_id", "crs", "vertical_datum",
            "elevation_units", "lag_elevation", "bfe_elevation", "rule_id", "freeboard_ft")
VALID_SHA = set("0123456789abcdefABCDEF")

def is_sha256(s):
    return isinstance(s, str) and len(s) == 64 and all(c in VALID_SHA for c in s)

def finite_number(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    return number if math.isfinite(number) else None

def evaluate(row):
    """Preserve missing and incompatible inputs; never imply compliance outside mapped polygons."""
    result = {"structure_id": str(row.get("structure_id", "")), "status": "NOT_EVALUATED",
              "reason": "", "screening_only": True, "regulatory_determination": False,
              "clearance_ft": None, "screening_deficit_ft": None}
    missing = [k for k in REQUIRED if row.get(k) is None or str(row.get(k)).strip() == ""]
    if missing:
        result["reason"] = "MISSING_REQUIRED_FIELDS:" + ",".join(missing)
        return result
    if not is_sha256(row["source_sha256"]):
        result["reason"] = "INVALID_SOURCE_SHA256"
        return result
    if row.get("flood_zone_intersection") is not True:
        result["reason"] = "FLOOD_ZONE_NOT_CONFIRMED" if row.get("flood_zone_intersection") is None else "OUTSIDE_MAPPED_ZONE_NOT_PROOF_OF_SAFETY"
        return result
    if str(row["vertical_datum"]).upper() != "NAVD88":
        result["reason"] = "VERTICAL_DATUM_TRANSFORM_NOT_VERIFIED"
        return result
    if row.get("bfe_vertical_datum", row["vertical_datum"]) != row["vertical_datum"]:
        result["reason"] = "MIXED_VERTICAL_DATUM"
        return result
    if str(row["elevation_units"]).lower() not in ("ft", "ftus", "us_survey_foot", "feet"):
        result["reason"] = "UNSUPPORTED_ELEVATION_UNITS"
        return result
    if row.get("bfe_elevation_units", row["elevation_units"]) != row["elevation_units"]:
        result["reason"] = "MIXED_ELEVATION_UNITS"
        return result
    if row.get("lag_source_type") != "surveyed_lag":
        result["reason"] = "LAG_NOT_SURVEY_VERIFIED"
        return result
    if row.get("rule_verified") is not True:
        result["reason"] = "JURISDICTION_RULE_NOT_VERIFIED"
        return result
    lag, bfe, freeboard = (finite_number(row[k]) for k in ("lag_elevation", "bfe_elevation", "freeboard_ft"))
    if any(x is None for x in (lag, bfe, freeboard)) or freeboard < 0:
        result["reason"] = "INVALID_NUMERIC_INPUT"
        return result
    clearance = lag - bfe
    result["clearance_ft"] = round(clearance, 6)
    result["screening_deficit_ft"] = round(max(0, freeboard - clearance), 6)
    result["status"] = "SCREENING_THRESHOLD_MET" if clearance >= freeboard else "SCREENING_THRESHOLD_NOT_MET"
    result["reason"] = "HUMAN_REVIEW_REQUIRED"
    return result

def run(source, output):
    raw = Path(source).read_bytes()
    records = json.loads(raw)
    if not isinstance(records, list) or len(records) > 100000:
        raise ValueError("Expected a bounded JSON array")
    if Path(output).exists():
        raise FileExistsError("Refusing to overwrite prior evidence")
    results = [evaluate(row) for row in records]
    package = {"schema": "tsm.elevation-screening.v1", "input_sha256": hashlib.sha256(raw).hexdigest(),
               "regulatory_determination": False, "results": results}
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    Path(output).write_text(json.dumps(package, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return package

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()
    run(a.input, a.output)
