#!/usr/bin/env python3
"""Compute independently supplied checkpoint residual statistics, headlessly.

ASPRS 2024 Edition 2 Version 2: RMSE_H1 and RMSE_V1 are product-to-survey
fit; final RMSE_H/V include independently reported survey RMSE_H2/V2 via
root-sum-square. The FGDC 1998 NSSDA 95% approximations are legacy
statistics, NOT the current ASPRS reporting convention, and require explicit
recorded distribution/error assumptions.

No checkpoints or survey certification are generated here. Inputs must
already share a correctly verified coordinate frame and metres; the script
does not perform survey, projection, datum conversion or acceptance.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys

MAX_CSV_BYTES = 16 * 1024 * 1024
MAX_ROWS = 100000
SHA = re.compile(r"[0-9a-f]{64}\Z")
EPSG = re.compile(r"EPSG:[0-9]{3,6}\Z")
COLUMNS = {
    "horizontal": ("checkpoint_id", "product_x_m", "reference_x_m", "product_y_m", "reference_y_m"),
    "vertical": ("checkpoint_id", "product_z_m", "reference_z_m"),
    "3d": ("checkpoint_id", "product_x_m", "reference_x_m", "product_y_m",
           "reference_y_m", "product_z_m", "reference_z_m"),
}
SOURCES = {
    "ASPRS_2024": "https://www.usgs.gov/ngp-standards-and-specifications/adopt-updated-accuracy-standards",
    "FGDC_NSSDA_1998": "https://www.fgdc.gov/standards/projects/accuracy/part3/chapter3",
}


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1048576), b""):
            h.update(chunk)
    return h.hexdigest()


def bound_file(path: Path) -> Path:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"Missing or symlinked evidence file: {path}")
    return path


def finite(value: str, label: str) -> float:
    try:
        x = float(value)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"{label} is not numeric") from exc
    if not math.isfinite(x):
        raise ValueError(f"{label} must be finite")
    return x


def load_checkpoints(path: Path, mode: str) -> list[dict]:
    source = bound_file(path)
    if source.stat().st_size > MAX_CSV_BYTES:
        raise ValueError("Checkpoint CSV exceeds 16 MiB")
    content = source.read_bytes()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig"), newline=""))
    required = COLUMNS[mode]
    if not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames)):
        raise ValueError("CSV header missing or duplicated")
    if not set(required) <= set(reader.fieldnames):
        raise ValueError(f"Missing checkpoint columns: {sorted(set(required)-set(reader.fieldnames))}")
    rows, seen = [], set()
    for i, row in enumerate(reader, 2):
        if i > MAX_ROWS + 1:
            raise ValueError("Too many checkpoints")
        identifier = (row.get("checkpoint_id") or "").strip()
        if not identifier or identifier in seen or row.get(None) is not None:
            raise ValueError(f"Missing/duplicate ID or malformed row at CSV line {i}")
        seen.add(identifier)
        record = {"checkpoint_id": identifier}
        for column in required[1:]:
            record[column] = finite(row.get(column), f"{identifier}.{column}")
        rows.append(record)
    if not rows:
        raise ValueError("No independent checkpoint rows supplied")
    return rows


def documented_file(manifest_path: Path, metadata: dict, path_key: str, hash_key: str) -> bool:
    rel, expected = metadata.get(path_key), metadata.get(hash_key)
    if rel is None and expected is None:
        return False
    if not isinstance(rel, str) or not rel or not isinstance(expected, str) or not SHA.fullmatch(expected):
        raise ValueError(f"Both {path_key} and its valid {hash_key} are required")
    path = bound_file((manifest_path.parent / rel).resolve(strict=True))
    if file_sha256(path) != expected:
        raise ValueError(f"Evidence digest mismatch: {path_key}")
    return True


def evidence(manifest_path: Path | None, checkpoints_path: Path, mode: str) -> dict:
    if manifest_path is None:
        return {
            "provenance": "NOT_PROVIDED",
            "coordinateFrameVerifiedBySoftware": False,
            "sourceDataHashVerified": False,
            "surveyReportHashVerified": False,
            "surveyRMSE_H2_m": None,
            "surveyRMSE_V2_m": None,
            "normalIndependentErrorAssumptionsReviewed": False,
            "systematicErrorsReviewed": False,
            "checkpointIndependenceDeclared": False,
            "representativeCoverageDeclared": False,
        }
    manifest_path = bound_file(manifest_path)
    p = json.loads(manifest_path.read_text(encoding="utf-8"))
    if p.get("schema") != "tsm-independent-checkpoint-input-v1":
        raise ValueError("Unsupported checkpoint provenance schema")
    if p.get("coordinatesUnits") != "m":
        raise ValueError("Only projected, aligned coordinates in metres are accepted")
    if not EPSG.fullmatch(str(p.get("horizontalCrs", ""))):
        raise ValueError("Explicit projected EPSG horizontal CRS required")
    if mode != "horizontal" and p.get("verticalDatum") in (None, "", "UNKNOWN", "NOT_APPLICABLE"):
        raise ValueError("Vertical datum must be explicitly stated for elevation comparisons")
    expected = p.get("checkpointCsvSha256")
    if not isinstance(expected, str) or not SHA.fullmatch(expected):
        raise ValueError("Checkpoint CSV SHA-256 is required with provenance")
    if file_sha256(checkpoints_path) != expected:
        raise ValueError("Checkpoint CSV SHA-256 mismatch")
    src_verified = documented_file(manifest_path, p, "sourceDatasetPath", "sourceDatasetSha256")
    survey_verified = documented_file(manifest_path, p, "surveyReportPath", "surveyReportSha256")
    h2, v2 = p.get("surveyRMSE_H2_m"), p.get("surveyRMSE_V2_m")
    for name, rmse in (("surveyRMSE_H2_m", h2), ("surveyRMSE_V2_m", v2)):
        if rmse is not None:
            if type(rmse) not in (float, int) or not math.isfinite(rmse) or rmse <= 0:
                raise ValueError(f"{name} must be positive measured survey RMSE in metres")
            if not survey_verified:
                raise ValueError(f"{name} requires a local hash-verified survey report")
    if h2 is not None and mode == "vertical" or v2 is not None and mode == "horizontal":
        raise ValueError("Survey uncertainty axis does not match assessment mode")
    return {
        "provenance": "INPUT_PATHS_AND_HASHES_CHECKED_NOT_INDEPENDENTLY_AUTHENTICATED",
        "datasetId": p.get("datasetId"),
        "horizontalCrsReported": p["horizontalCrs"],
        "verticalDatumReported": p.get("verticalDatum"),
        "coordinateUnits": "m",
        "coordinateFrameVerifiedBySoftware": False,
        "sameCoordinateFrameDeclared": p.get("sameCoordinateFrameDeclared") is True,
        "checkpointIndependenceDeclared": p.get("checkpointIndependenceDeclared") is True,
        "representativeCoverageDeclared": p.get("representativeCoverageDeclared") is True,
        "surveyMethodReported": p.get("surveyMethod"),
        "sourceDataHashVerified": src_verified,
        "surveyReportHashVerified": survey_verified,
        "surveyRMSE_H2_m": h2,
        "surveyRMSE_V2_m": v2,
        "normalIndependentErrorAssumptionsReviewed": p.get("normalIndependentErrorAssumptionsReviewed") is True,
        "systematicErrorsReviewed": p.get("systematicErrorsReviewed") is True,
        "provenanceManifestSha256": file_sha256(manifest_path),
    }


def rms(values: list[float]) -> float:
    return math.sqrt(math.fsum(value * value for value in values) / len(values))


def percentile_95_abs(values: list[float]) -> float:
    ordered = sorted(abs(value) for value in values)
    return ordered[math.ceil(0.95 * len(ordered)) - 1]


def calculate(rows: list[dict], mode: str, provenance: dict) -> dict:
    n = len(rows)
    have_h = mode != "vertical"
    have_v = mode != "horizontal"
    dx = [r["product_x_m"] - r["reference_x_m"] for r in rows] if have_h else []
    dy = [r["product_y_m"] - r["reference_y_m"] for r in rows] if have_h else []
    dz = [r["product_z_m"] - r["reference_z_m"] for r in rows] if have_v else []
    rx, ry, rz = (rms(dx), rms(dy), None) if have_h else (None, None, None)
    if have_v:
        rz = rms(dz)
    rh1 = math.hypot(rx, ry) if have_h else None
    rv1 = rz
    h2 = provenance.get("surveyRMSE_H2_m")
    v2 = provenance.get("surveyRMSE_V2_m")
    # Record 2024 correction only when survey report is hash-checked AND the
    # operator declares the coordinate frame is identical. Still not certification.
    valid_adjustment = (provenance.get("surveyReportHashVerified") is True
                        and provenance.get("sameCoordinateFrameDeclared") is True)
    rh = math.hypot(rh1, h2) if have_h and valid_adjustment and h2 is not None else None
    rv = math.hypot(rv1, v2) if have_v and valid_adjustment and v2 is not None else None
    r3d = math.hypot(rh, rv) if rh is not None and rv is not None else None
    # FGDC 1998 only: assumptions and sample conditions are separate from 2024.
    legacy = {"reference": SOURCES["FGDC_NSSDA_1998"],
              "minimumCheckpoints": 20, "countCriterionMet": n >= 20,
              "horizontal95_m": None, "vertical95_m": None, "notCurrentASPRS": True}
    assumptions = (n >= 20 and provenance.get("normalIndependentErrorAssumptionsReviewed")
                   and provenance.get("systematicErrorsReviewed"))
    if assumptions and have_v:
        legacy["vertical95_m"] = 1.9600 * rv1
    if assumptions and have_h:
        upper, lower = max(rx, ry), min(rx, ry)
        if upper == 0 or lower / upper >= 0.6:
            legacy["horizontal95_m"] = (1.7308 * rh1 if upper == lower else
                                        2.4477 * 0.5 * (rx + ry))
        else:
            legacy["horizontalLimitation"] = "RMSE_MIN_OVER_MAX_BELOW_0_6"
    metrics = {
        "rmseX_fit_m": rx, "rmseY_fit_m": ry, "rmseH1_fit_m": rh1,
        "rmseV1_fit_m": rv1,
        "meanErrorX_m": math.fsum(dx) / n if have_h else None,
        "meanErrorY_m": math.fsum(dy) / n if have_h else None,
        "meanErrorZ_m": math.fsum(dz) / n if have_v else None,
        "absoluteVerticalResidualP95_m": percentile_95_abs(dz) if have_v else None,
        "rmseH_final_with_declared_survey_error_m": rh,
        "rmseV_final_with_declared_survey_error_m": rv,
        "rmse3D_final_with_declared_survey_error_m": r3d,
        "maxHorizontalResidual_m": max(map(math.hypot, dx, dy)) if have_h else None,
        "maxAbsoluteVerticalResidual_m": max(map(abs, dz)) if have_v else None,
    }
    if any(not math.isfinite(x) for x in metrics.values() if x is not None):
        raise ValueError("Computed residual statistics overflow")
    return {
        "schema": "tsm-independent-positional-accuracy-computation-v1",
        "classification": "COMPUTED_UNCERTIFIED",
        "mode": mode,
        "sampleCount": n,
        "standards": {
            "ASPRS_2024_ED2_V2": {
                "reference": SOURCES["ASPRS_2024"], "minimumCheckpoints": 30,
                "minimumCountCriterionMet": n >= 30, "surveyErrorIncluded": valid_adjustment,
                "formalComplianceClaim": False,
            },
            "FGDC_NSSDA_1998": legacy,
        },
        "metrics": metrics,
        "evidence": provenance,
        "humanProfessionalReviewRequired": True,
        "note": "Coordinate/independence/coverage assertions are not independently verifiable from CSV. Hashes ensure byte identity, not measurement validity. 2024 accuracy classes and federal/survey certifications are NOT assigned.",
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoints", type=Path, required=True)
    parser.add_argument("--mode", choices=sorted(COLUMNS), required=True)
    parser.add_argument("--provenance", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.output.exists() or args.output.resolve() == args.checkpoints.resolve():
            raise ValueError("Refusing to overwrite existing evidence or output")
        rows = load_checkpoints(args.checkpoints, args.mode)
        p = evidence(args.provenance, args.checkpoints, args.mode)
        result = calculate(rows, args.mode, p)
        result["checkpointCsvSha256"] = file_sha256(args.checkpoints)
        with args.output.open("x", encoding="utf-8") as out:
            json.dump(result, out, sort_keys=True, indent=2, allow_nan=False)
            out.write("\n")
    except (OSError, ValueError, TypeError, KeyError, UnicodeError) as exc:
        print(json.dumps({"status": "FAILED", "error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps({"status": result["classification"], "n": result["sampleCount"],
                      "asprsMinimumCountMet": result["standards"]["ASPRS_2024_ED2_V2"]["minimumCountCriterionMet"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
