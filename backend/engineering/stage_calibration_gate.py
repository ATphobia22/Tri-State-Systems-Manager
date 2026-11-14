"""Artifact-bound HEC-RAS stage calibration/independent verification evaluator.

Computes paired RMSE, bias and Nash-Sutcliffe efficiency. It does NOT
run HEC-RAS, tune Manning n, generate hydrodynamic forecasts, or certify a
regulatory result. Caller-set acceptance criteria are explicit policy.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import sys

SHA = re.compile(r"[0-9a-f]{64}\Z")
MAX_BYTES = 4 * 1024 * 1024
MAX_POINTS = 100000
ROLES = {"CALIBRATION", "INDEPENDENT_VALIDATION"}


class CalibrationError(ValueError):
    """Missing, ambiguous, tampered or unmatched model evidence."""


def digest(path: Path, expected: str) -> str:
    if not isinstance(expected, str) or not SHA.fullmatch(expected):
        raise CalibrationError("ARTIFACT_SHA256_REQUIRED")
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_BYTES:
        raise CalibrationError("ARTIFACT_MISSING_OR_UNBOUNDED")
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for block in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(block)
    if h.hexdigest() != expected:
        raise CalibrationError("ARTIFACT_SHA256_MISMATCH")
    return expected


def offset_time(raw: str) -> datetime:
    try:
        t = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as exc:
        raise CalibrationError("INVALID_TIMESTAMP") from exc
    if t.utcoffset() is None:
        raise CalibrationError("TIMESTAMP_OFFSET_REQUIRED")
    return t


def series(path: Path, sha: str) -> dict[datetime, float]:
    digest(path, sha)
    out = {}
    with path.open(newline="", encoding="utf-8-sig") as fp:
        reader = csv.DictReader(fp)
        if reader.fieldnames != ["time", "stage"]:
            raise CalibrationError("CSV_MUST_HAVE_EXACT_TIME_STAGE_COLUMNS")
        for item in reader:
            if len(out) >= MAX_POINTS:
                raise CalibrationError("TOO_MANY_OBSERVATIONS")
            t = offset_time(item["time"])
            if t in out:
                raise CalibrationError("DUPLICATED_EVENT_TIMESTAMP")
            try:
                v = float(item["stage"])
            except (TypeError, ValueError) as exc:
                raise CalibrationError("NONNUMERIC_STAGE") from exc
            if not math.isfinite(v):
                raise CalibrationError("NONFINITE_STAGE")
            out[t] = v
    if len(out) < 3:
        raise CalibrationError("AT_LEAST_THREE_PAIRED_POINTS_REQUIRED")
    return out


def event_metrics(observed: dict[datetime, float], modeled: dict[datetime, float]) -> dict:
    if observed.keys() != modeled.keys():
        raise CalibrationError("TIMESTAMPS_MUST_MATCH_EXACTLY_NO_INTERPOLATION")
    n = len(observed)
    obs = [observed[t] for t in sorted(observed)]
    sim = [modeled[t] for t in sorted(observed)]
    errors = [s - o for o, s in zip(obs, sim)]
    bias = sum(errors) / n
    rmse = math.sqrt(sum(e * e for e in errors) / n)
    mean = sum(obs) / n
    denominator = sum((o - mean) ** 2 for o in obs)
    if denominator <= 1e-12:
        raise CalibrationError("NSE_UNDEFINED_FOR_CONSTANT_OBSERVATIONS")
    nse = 1.0 - sum(e * e for e in errors) / denominator
    return {"count": n, "bias": round(bias, 6), "rmse": round(rmse, 6), "nse": round(nse, 6)}


def evaluate(manifest: dict) -> dict:
    if not isinstance(manifest, dict) or manifest.get("modelEngine") != "HEC-RAS":
        raise CalibrationError("HEC_RAS_MANIFEST_REQUIRED")
    if not isinstance(manifest.get("runId"), str) or not manifest["runId"].strip():
        raise CalibrationError("MODEL_RUN_IDENTIFIER_REQUIRED")
    if not isinstance(manifest.get("modelVersion"), str) or not manifest["modelVersion"].strip():
        raise CalibrationError("MODEL_VERSION_REQUIRED")
    limits = manifest.get("thresholds", {})
    if not isinstance(limits, dict):
        raise CalibrationError("EXPLICIT_POLICY_THRESHOLDS_REQUIRED")
    try:
        max_rmse = float(limits["maxRmse"])
        max_abs_bias = float(limits["maxAbsBias"])
        min_nse = float(limits["minNse"])
    except (KeyError, ValueError, TypeError) as exc:
        raise CalibrationError("EXPLICIT_POLICY_THRESHOLDS_REQUIRED") from exc
    if (any(type(limits[k]) is bool for k in ("maxRmse", "maxAbsBias", "minNse"))
        or not all(math.isfinite(x) for x in (max_rmse, max_abs_bias, min_nse))
        or max_rmse <= 0 or max_abs_bias <= 0 or not (-10 <= min_nse <= 1)):
        raise CalibrationError("INVALID_CALIBRATION_THRESHOLDS")
    if manifest.get("thresholdAuthority") != "USER_DECLARED_REVIEW_POLICY":
        raise CalibrationError("THRESHOLDS_NOT_CALIBRATION_CERTIFICATION")
    events = manifest.get("events", [])
    if not isinstance(events, list) or not 2 <= len(events) <= 20:
        raise CalibrationError("TWO_TO_TWENTY_EVENTS_REQUIRED")
    seen_ids: set[str] = set()
    seen_times: set[datetime] = set()
    seen_roles: set[str] = set()
    results = []
    for event in events:
        if not isinstance(event, dict):
            raise CalibrationError("INVALID_EVENT")
        role = event.get("role")
        if role not in ROLES or event.get("eventId") in seen_ids:
            raise CalibrationError("INVALID_OR_DUPLICATED_EVENT_ROLE")
        if not isinstance(event.get("eventId"), str) or not event["eventId"]:
            raise CalibrationError("EVENT_ID_REQUIRED")
        seen_ids.add(event["eventId"])
        seen_roles.add(role)
        if event.get("units") not in ("ft", "m"):
            raise CalibrationError("UNITS_UNRESOLVED")
        for k in ("observedDatum", "modeledDatum"):
            if not isinstance(event.get(k), str) or not event[k].strip():
                raise CalibrationError("VERTICAL_DATUM_REQUIRED")
        if event["observedDatum"] != event["modeledDatum"]:
            raise CalibrationError("DATUM_MISMATCH_NO_IMPLICIT_CONVERSION")
        if event.get("datumControlPath") is None:
            raise CalibrationError("DATUM_CONTROL_EVIDENCE_REQUIRED")
        digest(Path(event["datumControlPath"]), event.get("datumControlSha256"))
        obs = series(Path(event["observedCsv"]), event.get("observedSha256"))
        sim = series(Path(event["modeledCsv"]), event.get("modeledSha256"))
        if seen_times.intersection(obs):
            raise CalibrationError("EVENTS_ARE_NOT_INDEPENDENT")
        seen_times.update(obs)
        scores = event_metrics(obs, sim)
        passed = (
            scores["rmse"] <= max_rmse and
            abs(scores["bias"]) <= max_abs_bias and
            scores["nse"] >= min_nse
        )
        results.append({
            "eventId": event["eventId"],
            "role": role,
            "stationId": event.get("stationId"),
            "units": event["units"],
            "verticalDatum": event["observedDatum"],
            "observedSha256": event["observedSha256"],
            "modeledSha256": event["modeledSha256"],
            "datumControlSha256": event["datumControlSha256"],
            **scores,
            "passesUserPolicy": passed,
        })
    if seen_roles != ROLES:
        raise CalibrationError("SEPARATE_CALIBRATION_AND_VALIDATION_EVENTS_REQUIRED")
    approved = all(r["passesUserPolicy"] for r in results)
    return {
        "schemaVersion": "tsm.hecras.calibration-assessment.v1",
        "modelEngine": "HEC-RAS",
        "runId": manifest["runId"],
        "modelVersion": manifest["modelVersion"],
        "thresholdAuthority": manifest["thresholdAuthority"],
        "thresholds": limits,
        "events": results,
        "assessmentState": "CANDIDATE_FOR_INDEPENDENT_REVIEW" if approved else "FAILED_USER_DECLARED_POLICY",
        "engineeringCertified": False,
        "regulatoryApproved": False,
        "forecastOperational": False,
        "note": "Historical paired-point skill only. Additional spatial, mass balance, event coverage and independent engineering review required.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.manifest.is_symlink() or not args.manifest.is_file() or args.manifest.stat().st_size > MAX_BYTES:
            raise CalibrationError("MANIFEST_MISSING_OR_UNBOUNDED")
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        assessment = evaluate(manifest)
        if args.out.exists() or args.out.is_symlink() or not args.out.parent.is_dir():
            raise CalibrationError("OUTPUT_MUST_BE_NEW_FILE_IN_EXISTING_DIRECTORY")
        with args.out.open("x", encoding="utf-8") as fp:
            json.dump(assessment, fp, indent=2, sort_keys=True, allow_nan=False)
            fp.write("\n")
    except (CalibrationError, OSError, ValueError, TypeError) as exc:
        parser.error(str(exc))
    print(json.dumps({"assessment": assessment["assessmentState"], "events": len(assessment["events"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
