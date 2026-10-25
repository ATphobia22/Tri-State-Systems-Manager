#!/usr/bin/env python3
"""Evidence-gated engineering readiness checks; never issue a certification.

This is an input/provenance screening tool, not a surveying instrument,
numerical mesher, FEMA determination, or substitute for professional review.
All sample documents in tests are synthetic and explicitly non-authoritative.

Use: python scripts/engineering/validate_authority_readiness.py \
  --input evidence-bundle.json --root . --output validation-report.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

SHA = re.compile(r"^[0-9a-f]{64}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
EPSG = re.compile(r"^EPSG:\d{4,6}$")
MODEL_KINDS = ("effective", "duplicateEffective", "correctedEffective", "proposed")
ORIENTATIONS = ("+x", "-x", "+y", "-y", "+z", "-z")
SOURCE_URLS = {
    "terrain": "https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-online",
    "mesh": "https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-data-processing-and-handling-requirements",
    "floodway": "https://secure.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/no-rise",
}
LABELS = ("NONVEGETATED", "VEGETATED")


def positive_number(value: Any, *, allow_zero: bool = False) -> bool:
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and (value >= 0 if allow_zero else value > 0))


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked_file(entry: Any, root: Path, errors: list[str], label: str) -> str | None:
    """Check a local immutable source; disallow absolute/traversal paths and links."""
    if not isinstance(entry, dict):
        errors.append(f"{label}: path and sha256 evidence is required")
        return None
    name, claimed = entry.get("path"), entry.get("sha256")
    if not isinstance(name, str) or not name.strip() or "\\" in name or ":" in name:
        errors.append(f"{label}: invalid relative file path")
        return None
    candidate = Path(name)
    if candidate.is_absolute() or ".." in candidate.parts or "." in candidate.parts:
        errors.append(f"{label}: path must remain under the evidence root")
        return None
    if not isinstance(claimed, str) or not SHA.fullmatch(claimed):
        errors.append(f"{label}: expected lowercase SHA-256 digest")
        return None
    try:
        target = root.joinpath(candidate)
        resolved_root = root.resolve(strict=True)
        resolved = target.resolve(strict=True)
        if not resolved.is_relative_to(resolved_root) or resolved.is_symlink() or target.is_symlink():
            errors.append(f"{label}: unsafe path or symbolic link")
            return None
        if not resolved.is_file():
            errors.append(f"{label}: evidence path is not a regular file")
            return None
        actual = hash_file(resolved)
    except (OSError, RuntimeError, ValueError) as exc:
        errors.append(f"{label}: source evidence unavailable ({type(exc).__name__})")
        return None
    if actual != claimed:
        errors.append(f"{label}: checksum mismatch")
        return None
    return actual


def required_string(obj: Any, name: str, errors: list[str], label: str) -> str:
    value = obj.get(name) if isinstance(obj, dict) else None
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}.{name}: nonblank metadata required")
        return ""
    return value.strip()


def check_reference(obj: Any, errors: list[str], label: str) -> None:
    h = required_string(obj, "horizontalCrs", errors, label)
    v = required_string(obj, "verticalDatum", errors, label)
    u = required_string(obj, "verticalUnit", errors, label)
    if h and not EPSG.fullmatch(h):
        errors.append(f"{label}.horizontalCrs: explicit EPSG:<code> required")
    if v and v not in ("NAVD88", "NGVD29", "ELLIPSOIDAL_NAD83_2011"):
        errors.append(f"{label}.verticalDatum: unsupported or unresolved datum")
    if u and u not in ("m", "ft", "us-ft"):
        errors.append(f"{label}.verticalUnit: explicit m/ft/us-ft required")
    # Orthometric vs ellipsoidal ambiguity cannot be reconciled by a constant offset.
    if v == "ELLIPSOIDAL_NAD83_2011":
        errors.append(f"{label}: ellipsoidal heights cannot be used as NAVD88 without grid/epoch transformation evidence")


def terrain(bundle: dict[str, Any], root: Path, errors: list[str]) -> dict[str, Any]:
    source, survey = bundle.get("source"), bundle.get("survey")
    source = source if isinstance(source, dict) else {}
    survey = survey if isinstance(survey, dict) else {}
    checked_file(source.get("raster"), root, errors, "source.raster")
    check_reference(source, errors, "source")
    quality = required_string(source, "qualityLevel", errors, "source")
    if quality not in ("QL0", "QL1", "QL2", "QL3"):
        errors.append("source.qualityLevel: documented USGS quality level required")
    acquisition_date = required_string(source, "acquisitionDate", errors, "source")
    if acquisition_date and not DATE.fullmatch(acquisition_date):
        errors.append("source.acquisitionDate: ISO YYYY-MM-DD acquisition date required")
    source_epoch = required_string(source, "coordinateEpoch", errors, "source")
    if source.get("verticalUnit") != "m":
        checked_file(source.get("heightUnitNormalizationEvidence"), root, errors, "source.heightUnitNormalizationEvidence")
    checked_file(survey.get("controlReport"), root, errors, "survey.controlReport")
    checked_file(survey.get("distributionReport"), root, errors, "survey.distributionReport")
    required_string(survey, "surveyMethod", errors, "survey")
    required_string(survey, "surveyorOfRecord", errors, "survey")
    survey_date = required_string(survey, "surveyDate", errors, "survey")
    if survey_date and not DATE.fullmatch(survey_date):
        errors.append("survey.surveyDate: ISO YYYY-MM-DD survey date required")
    required_string(survey, "independenceStatement", errors, "survey")

    checkpoints = survey.get("checkpoints")
    if not isinstance(checkpoints, list):
        checkpoints = []
        errors.append("survey.checkpoints: independent measured checkpoint records are required")
    ids: list[str] = []
    nva: list[tuple[float, float]] = []
    vva_count = 0
    for index, item in enumerate(checkpoints):
        label = f"survey.checkpoints[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{label}: checkpoint must be an object")
            continue
        identity = required_string(item, "id", errors, label)
        if identity:
            ids.append(identity)
        if item.get("verticalDatum") != source.get("verticalDatum") or item.get("horizontalCrs") != source.get("horizontalCrs"):
            errors.append(f"{label}: checkpoint frame/datum differs from raster")
        if item.get("coordinateEpoch") != source_epoch:
            errors.append(f"{label}: explicit matching coordinate epoch is required")
        if item.get("independent") is not True:
            errors.append(f"{label}: source-independent checkpoint is required")
        if item.get("landCover") not in LABELS:
            errors.append(f"{label}: landCover must be NONVEGETATED or VEGETATED")
        z, measured, sigma = (item.get("rasterHeightM"), item.get("surveyHeightM"), item.get("surveyUncertaintyM"))
        if not all(positive_number(x, allow_zero=True) for x in (sigma,)):
            errors.append(f"{label}: checkpoint vertical uncertainty must be finite and nonnegative")
        if not (isinstance(z, (int, float)) and not isinstance(z, bool) and math.isfinite(z)
                and isinstance(measured, (int, float)) and not isinstance(measured, bool) and math.isfinite(measured)):
            errors.append(f"{label}: numeric, finite rasterHeightM and surveyHeightM required")
            continue
        if item.get("landCover") == "NONVEGETATED" and positive_number(sigma, allow_zero=True):
            nva.append((float(z) - float(measured), float(sigma)))
        if item.get("landCover") == "VEGETATED":
            vva_count += 1
    if len(ids) != len(set(ids)):
        errors.append("survey.checkpoints: duplicate checkpoint identifier")
    # 2024 ASPRS checkpoint quantity/distribution depend on size and land-cover mix.
    # 30 is only the USGS minimum, not a universal sufficient sample design.
    if len(checkpoints) < 30:
        errors.append("survey.checkpoints: at least 30 independent distributed checkpoints are required")
    if not nva:
        errors.append("survey.checkpoints: nonvegetated control data are unavailable")
    if not vva_count:
        errors.append("survey.checkpoints: vegetated checkpoint coverage not documented")
    area = bundle.get("areaKm2")
    covered = bundle.get("rasterCoverageKm2")
    if not (positive_number(area) and positive_number(covered) and covered >= area):
        errors.append("coverage: raster must cover the declared area (including project buffer requirements)")
    rmse = math.sqrt(sum(diff * diff for diff, _ in nva) / len(nva)) if nva else None
    conservative = (math.sqrt(sum(diff * diff + sigma * sigma for diff, sigma in nva) / len(nva))
                    if nva else None)
    limits = {"QL0": 0.05, "QL1": 0.10, "QL2": 0.10, "QL3": 0.20}
    threshold = limits.get(quality)
    if threshold is not None and conservative is not None and conservative > threshold:
        errors.append("nonvegetated checkpoint conservative diagnostic exceeds USGS quality-level threshold")
    return {
        "checkpointCount": len(checkpoints),
        "nonvegetatedCount": len(nva),
        "vegetatedCount": vva_count,
        "nonvegetatedRmseM": round(rmse, 8) if rmse is not None else None,
        "conservativeRmseIncludingCheckpointUncertaintyM": round(conservative, 8) if conservative is not None else None,
        "usgsQualityLevelDiagnosticThresholdM": threshold,
        "caution": "ASPRS 2024 checkpoint distribution, independent surveying and professional assessment remain separate"
    }


def _verified_json(entry: Any, confirmed_hash: str | None, root: Path,
                   errors: list[str], label: str) -> dict[str, Any]:
    if not confirmed_hash or not isinstance(entry, dict):
        return {}
    try:
        source = root / entry["path"]
        if source.stat().st_size > 20 * 1024 * 1024:
            raise ValueError("report too large (20 MB cap)")
        value = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("report root is not an object")
        return value
    except (OSError, UnicodeError, ValueError) as exc:
        errors.append(f"{label}: invalid verified JSON evidence ({type(exc).__name__})")
        return {}


def mesh(bundle: dict[str, Any], root: Path, errors: list[str]) -> dict[str, Any]:
    run_sha = checked_file(bundle.get("runReport"), root, errors, "runReport")
    mesh_sha = checked_file(bundle.get("meshArtifact"), root, errors, "meshArtifact")
    audit_sha = checked_file(bundle.get("seamAudit"), root, errors, "seamAudit")
    boundary_sha = checked_file(bundle.get("countyBoundary"), root, errors, "countyBoundary")
    sources = bundle.get("sourceTiles")
    if not isinstance(sources, list) or not sources:
        errors.append("sourceTiles: source DEM inventory required")
        sources = []
    sources_sha = []
    for i, item in enumerate(sources):
        result = checked_file(item, root, errors, f"sourceTiles[{i}]")
        if result:
            sources_sha.append(result)
    if bundle.get("extractionMode") != "FULL_ADAPTIVE_OCTREE":
        errors.append("extractionMode: full adaptive-octree county terrain is required; transition-face strips do not qualify")
    if bundle.get("twoToOneBalanced") is not True:
        errors.append("twoToOneBalanced: verified 2:1 LOD balancing required")
    county = bundle.get("countyAreaKm2")
    covered = bundle.get("coveredAreaKm2")
    if not positive_number(county) or not positive_number(covered) or covered < county:
        errors.append("coverage: county-wide coverage not established")
    orientations = bundle.get("verifiedSeamDirections")
    if (not isinstance(orientations, list) or any(not isinstance(x, str) for x in orientations)
            or set(orientations) != set(ORIENTATIONS) or len(orientations) != 6):
        errors.append("verifiedSeamDirections: all six distinct +x/-x/+y/-y/+z/-z orientations required")
    count = bundle.get("seamPairsChecked")
    if not isinstance(count, int) or isinstance(count, bool) or count <= 0:
        errors.append("seamPairsChecked: positive measured seam count required")
    for field in ("trueCrackCount", "nonManifoldEdges", "unexplainedNoDataSeams", "orphanTriangles"):
        value = bundle.get(field)
        if not isinstance(value, int) or isinstance(value, bool) or value != 0:
            errors.append(f"{field}: must be measured and zero, not omitted or inferred")
    for name in ("meshRecomputedAgainstSource", "deterministicRepeatHashMatch", "datumAlignmentVerified"):
        if bundle.get(name) is not True:
            errors.append(f"{name}: independently verified true value required")

    # Cross-check claims against *file contents* as well as their SHA-256. This
    # is not just a mutable status field or a copied assertion of clean seams.
    report = _verified_json(bundle.get("runReport"), run_sha, root, errors, "runReport")
    audit = _verified_json(bundle.get("seamAudit"), audit_sha, root, errors, "seamAudit")
    expected_report_fields = (
        "extractionMode", "countyAreaKm2", "coveredAreaKm2", "twoToOneBalanced",
        "verifiedSeamDirections", "seamPairsChecked", "trueCrackCount",
        "nonManifoldEdges", "unexplainedNoDataSeams", "orphanTriangles",
        "meshRecomputedAgainstSource", "deterministicRepeatHashMatch",
        "datumAlignmentVerified"
    )
    if report.get("schemaVersion") != "tsm.full-county-mesh-measurement.v1":
        errors.append("runReport: measured full-county mesh report schema required")
    for key in expected_report_fields:
        if report.get(key) != bundle.get(key):
            errors.append(f"runReport.{key}: source measurement does not match submission")
    if mesh_sha is None or report.get("meshArtifactSha256") != mesh_sha:
        errors.append("runReport.meshArtifactSha256: must match independently hashed mesh bytes")
    if audit_sha is None or report.get("seamAuditSha256") != audit_sha:
        errors.append("runReport.seamAuditSha256: must match independently hashed seam audit")
    if boundary_sha is None or report.get("countyBoundarySha256") != boundary_sha:
        errors.append("runReport.countyBoundarySha256: pinned AOI polygon required")
    recorded_sources = report.get("sourceTileSha256")
    if (not isinstance(recorded_sources, list)
            or any(not isinstance(x, str) or not SHA.fullmatch(x) for x in recorded_sources)
            or sorted(recorded_sources) != sorted(sources_sha) or len(sources_sha) != len(sources)):
        errors.append("runReport.sourceTileSha256: checked tile hashes do not match recorded input inventory")
    if audit.get("schemaVersion") != "tsm.geometric-seam-audit.v1":
        errors.append("seamAudit: measured geometrical interface report required")
    if audit.get("status") != "MEASURED_SEAM_SEGMENTS_MATCH_FOR_REVIEW" or audit.get("errors") != []:
        errors.append("seamAudit: any invalid or mismatched triangle segments block acceptance")
    if (audit.get("interfacePairsSubmitted") != count or
            audit.get("matchedInterfaces") != count):
        errors.append("seamAudit: actual matched interface count must equal measured county seam count")
    audit_directions = audit.get("verifiedDirections")
    if (not isinstance(orientations, list) or not isinstance(audit_directions, list)
            or any(not isinstance(x, str) for x in audit_directions + orientations)
            or set(audit_directions) != set(orientations)):
        errors.append("seamAudit: geometric directions differ from declared six-direction proof")
    return {
        "coveredAreaKm2": covered,
        "countyAreaKm2": county,
        "seamPairsChecked": count,
        "testedDirections": sorted(orientations) if isinstance(orientations, list) else [],
        "runReportSha256": run_sha,
        "seamAuditSha256": audit_sha,
        "meshArtifactSha256": mesh_sha,
        "countyBoundarySha256": boundary_sha,
        "sourceTileSha256": sorted(sources_sha),
        "caution": "Reports and mesh bytes are integrity-linked; source authenticity, surveyed terrain accuracy and county polygon analysis still require independent review"
    }


def floodway(bundle: dict[str, Any], root: Path, errors: list[str]) -> dict[str, Any]:
    regulator = bundle.get("regulatoryContext")
    regulator = regulator if isinstance(regulator, dict) else {}
    jurisdiction = required_string(regulator, "community", errors, "regulatoryContext")
    panel = required_string(regulator, "effectiveFirmPanel", errors, "regulatoryContext")
    date = required_string(regulator, "firmEffectiveDate", errors, "regulatoryContext")
    if date and not DATE.fullmatch(date):
        errors.append("regulatoryContext.firmEffectiveDate: ISO date required")
    if regulator.get("isFemaRegulatoryFloodway") not in (True, False):
        errors.append("regulatoryContext.isFemaRegulatoryFloodway: verified floodway applicability required")
    if not panel or not jurisdiction:
        errors.append("regulatoryContext: panel and community required")
    checked_file(regulator.get("firmOrFaraSource"), root, errors, "regulatoryContext.firmOrFaraSource")
    for key in ("horizontalCrs", "verticalDatum", "verticalUnit"):
        if key not in regulator:
            errors.append(f"regulatoryContext.{key}: missing geodetic header")
    check_reference(regulator, errors, "regulatoryContext")
    models = bundle.get("models")
    models = models if isinstance(models, dict) else {}
    for key in MODEL_KINDS:
        model = models.get(key)
        if not isinstance(model, dict):
            errors.append(f"models.{key}: model input/output and run metadata required")
            continue
        checked_file(model.get("input"), root, errors, f"models.{key}.input")
        checked_file(model.get("output"), root, errors, f"models.{key}.output")
        required_string(model, "softwareVersion", errors, f"models.{key}")
        required_string(model, "runTimestamp", errors, f"models.{key}")
        if model.get("solverSucceeded") is not True:
            errors.append(f"models.{key}.solverSucceeded: verified execution required")
    stations = bundle.get("waterSurfaceComparisons")
    if not isinstance(stations, list) or not stations:
        errors.append("waterSurfaceComparisons: observed model output comparisons required")
        stations = []
    ids: list[str] = []
    rises: list[float] = []
    for i, row in enumerate(stations):
        label = f"waterSurfaceComparisons[{i}]"
        if not isinstance(row, dict):
            errors.append(f"{label}: object required")
            continue
        s = required_string(row, "crossSectionId", errors, label)
        if s: ids.append(s)
        baseline, proposed = row.get("effectiveOrCorrectedWseFt"), row.get("proposedWseFt")
        if not (isinstance(baseline, (int, float)) and not isinstance(baseline, bool)
                and math.isfinite(baseline) and isinstance(proposed, (int, float))
                and not isinstance(proposed, bool) and math.isfinite(proposed)):
            errors.append(f"{label}: finite paired water-surface elevations required")
            continue
        if row.get("verticalDatum") != regulator.get("verticalDatum") or row.get("verticalUnit") != "ft":
            errors.append(f"{label}: water surfaces must be datum-consistent feet")
        rises.append(float(proposed) - float(baseline))
    if len(ids) != len(set(ids)):
        errors.append("waterSurfaceComparisons: duplicate cross-section identifiers")
    if bundle.get("hydrologyAndBoundaryConditionsVerified") is not True:
        errors.append("hydrologyAndBoundaryConditionsVerified: calibrated design discharge and boundaries required")
    if bundle.get("modelComparisonVerified") is not True:
        errors.append("modelComparisonVerified: effective/duplicate/corrected/proposed reconciliation required")
    checked_file(bundle.get("engineeringReviewDocument"), root, errors, "engineeringReviewDocument")
    required_string(bundle, "licensedReviewer", errors, "floodway")
    maximum = max(rises) if rises else None
    fema_floodway = regulator.get("isFemaRegulatoryFloodway") is True
    positive_rise = maximum is not None and maximum > 0
    if fema_floodway and positive_rise:
        errors.append("FEMA regulatory floodway: any computed increase is not a no-rise finding; obtain appropriate CLOMR/LOMR and official review")
    return {
        "crossSectionsCompared": len(rises),
        "maximumComputedRiseFt": round(maximum, 8) if maximum is not None else None,
        "femaFloodwayAnyIncreaseFlag": fema_floodway and positive_rise,
        "reviewPath": ("FEMA_CLOMR_LOMR_OR_NO_RISE_PROFESSIONAL_REVIEW" if fema_floodway else "LOCAL_STATE_JURISDICTION_REVIEW"),
        "notice": "No-rise/CLOMR/LOMR, Indiana permit and FARA are agency/professional decisions; 0.15 ft state definition is not federal no-rise permission"
    }


def validate(bundle: Any, root: Path) -> dict[str, Any]:
    errors: list[str] = []
    if not isinstance(bundle, dict):
        return {"status": "INCOMPLETE", "errors": ["evidence bundle must be a JSON object"], "approved": False}
    kind = bundle.get("kind")
    if kind not in ("terrain", "mesh", "floodway"):
        return {"status": "INCOMPLETE", "errors": ["kind must be terrain, mesh or floodway"], "approved": False}
    funcs = {"terrain": terrain, "mesh": mesh, "floodway": floodway}
    metrics = funcs[kind](bundle, root, errors)
    return {
        "schemaVersion": "tsm.authority-evidence-gate.v1",
        "kind": kind,
        "status": "INCOMPLETE" if errors else "TECHNICAL_EVIDENCE_READY_FOR_HUMAN_REVIEW",
        "approved": False,
        "regulatoryDetermination": None,
        "professionalCertification": None,
        "errors": errors,
        "metrics": metrics,
        "authoritativeReference": SOURCE_URLS[kind],
        "limitations": "Self-described metadata plus local SHA-256 checks; independent source validation, measurement and authorized professional decision remain necessary."
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--root", type=Path, default=Path("."))
    p.add_argument("--output", type=Path)
    p.add_argument("--require-ready", action="store_true",
                   help="return 1 unless complete technical metadata is supplied; never certify")
    args = p.parse_args()
    try:
        bundle = json.loads(args.input.read_text(encoding="utf-8"))
        report = validate(bundle, args.root)
    except (OSError, ValueError) as exc:
        p.exit(2, f"ERROR: {type(exc).__name__}: unable to read evidence bundle\n")
    output = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    print(output)
    return 1 if args.require_ready and report["status"] == "INCOMPLETE" else 0


if __name__ == "__main__":
    raise SystemExit(main())
