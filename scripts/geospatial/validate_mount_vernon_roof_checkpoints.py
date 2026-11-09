#!/usr/bin/env python3
"""Evaluate independent roof-elevation control observations against derived values.

The inputs are externally supplied and their authority is NOT authenticated by
this script. Matching vertical datum and measurement target are mandatory.
A passing numerical threshold is not survey certification or regulatory approval.

Checkpoint JSON schema:
{
 "schema": "tsm.mount-vernon-roof-checkpoints.v1",
 "vertical_datum": "NAVD88", "height_type": "ORTHOMETRIC",
 "units": "m", "measurement_target": "ROOF_REPRESENTATIVE_MEDIAN",
 "survey_source_sha256": "<64 lowercase hex>",
 "survey_datum_metadata_sha256": "<64 lowercase hex>",
 "checkpoints": [
   {"point_id":"SURVEY-001","tsm_id":"IGIO:building:42",
    "roof_elevation":130.1}
 ]
}
Only one checkpoint per building is accepted: repeated measurements require
pre-aggregation and separate provenance. The check is limited to median roof
height estimates; a ridge, eave or individual roof point is not equivalent.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path

HEX = re.compile(r"^[0-9a-f]{64}$")
BUILDING = re.compile(r"^IGIO:building:[0-9]+$")
FTUS = 1200.0 / 3937.0
MAX_BYTES = 30_000_000


def sha_field(value: object, label: str) -> str:
    if not isinstance(value, str) or not HEX.fullmatch(value):
        raise ValueError(f"INVALID_SHA256: {label}")
    return value


def finite(value: object, label: str) -> float:
    if type(value) not in (float, int):
        raise ValueError(f"INVALID_NUMBER: {label}")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"NONFINITE_NUMBER: {label}")
    return result


def evaluate(derived: dict, control: dict, *, min_checkpoints: int,
             max_rmse_m: float, max_abs_error_m: float,
             min_coverage_fraction: float) -> dict:
    if (not isinstance(derived, dict)
            or derived.get("schema") != "tsm.mount-vernon-vertical-derivatives.v1"
            or derived.get("engineering_approved") is not False
            or derived.get("units") != "m"):
        raise ValueError("DERIVED_SCHEMA_OR_STATUS_INVALID")
    scene_sha = sha_field(derived.get("source_scene_sha256"), "source_scene_sha256")
    source_samples = sha_field(derived.get("source_samples_sha256"), "source_samples_sha256")
    roof_sha = sha_field(derived.get("roof_source_sha256"), "roof_source_sha256")
    ground_sha = sha_field(derived.get("ground_dataset_sha256"), "ground_dataset_sha256")
    if (not isinstance(control, dict)
            or control.get("schema") != "tsm.mount-vernon-roof-checkpoints.v1"
            or control.get("vertical_datum") != "NAVD88"
            or control.get("height_type") != "ORTHOMETRIC"
            or control.get("measurement_target") != "ROOF_REPRESENTATIVE_MEDIAN"):
        raise ValueError("CONTROL_DATUM_OR_MEASUREMENT_TARGET_INVALID")
    units = control.get("units")
    if units not in ("m", "ftUS"):
        raise ValueError("CONTROL_UNITS_UNSUPPORTED")
    survey_sha = sha_field(control.get("survey_source_sha256"), "survey_source_sha256")
    sha_field(control.get("survey_datum_metadata_sha256"), "survey_datum_metadata_sha256")
    if survey_sha in (roof_sha, ground_sha):
        raise ValueError("CONTROL_SOURCE_NOT_DISTINCT")
    if type(min_checkpoints) is not int or min_checkpoints < 3:
        raise ValueError("MIN_CHECKPOINTS_TOO_SMALL")
    max_rmse_m = finite(max_rmse_m, "max_rmse_m")
    max_abs_error_m = finite(max_abs_error_m, "max_abs_error_m")
    min_coverage_fraction = finite(min_coverage_fraction, "min_coverage_fraction")
    if (max_rmse_m <= 0 or max_abs_error_m <= 0
            or not 0 < min_coverage_fraction <= 1):
        raise ValueError("INVALID_ACCEPTANCE_THRESHOLDS")
    rows = derived.get("records")
    if not isinstance(rows, list) or not rows or len(rows) > 100_000:
        raise ValueError("DERIVED_RECORDS_INVALID")
    by_id = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("DERIVED_RECORD_INVALID")
        ident = row.get("tsm_id")
        if (not isinstance(ident, str) or not BUILDING.fullmatch(ident)
                or ident in by_id or row.get("engineering_approved") is not False
                or row.get("vertical_datum") != "NAVD88"
                or row.get("roof_height_method") != "CLASSIFIED_ROOF_POINT_MEDIAN"):
            raise ValueError("DERIVED_ID_OR_METHOD_INVALID")
        by_id[ident] = finite(row.get("roof_elevation_navd88_m"), "derived_roof")
    checkpoints = control.get("checkpoints")
    if not isinstance(checkpoints, list) or not checkpoints or len(checkpoints) > 100_000:
        raise ValueError("CONTROL_RECORDS_INVALID")
    seen_ids: set[str] = set()
    seen_points: set[str] = set()
    comparisons = []
    for row in checkpoints:
        if not isinstance(row, dict):
            raise ValueError("CONTROL_RECORD_INVALID")
        ident = row.get("tsm_id")
        point = row.get("point_id")
        if (not isinstance(ident, str) or ident not in by_id or ident in seen_ids
                or not isinstance(point, str) or not 1 <= len(point) <= 128
                or point in seen_points):
            raise ValueError("CONTROL_UNKNOWN_OR_DUPLICATE_ID")
        seen_ids.add(ident)
        seen_points.add(point)
        reference = finite(row.get("roof_elevation"), "control_roof")
        if units == "ftUS":
            reference *= FTUS
        residual = by_id[ident] - reference
        comparisons.append({"tsm_id": ident, "point_id": point,
                            "derived_navd88_m": by_id[ident],
                            "control_navd88_m": reference,
                            "residual_m": residual})
    comparisons.sort(key=lambda r: r["tsm_id"])
    n = len(comparisons)
    residuals = [r["residual_m"] for r in comparisons]
    rmse = math.sqrt(math.fsum(r*r for r in residuals) / n)
    bias = math.fsum(residuals) / n
    max_abs = max(abs(r) for r in residuals)
    sorted_abs = sorted(abs(r) for r in residuals)
    # Nearest-rank empirical absolute-error P95, NOT an LE95 confidence bound.
    p95 = sorted_abs[math.ceil(0.95*n)-1]
    coverage = n / len(by_id)
    passed = (n >= min_checkpoints and coverage >= min_coverage_fraction
              and rmse <= max_rmse_m and max_abs <= max_abs_error_m)
    return {
        "schema": "tsm.mount-vernon-roof-checkpoint-report.v1",
        "source_scene_sha256": scene_sha,
        "source_samples_sha256": source_samples,
        "survey_source_sha256": survey_sha,
        "source_provenance_authenticated": False,
        "survey_certified": False,
        "engineering_approved": False,
        "statistical_thresholds_met": passed,
        "validation_status": "NUMERICAL_THRESHOLDS_MET_SOURCE_UNAUTHENTICATED"
            if passed else "NUMERICAL_THRESHOLDS_NOT_MET",
        "comparison_target": "ROOF_REPRESENTATIVE_MEDIAN",
        "vertical_datum": "NAVD88_DECLARED_NOT_INDEPENDENTLY_AUTHENTICATED",
        "units": "m",
        "metrics": {"derived_buildings": len(by_id), "checkpoints": n,
                    "coverage_fraction": coverage, "rmse_m": rmse,
                    "mean_error_m": bias, "max_absolute_error_m": max_abs,
                    "empirical_p95_absolute_error_m": p95},
        "thresholds": {"min_checkpoints": min_checkpoints,
                       "min_coverage_fraction": min_coverage_fraction,
                       "max_rmse_m": max_rmse_m,
                       "max_absolute_error_m": max_abs_error_m},
        "comparisons": comparisons,
    }


def load(path: Path) -> dict:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"MISSING_OR_SYMLINK_INPUT: {path}")
    with path.open("rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("INPUT_TOO_LARGE")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("INPUT_NOT_OBJECT")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--derived", type=Path, required=True)
    parser.add_argument("--checkpoints", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--min-checkpoints", type=int, required=True)
    parser.add_argument("--max-rmse-m", type=float, required=True)
    parser.add_argument("--max-abs-error-m", type=float, required=True)
    parser.add_argument("--min-coverage-fraction", type=float, required=True)
    args = parser.parse_args()
    report = evaluate(load(args.derived), load(args.checkpoints),
                      min_checkpoints=args.min_checkpoints,
                      max_rmse_m=args.max_rmse_m,
                      max_abs_error_m=args.max_abs_error_m,
                      min_coverage_fraction=args.min_coverage_fraction)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, sort_keys=True, indent=2, allow_nan=False)+"\n",
                           encoding="utf-8")
    print(json.dumps({"status": report["validation_status"], "metrics": report["metrics"],
                      "engineering_approved": False}, sort_keys=True))
    if not report["statistical_thresholds_met"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
