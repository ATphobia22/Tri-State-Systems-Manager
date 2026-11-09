"""Artifact-bound acceptance contract for HEC-RAS, MODFLOW 6 and EPA SWMM coupling.

This validator inspects actual model-run evidence and exchanged fluxes; it never
runs solvers, supplies synthetic observations, or grants a regulatory decision.
All thresholds are explicit caller policy, not universally accepted tolerances.
"""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any

SOLVERS = frozenset({"HEC-RAS", "MODFLOW-6", "EPA-SWMM"})
SHA = frozenset("0123456789abcdef")


def _hash(path: str) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _valid_hash(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(c in SHA for c in value)


def _finite(value: Any) -> float:
    if isinstance(value, bool):
        raise ValueError("VALUE_IS_BOOLEAN")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("VALUE_NONFINITE")
    return number


def _timestamp(value: Any) -> datetime:
    if not isinstance(value, str):
        raise ValueError("TIMESTAMP_REQUIRED")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.utcoffset() is None:
        raise ValueError("TIMESTAMP_TIMEZONE_REQUIRED")
    return parsed


def evaluate_coupling(manifest: dict[str, Any]) -> dict[str, Any]:
    """Return a full diagnostic; raise on malformed or tampered artifacts."""
    if not isinstance(manifest, dict):
        raise ValueError("COUPLING_MANIFEST_REQUIRED")
    model_items = manifest.get("runs")
    if not isinstance(model_items, list) or len(model_items) != 3:
        raise ValueError("EXACTLY_THREE_SOLVER_RUNS_REQUIRED")
    seen: set[str] = set()
    checks = []
    validated: dict[str, dict[str, Any]] = {}

    for item in model_items:
        if not isinstance(item, dict):
            raise ValueError("SOLVER_RUN_MUST_BE_OBJECT")
        engine = item.get("engine")
        if engine not in SOLVERS or engine in seen:
            raise ValueError("SOLVER_RUN_MISSING_OR_DUPLICATED")
        seen.add(engine)
        if not all(isinstance(item.get(k), str) and item[k].strip()
                   for k in ("runId", "version", "horizontalCrs", "verticalDatum",
                             "fluxUnits", "timeStepSeconds")):
            raise ValueError("SOLVER_VERSION_DATUM_UNIT_OR_RUN_ID_REQUIRED")
        if _finite(item["timeStepSeconds"]) <= 0:
            raise ValueError("SOLVER_TIMESTEP_INVALID")
        input_files = item.get("inputs", [])
        output_files = item.get("outputs", [])
        if not isinstance(input_files, list) or not input_files:
            raise ValueError("SOLVER_INPUTS_REQUIRED")
        if not isinstance(output_files, list) or not output_files:
            raise ValueError("SOLVER_OUTPUTS_REQUIRED")
        for artifact in input_files + output_files:
            if not isinstance(artifact, dict) or not _valid_hash(artifact.get("sha256")):
                raise ValueError("SOLVER_ARTIFACT_DIGEST_INVALID")
            path = artifact.get("path")
            if not isinstance(path, str) or not Path(path).is_file():
                raise ValueError("SOLVER_ARTIFACT_MISSING")
            if _hash(path) != artifact["sha256"]:
                raise ValueError("SOLVER_ARTIFACT_HASH_MISMATCH")
        report = item.get("validation", {})
        if not isinstance(report, dict):
            raise ValueError("SOLVER_VALIDATION_REPORT_REQUIRED")
        passed_convergence = report.get("converged") is True
        conservation = _finite(report.get("massBalanceErrorPercent"))
        max_allowed = _finite(report.get("maxMassBalanceErrorPercent"))
        if conservation < 0 or max_allowed <= 0:
            raise ValueError("SOLVER_MASS_BALANCE_INVALID")
        benchmark = report.get("benchmark")
        if not isinstance(benchmark, dict):
            raise ValueError("SOLVER_BENCHMARK_REQUIRED")
        observations, predictions = benchmark.get("observed"), benchmark.get("predicted")
        if not isinstance(observations, list) or not isinstance(predictions, list) or len(observations) < 3 or len(observations) != len(predictions):
            raise ValueError("SOLVER_BENCHMARK_PAIRS_REQUIRED")
        pairs = list(zip((_finite(x) for x in observations), (_finite(x) for x in predictions)))
        rmse = math.sqrt(sum((actual-predicted)**2 for actual, predicted in pairs) / len(pairs))
        benchmark_max = _finite(benchmark.get("maxRmse"))
        if benchmark_max < 0 or not isinstance(benchmark.get("reference"), str) or not benchmark["reference"].strip():
            raise ValueError("SOLVER_BENCHMARK_THRESHOLD_AND_REFERENCE_REQUIRED")
        passed = passed_convergence and conservation <= max_allowed and rmse <= benchmark_max
        validated[engine] = item
        checks.append({
            "engine": engine, "runId": item["runId"], "version": item["version"],
            "converged": passed_convergence, "massBalanceErrorPercent": conservation,
            "maxMassBalanceErrorPercent": max_allowed, "benchmarkRmse": rmse,
            "benchmarkMaxRmse": benchmark_max, "passed": passed,
        })
    if seen != SOLVERS:
        raise ValueError("COUPLING_SOLVER_SET_INCOMPLETE")
    exchanges = manifest.get("exchanges")
    if not isinstance(exchanges, list) or not exchanges:
        raise ValueError("MODEL_EXCHANGES_REQUIRED")
    exchange_checks = []
    for edge in exchanges:
        if not isinstance(edge, dict):
            raise ValueError("EXCHANGE_MUST_BE_OBJECT")
        src, dst = edge.get("from"), edge.get("to")
        if src not in SOLVERS or dst not in SOLVERS or src == dst:
            raise ValueError("EXCHANGE_ENDPOINT_INVALID")
        source, target = validated[src], validated[dst]
        for key in ("horizontalCrs", "verticalDatum", "fluxUnits", "timeStepSeconds"):
            if source[key] != target[key] or edge.get(key) != source[key]:
                raise ValueError("EXCHANGE_CRS_DATUM_UNIT_OR_TIMESTEP_MISMATCH:" + key)
        _timestamp(edge.get("timestamp"))
        source_volume = _finite(edge.get("sourceVolume"))
        target_volume = _finite(edge.get("targetVolume"))
        tolerance = _finite(edge.get("maxAbsoluteVolumeDifference"))
        if tolerance < 0:
            raise ValueError("EXCHANGE_VOLUME_TOLERANCE_INVALID")
        delta = abs(source_volume - target_volume)
        exchange_checks.append({"from": src, "to": dst, "absoluteVolumeDifference": delta,
                                "maxAbsoluteVolumeDifference": tolerance, "passed": delta <= tolerance})
    return {
        "schemaVersion": "tsm.hydrologic-coupling-acceptance.v1",
        "solverChecks": checks, "exchangeChecks": exchange_checks,
        "verified": all(c["passed"] for c in checks + exchange_checks),
        "regulatoryApproval": False,
        "notice": "Synthetic/model evidence requires independent site calibration and authorized human review.",
    }


def inspect_manifest(path: str) -> dict[str, Any]:
    return evaluate_coupling(json.loads(Path(path).read_text(encoding="utf8")))
