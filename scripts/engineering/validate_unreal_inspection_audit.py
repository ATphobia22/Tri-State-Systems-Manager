#!/usr/bin/env python3
"""Independent, screening-only validation of native Unreal building inspection exports.

No regulatory approval is implied. Missing source evidence never becomes a pass.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_record(record):
    ident = record.get("StructureID")
    result = {"structure_id": ident, "status": "NOT_EVALUATED", "reasons": []}
    for key in ("StructureID", "SourceID", "SourceSHA256", "HorizontalCRS",
                "VerticalDatum", "ElevationUnits", "LAGSourceType", "RuleID"):
        if not isinstance(record.get(key), str) or not record[key].strip():
            result["reasons"].append("MISSING_" + key.upper())
    digest = record.get("SourceSHA256")
    if isinstance(digest, str) and (len(digest) != 64 or any(c not in "0123456789abcdefABCDEF" for c in digest)):
        result["reasons"].append("INVALID_SOURCE_SHA256")
    if record.get("VerticalDatum") != "NAVD88":
        result["reasons"].append("VERTICAL_DATUM_UNVERIFIED")
    if record.get("ElevationUnits") != "ftUS":
        result["reasons"].append("ELEVATION_UNITS_UNVERIFIED")
    if record.get("LAGSourceType") != "surveyed_lag":
        result["reasons"].append("LAG_NOT_SURVEY_VERIFIED")
    if record.get("FloodZoneIntersection") is not True:
        result["reasons"].append("FLOOD_INTERSECTION_UNVERIFIED")
    if record.get("RuleVerified") is not True:
        result["reasons"].append("LOCAL_RULE_UNVERIFIED")
    for key in ("LowestAdjacentGradeFt", "BaseFloodElevationFt", "RequiredFreeboardFt"):
        if not finite_number(record.get(key)):
            result["reasons"].append("MISSING_OR_INVALID_" + key.upper())
    if result["reasons"]:
        return result
    lag, bfe, freeboard = (record["LowestAdjacentGradeFt"],
                           record["BaseFloodElevationFt"], record["RequiredFreeboardFt"])
    if freeboard < 0:
        result["reasons"].append("INVALID_FREEBOARD")
        return result
    threshold = bfe + freeboard
    deficit = max(0.0, threshold - lag)
    result.update(status="THRESHOLD_MET" if deficit <= 1e-9 else "THRESHOLD_NOT_MET",
                  required_threshold_ft=threshold, freeboard_deficit_ft=deficit,
                  clearance_ft=lag - bfe)
    engine_status = record.get("ScreeningStatus")
    if engine_status is not None and engine_status != result["status"]:
        result["reasons"].append("ENGINE_STATUS_DISCREPANCY")
    engine_deficit = record.get("FreeboardDeficitFt")
    if engine_deficit is not None and (not finite_number(engine_deficit) or abs(engine_deficit - deficit) > 0.01):
        result["reasons"].append("ENGINE_DEFICIT_DISCREPANCY")
    if result["reasons"]:
        result["status"] = "DISCREPANCY"
    return result


def validate_document(document):
    records = document.get("InspectedStructures")
    if not isinstance(records, list) or not records:
        raise ValueError("InspectedStructures must be a nonempty array")
    if document.get("TotalInspectedCount") != len(records):
        raise ValueError("TotalInspectedCount does not match record count")
    results = []
    ids = set()
    for item in records:
        if not isinstance(item, dict):
            raise ValueError("Inspection records must be objects")
        ident = item.get("StructureID")
        if not isinstance(ident, str) or not ident.strip() or ident in ids:
            raise ValueError("Structure IDs must be nonempty and unique")
        ids.add(ident)
        results.append(validate_record(item))
    return {"classification": "ENGINEERING_SCREENING_ONLY_NOT_REGULATORY_CERTIFICATION",
            "summary": {status: sum(x["status"] == status for x in results)
                        for status in ("THRESHOLD_MET", "THRESHOLD_NOT_MET", "NOT_EVALUATED", "DISCREPANCY")},
            "results": results}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input and output must be different files")
    doc = json.loads(args.input.read_text(encoding="utf-8"))
    report = validate_document(doc)
    report["input_sha256"] = hashlib.sha256(args.input.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], sort_keys=True))
    return 0 if report["summary"]["NOT_EVALUATED"] == 0 and report["summary"]["DISCREPANCY"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
