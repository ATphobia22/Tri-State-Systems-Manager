#!/usr/bin/env python3
"""Independent evidence gates for terrain, county mesh, and floodway review.

Evaluates supplied evidence; never creates measurements, certificates, or permits.
A passing record is a TECHNICAL PRECHECK only. The authority to accept any
engineering or regulatory submission remains with licensed professionals and
the applicable local/state/federal agencies.
"""
from __future__ import annotations
import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

SHA256 = re.compile(r"^[a-f0-9]{64}$")
STATES = ("VERIFIED_PRECHECK", "INCOMPLETE", "REJECTED")


def finite(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def positive(value: Any) -> bool:
    return finite(value) and value > 0


def digest(value: Any) -> bool:
    return isinstance(value, str) and SHA256.fullmatch(value) is not None


def checks(record: dict[str, Any]) -> dict[str, Any]:
    errors: dict[str, list[str]] = {"terrain": [], "countyMesh": [], "regulatory": []}
    terrain = record.get("terrain") or {}
    mesh = record.get("countyMesh") or {}
    regulatory = record.get("regulatory") or {}
    t = errors["terrain"]
    m = errors["countyMesh"]
    r = errors["regulatory"]

    for name in ("sourceSha256", "controlSurveySha256", "checkpointReportSha256"):
        if not digest(terrain.get(name)):
            t.append(name + " requires a real lowercase SHA-256 digest")
    if terrain.get("horizontalCrs") != "EPSG:2966":
        t.append("horizontal CRS must be EPSG:2966 with declared unit metadata")
    if terrain.get("verticalDatum") != "NAVD88":
        t.append("orthometric elevations must be traceable to NAVD88")
    if terrain.get("geoidModel") not in ("GEOID18", "NONE_ORTHOMETRIC_SOURCE"):
        t.append("require compatible GEOID18 or documented native orthometric source")
    if terrain.get("geoidModel") == "GEOID18" and terrain.get("geometricDatum") != "NAD83(2011)":
        t.append("GEOID18 ellipsoid heights require NAD83(2011) metadata")
    if terrain.get("verticalUnits") not in ("m", "ft", "us-ft"):
        t.append("explicit vertical units required")
    if terrain.get("sourceQualityLevel") not in ("QL0", "QL1", "QL2", "QL3"):
        t.append("source lidar quality level must be declared")
    if not isinstance(terrain.get("controlSurveyProfessional"), str) or not terrain["controlSurveyProfessional"].strip():
        t.append("independent survey-control responsible professional is required")
    checkpoints = terrain.get("independentCheckpoints")
    if not isinstance(checkpoints, list) or not checkpoints:
        t.append("independent survey checkpoints required; synthetic or empty sets rejected")
    else:
        diffs = []
        seen = set()
        for i, pt in enumerate(checkpoints):
            if not isinstance(pt, dict):
                t.append(f"checkpoint[{i}] invalid")
                continue
            ident = pt.get("id")
            if not isinstance(ident, str) or not ident or ident in seen:
                t.append(f"checkpoint[{i}] must have distinct ID")
            seen.add(ident)
            if pt.get("surveyMethod") not in ("GNSS_CONTROL", "DIFFERENTIAL_LEVELING", "TOTAL_STATION_CONTROL"):
                t.append(f"checkpoint[{i}] lacks independently documented survey method")
            if pt.get("source") != "INDEPENDENT_SURVEY" or not digest(pt.get("observationSha256")):
                t.append(f"checkpoint[{i}] independent source digest missing")
            observed, modeled = pt.get("observedNavd88M"), pt.get("demNavd88M")
            if not finite(observed) or not finite(modeled):
                t.append(f"checkpoint[{i}] must have finite NAVD88 meter heights")
            else:
                diffs.append(float(modeled) - float(observed))
        if diffs:
            rmse = math.sqrt(sum(d*d for d in diffs) / len(diffs))
            terrain["computedRmseZM"] = rmse
            max_rmse = terrain.get("predeclaredRmseLimitM")
            if not positive(max_rmse):
                t.append("predeclared accuracy target must be positive and documented")
            elif rmse > max_rmse:
                t.append(f"independent checkpoint RMSEz {rmse:.6f} m exceeds declared {max_rmse} m")
    if terrain.get("checkpointIndependenceValidated") is not True:
        t.append("survey checkpoints must be verified independent of DEM generation")
    if terrain.get("checkpointSpatialRepresentativenessReviewed") is not True:
        t.append("qualified review of checkpoint coverage across terrain/land-cover classes required")
    if terrain.get("surveyReportApprovedByQualifiedProfessional") is not True:
        t.append("survey validation report requires qualified professional review")
    
    for name in ("meshSourceSha256", "seamReportSha256", "topologyReportSha256", "tileCoverageSha256"):
        if not digest(mesh.get(name)):
            m.append(name + " requires source/analysis hash")
    if mesh.get("terrainSourceSha256") != terrain.get("sourceSha256"):
        m.append("county mesh must bind to validated terrain source hash")
    if mesh.get("countyName") != "Posey" or mesh.get("countyState") != "IN":
        m.append("explicit Posey County Indiana AOI required")
    for field in ("expectedTileCount", "validatedTileCount", "boundaryEdgeChecks", "internalSeamChecks"):
        if not isinstance(mesh.get(field), int) or isinstance(mesh.get(field), bool) or mesh[field] <= 0:
            m.append(field + " must be a positive integer")
    if (isinstance(mesh.get("expectedTileCount"), int)
            and mesh.get("validatedTileCount") != mesh.get("expectedTileCount")):
        m.append("full county tile coverage not established")
    for field in ("trueCrackCount", "nonManifoldEdgeCount", "invalidGeometryCount", "uncoveredTileCount"):
        if mesh.get(field) != 0:
            m.append(field + " must equal zero, based on measured geometry")
    tol = mesh.get("predeclaredSeamToleranceM")
    measured = mesh.get("maximumMeasuredSeamGapM")
    if not positive(tol) or not finite(measured) or measured < 0 or measured > tol:
        m.append("measured seam error must be finite, nonnegative and within declared tolerance")
    if mesh.get("allNeighborPairsChecked") is not True or mesh.get("boundaryClosureValidated") is not True:
        m.append("complete adjacency and county boundary validation required")
    if mesh.get("geometryValidatorPassed") is not True:
        m.append("independent mesh topology and geometry validator required")
    
    for name in ("approvedBaseModelSha256", "proposedModelSha256", "hydraulicOutputSha256", "engineerReviewSha256"):
        if not digest(regulatory.get(name)):
            r.append(name + " requires exact file digest")
    if regulatory.get("modelDatum") != terrain.get("verticalDatum"):
        r.append("hydraulic WSE datum must align with surveyed terrain")
    if regulatory.get("hydraulicModelStatus") != "EXECUTED_AND_CALIBRATED":
        r.append("real hydraulic solver execution and calibration evidence required")
    if regulatory.get("humanEngineerReviewed") is not True:
        r.append("human engineering review required")
    if regulatory.get("localFloodplainAdministratorReviewed") is not True:
        r.append("local floodplain administrator review required")
    if regulatory.get("basis") not in ("FEMA_NO_RISE", "INDIANA_FLOODWAY"):
        r.append("FEMA and Indiana regulatory review categories must be distinct")
    diff = regulatory.get("maximumFloodElevationIncreaseFt")
    if not finite(diff):
        r.append("measured maximum WSE increase in feet required")
    elif regulatory.get("basis") == "FEMA_NO_RISE" and diff > 0:
        r.append("FEMA floodway no-rise analysis requires zero positive modeled increase")
    elif regulatory.get("basis") == "INDIANA_FLOODWAY":
        if diff >= 0.15:
            r.append("Indiana 312 IAC 10-2-3 threshold reached; separate exception review may apply")
        if regulatory.get("indianaExceptionsReviewed") is not True:
            r.append("Indiana rule exceptions and other permit criteria must be reviewed")
    if regulatory.get("automaticPermitOrCertification") is not False:
        r.append("automatic regulatory certification is prohibited")
    
    output = {"schemaVersion": "tsm.independent-engineering-precheck.v1",
              "interpretation": "Technical evidence consistency check only, NOT a professional survey certification, no-rise certificate, FEMA determination, or permit.",
              "sections": {
                  key: {"status": "INCOMPLETE" if val else "VERIFIED_PRECHECK", "errors": val}
                  for key, val in errors.items()},
              "mayClaimSurveyGradeTerrain": False,
              "mayClaimRegulatoryApproval": False,
              "mayClaimCountyWideCrackFree": not m and not t,
              "reviewRequired": True}
    output["overallStatus"] = ("VERIFIED_PRECHECK" if all(not val for val in errors.values()) else "INCOMPLETE")
    return output


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--evidence", type=Path, required=True)
    p.add_argument("--output", type=Path)
    p.add_argument("--require-precheck", action="store_true")
    args = p.parse_args()
    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    if not isinstance(evidence, dict):
        p.error("evidence root must be a JSON object")
    report = checks(evidence)
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered)
    return int(args.require_precheck and report["overallStatus"] != "VERIFIED_PRECHECK")


if __name__ == "__main__":
    raise SystemExit(main())
