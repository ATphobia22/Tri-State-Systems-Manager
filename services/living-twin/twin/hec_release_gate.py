"""Headless, evidence-gated HEC-RAS versus USGS comparison cohort.

This compares already-imported O/H events. It does not execute or parse the HDF
solver, verify the reviewer, establish official datum ties, or publish a BFE.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from .contracts import canonical, validate
from .hydrology_validation import compare

SCHEMA = "tsm.hec-ras-observation-cohort.v1"
ARTIFACT_KEYS = ("geometry", "plan", "flow", "terrain", "result_hdf")
MAX_ARTIFACT_BYTES = 16 * 1024 * 1024 * 1024


def _is_hash(value):
    return isinstance(value, str) and len(value) == 64 and all(
        c in "0123456789abcdef" for c in value)


def _verify_artifact(root: Path, entry: dict) -> tuple[str | None, str | None]:
    if not isinstance(entry, dict):
        return None, "ARTIFACT_ENTRY_INVALID"
    name, expected = entry.get("path"), entry.get("sha256")
    if not isinstance(name, str) or not _is_hash(expected):
        return None, "ARTIFACT_IDENTITY_INVALID"
    relative = Path(name)
    if (relative.is_absolute() or not relative.parts
            or any(part in ("..", ".") for part in relative.parts)
            or "\\" in name or ":" in name):
        return None, "ARTIFACT_PATH_UNSAFE"
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            return None, "ARTIFACT_SYMLINK_REJECTED"
    try:
        resolved = current.resolve(strict=True)
        if not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
            return None, "ARTIFACT_PATH_ESCAPES_ROOT"
        if resolved.stat().st_size <= 0 or resolved.stat().st_size > MAX_ARTIFACT_BYTES:
            return None, "ARTIFACT_SIZE_INVALID"
        digest = hashlib.sha256()
        with resolved.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except (OSError, RuntimeError):
        return None, "ARTIFACT_MISSING_OR_UNREADABLE"
    if digest.hexdigest() != expected:
        return None, "ARTIFACT_SHA256_MISMATCH"
    return expected, None


def _metrics(samples: list[dict]) -> dict:
    """A descriptive cohort only; these are NOT a model acceptance threshold."""
    residuals = [x["residual_ft"] for x in samples]
    observed = [x["observed_wse_ft"] for x in samples]
    n = len(samples)
    if not n:
        return {"sample_count": 0, "rmse_ft": None, "mae_ft": None,
                "bias_ft": None, "nse": None, "max_abs_error_ft": None}
    mean_observed = sum(observed) / n
    denominator = sum((x - mean_observed) ** 2 for x in observed)
    return {
        "sample_count": n,
        "rmse_ft": math.sqrt(sum(x * x for x in residuals) / n),
        "mae_ft": sum(abs(x) for x in residuals) / n,
        "bias_ft": sum(residuals) / n,
        "max_abs_error_ft": max(abs(x) for x in residuals),
        "nse": 1 - (sum(x * x for x in residuals) / denominator)
            if n >= 2 and denominator > 0 else None,
    }


def assess(manifest: dict, pairs: list[dict], model_root: Path, *,
           gage_zero_by_station: dict | None = None) -> dict:
    """Never returns certified engineering or regulatory publication approval.

    A complete result is only a candidate for human review. Model extraction,
    datum review and calibration independence require separately checked evidence.
    """
    if not isinstance(manifest, dict) or manifest.get("schema") != SCHEMA:
        raise ValueError("Unsupported HEC comparison manifest schema")
    if not isinstance(pairs, list) or len(pairs) > 10000:
        raise ValueError("Expected at most 10000 event pairs")
    blockers: list[str] = []
    inventory = manifest.get("artifacts")
    digests: dict[str, str] = {}
    if not isinstance(inventory, dict):
        blockers.append("MODEL_ARTIFACT_INVENTORY_MISSING")
        inventory = {}
    for key in ARTIFACT_KEYS:
        value, reason = _verify_artifact(model_root, inventory.get(key))
        if reason:
            blockers.append(f"{key}:{reason}")
        else:
            digests[key] = value

    revision = manifest.get("model_revision_sha256")
    if not _is_hash(revision):
        blockers.append("MODEL_REVISION_IDENTITY_MISSING")
    if not isinstance(manifest.get("solver_version"), str) or not manifest["solver_version"].strip():
        blockers.append("HEC_RAS_SOLVER_VERSION_MISSING")
    if manifest.get("model_engine") != "HEC-RAS":
        blockers.append("MODEL_ENGINE_MISMATCH")
    if manifest.get("vertical_datum") != "NAVD88" or manifest.get("vertical_units") != "ft":
        blockers.append("MODEL_VERTICAL_DATUM_OR_UNITS_NOT_REVIEWED")
    if not isinstance(manifest.get("horizontal_crs"), str) or not manifest["horizontal_crs"].startswith("EPSG:"):
        blockers.append("MODEL_HORIZONTAL_CRS_NOT_DECLARED")
    approval = manifest.get("aoi_approval")
    if (not isinstance(approval, dict) or approval.get("status") != "APPROVED" or
            not approval.get("watershed_delineation_sha256") or
            not _is_hash(approval.get("watershed_delineation_sha256")) or
            not approval.get("approval_evidence_uri")):
        blockers.append("AOI_AND_WATERSHED_NOT_APPROVED")
    if (manifest.get("hdf_extraction_reviewed") is not True or
            not isinstance(manifest.get("hdf_extraction_evidence_uri"), str) or
            not manifest["hdf_extraction_evidence_uri"].startswith("https://")):
        blockers.append("HDF5_CELL_TIME_EXTRACTION_NOT_REVIEWED")
    max_skew = manifest.get("max_time_skew_seconds")
    if type(max_skew) is not int or not 0 <= max_skew <= 3600:
        blockers.append("TIME_ALIGNMENT_POLICY_INVALID")
        max_skew = 0

    samples: dict[str, list[dict]] = {"calibration": [], "holdout": []}
    evidence = []
    seen: set[tuple[str, str]] = set()
    partition_by_observation: dict[str, str] = {}
    gage_zero_by_station = gage_zero_by_station or {}
    for index, pair in enumerate(pairs):
        if not isinstance(pair, dict):
            blockers.append(f"PAIR_{index}:INVALID_PAIR")
            continue
        partition = pair.get("partition")
        obs, model = pair.get("observation"), pair.get("prediction")
        if partition not in samples:
            blockers.append(f"PAIR_{index}:UNKNOWN_CALIBRATION_PARTITION")
            continue
        try:
            validate(obs)
            validate(model)
            oid, pid = obs["event_id"], model["event_id"]
            identity = (oid, pid)
            if identity in seen or (oid in partition_by_observation and
                                    partition_by_observation[oid] != partition):
                blockers.append(f"PAIR_{index}:DUPLICATE_OR_LEAKED_CALIBRATION_OBSERVATION")
                continue
            seen.add(identity)
            partition_by_observation[oid] = partition
            if (model["state"].get("model_engine") != "HEC-RAS" or
                    model["state"].get("model_revision_sha256") != revision or
                    model["source"].get("sha256") != digests.get("result_hdf") or
                    obs["source"].get("authority") != "USGS"):
                blockers.append(f"PAIR_{index}:MODEL_OR_USGS_SOURCE_LINEAGE_MISMATCH")
                continue
            if partition == "holdout" and obs["state"].get("quality") != "Approved":
                blockers.append(f"PAIR_{index}:HOLDOUT_OBSERVATION_NOT_APPROVED")
                continue
            result = compare(obs, model, gage_zero=gage_zero_by_station.get(
                obs["state"].get("sensor_id")), max_skew_seconds=max_skew)
            if result.get("status") != "VALIDATED":
                blockers.append(f"PAIR_{index}:{result.get('reason', 'WITHHELD')}")
                continue
            if result.get("combined_uncertainty_ft") is None:
                blockers.append(f"PAIR_{index}:UNCERTAINTY_BUDGET_INCOMPLETE")
                continue
            samples[partition].append(result)
            evidence.append({"observation_event_id": oid, "prediction_event_id": pid,
                             "partition": partition, "datum_evidence": result["gage_zero_evidence"],
                             "observed_source_sha256": result["source_observation_sha256"],
                             "model_hdf_sha256": result["source_prediction_sha256"],
                             "time_skew_seconds": result["time_skew_seconds"],
                             "combined_uncertainty_ft": result["combined_uncertainty_ft"]})
        except (ValueError, TypeError, KeyError, AttributeError, OverflowError) as error:
            blockers.append(f"PAIR_{index}:INVALID_EVENT_OR_NUMERIC_INPUT:{type(error).__name__}")
    if len(samples["holdout"]) < 2:
        blockers.append("INDEPENDENT_HOLDOUT_NEEDS_AT_LEAST_TWO_PAIRED_SAMPLES")
    if not samples["calibration"]:
        blockers.append("CALIBRATION_COHORT_EMPTY")

    blockers = sorted(set(blockers))
    report = {
        "schema": SCHEMA, "version": 1,
        "status": "WITHHELD_EVIDENCE" if blockers else "PRELIMINARY_COMPARISON_FOR_HUMAN_REVIEW",
        "publicPublication": "BLOCKED_PENDING_INDEPENDENT_ENGINEERING_AND_AGENCY_REVIEW",
        "regulatoryDetermination": False, "engineeringCertification": False,
        "verificationScope": "LOCAL_ARTIFACT_SHA256_AND_EVENT_ALIGNMENT_ONLY",
        "limitations": [
            "Local hashes do not authenticate the original USACE or USGS source",
            "This process does not replay HEC-RAS, verify HDF array interpretation, or survey the station benchmark",
            "A physical model validation and qualified independent review are still required",
        ],
        "modelRevisionSha256": revision,
        "sourceArtifactSha256": digests,
        "blockers": blockers,
        "metrics": {name: _metrics(rows) for name, rows in samples.items()},
        "pairedEvidence": evidence,
    }
    report["auditSha256"] = hashlib.sha256(canonical(report).encode("utf-8")).hexdigest()
    return report


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("manifest", type=Path)
    cli.add_argument("pairs", type=Path)
    cli.add_argument("--model-root", required=True, type=Path)
    cli.add_argument("--gage-zero", type=Path, help="Station-indexed previously reviewed datum records")
    args = cli.parse_args()
    # Never accept giant arbitrary user-supplied JSON; large HDF assets stream separately.
    def read(path: Path) -> object:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 16 * 1024 * 1024:
            raise ValueError("Input JSON must be a bounded regular local file")
        return json.loads(path.read_text(encoding="utf-8"))
    result = assess(read(args.manifest), read(args.pairs), args.model_root,
                    gage_zero_by_station=read(args.gage_zero) if args.gage_zero else None)
    print(canonical(result))
    if result["status"] == "WITHHELD_EVIDENCE":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
