#!/usr/bin/env python3
"""Time-aware, non-destructive 4D earthwork scenario calculation.

The raster is a declared input height grid, not independently surveyed data.
This module deliberately never invokes solvers or publishes a design; quantities
use cell-center elevation differences and require separate engineering QA.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
from typing import Any

from engineering_kernel import cut_fill_volumes, sha256_json

SOURCE_HASH = re.compile(r"^[a-f0-9]{64}$")
MAX_CELLS = 1_000_000
MAX_EDITS = 10_000
YARD_IN_METRES = 0.9144
REVIEW_GATES = [
    "BASELINE_SOURCE_AND_VERTICAL_DATUM_NOT_INDEPENDENTLY_VERIFIED",
    "SFINCS_OR_HEC_RAS_NOT_EXECUTED",
    "MODFLOW_OR_SEEPAGE_NOT_EXECUTED",
    "BISHOP_SLOPE_STABILITY_NOT_EXECUTED",
    "REGULATORY_APPLICABILITY_AND_PERMITS_NOT_DETERMINED",
    "QUALIFIED_ENGINEER_APPROVAL_REQUIRED",
]


def numeric(value: Any, name: str, *, positive: bool = False) -> float:
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if positive and value <= 0:
        raise ValueError(f"{name} must be positive")
    return float(value)


def instant(value: Any, name: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"{name} requires timezone-aware ISO-8601")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{name} must be ISO-8601") from exc
    if result.utcoffset() is None:
        raise ValueError(f"{name} requires timezone-aware ISO-8601")
    return result.astimezone(timezone.utc)


def validate_baseline(value: Any) -> tuple[list[list[float]], float]:
    if not isinstance(value, dict):
        raise ValueError("baseline must be an object")
    if value.get("crs") != "EPSG:26916":
        raise ValueError("scenario baseline must be transformed to EPSG:26916 first")
    if value.get("verticalDatum") != "NAVD88":
        raise ValueError("scenario requires an independently reconciled NAVD88 baseline")
    if not isinstance(value.get("sourceSha256"), str) or not SOURCE_HASH.fullmatch(value["sourceSha256"]):
        raise ValueError("baseline sourceSha256 must be a lowercase SHA-256 digest")
    for coordinate in ("originEastingM", "originNorthingM"):
        numeric(value.get(coordinate), coordinate)
    cell_size = numeric(value.get("cellSizeM"), "cellSizeM", positive=True)
    grid = value.get("elevationsM")
    if not isinstance(grid, list) or not grid or not isinstance(grid[0], list) or not grid[0]:
        raise ValueError("elevationsM must be a nonempty rectangular 2D grid")
    columns = len(grid[0])
    if len(grid) * columns > MAX_CELLS:
        raise ValueError("scenario grid exceeds cell cap")
    clean = []
    for row in grid:
        if not isinstance(row, list) or len(row) != columns:
            raise ValueError("elevationsM grid rows must be rectangular")
        clean.append([numeric(v, "elevationM") for v in row])
    return clean, cell_size


def neighbor_grade(grid: list[list[float]], cell_size: float) -> float:
    highest = 0.0
    for i, row in enumerate(grid):
        for j, value in enumerate(row):
            if i + 1 < len(grid):
                highest = max(highest, abs(value - grid[i + 1][j]) / cell_size)
            if j + 1 < len(row):
                highest = max(highest, abs(value - row[j + 1]) / cell_size)
    return highest


def evaluate_scenario(request: dict[str, Any]) -> dict[str, Any]:
    """Return a simulation-only receipt; do not alter any source grid."""
    if not isinstance(request, dict) or request.get("schemaVersion") != "tsm.earthwork-scenario.v1":
        raise ValueError("unsupported earthwork scenario schema")
    scenario_id = request.get("scenarioId")
    if not isinstance(scenario_id, str) or not 1 <= len(scenario_id) <= 128:
        raise ValueError("scenarioId must be a stable nonempty identifier")
    cutoff = instant(request.get("asOf"), "asOf")
    baseline = request.get("baseline")
    initial, size = validate_baseline(baseline)
    edits = request.get("edits")
    if not isinstance(edits, list) or len(edits) > MAX_EDITS:
        raise ValueError("edits must be a bounded array")
    proposed = [row.copy() for row in initial]
    count = 0
    for edit in edits:
        if not isinstance(edit, dict):
            raise ValueError("earthwork edit must be an object")
        row, col = edit.get("row"), edit.get("col")
        if type(row) is not int or type(col) is not int or not (0 <= row < len(initial) and 0 <= col < len(initial[0])):
            raise ValueError("earthwork edit lies outside the baseline grid")
        kind = edit.get("type")
        if kind not in ("CUT", "FILL"):
            raise ValueError("earthwork edits must specify CUT or FILL")
        delta = numeric(edit.get("deltaM"), "deltaM")
        if not ((kind == "FILL" and delta > 0) or (kind == "CUT" and delta < 0)):
            raise ValueError("cut/fill type and elevation delta sign disagree")
        effective = instant(edit.get("validFrom"), "edit.validFrom")
        if effective <= cutoff:
            proposed[row][col] += delta
            count += 1
    existing = [z for row in initial for z in row]
    updated = [z for row in proposed for z in row]
    quantities = cut_fill_volumes(existing, updated, size * size)
    volumes = {"cut": quantities["cut_m3"], "fill": quantities["fill_m3"],
               "netFill": quantities["net_m3"]}
    grade = neighbor_grade(proposed, size)
    result = {
        "schemaVersion": "tsm.earthwork-result.v1",
        "scenarioId": scenario_id,
        "asOf": cutoff.isoformat().replace("+00:00", "Z"),
        "state": "SIMULATED",
        "authorityClass": "DERIVED",
        "sourceTrust": "DECLARED_NOT_VERIFIED",
        "governanceStatus": "human_review_required",
        "engineeringValidated": False,
        "published": False,
        "verticalDatum": "NAVD88",
        "crs": "EPSG:26916",
        "rowOrder": "north-to-south",
        "gridShape": {"rows": len(initial), "columns": len(initial[0])},
        "cellAreaM2": size * size,
        "declaredSourceSha256": baseline["sourceSha256"],
        "baselineGridSha256": sha256_json(initial),
        "proposedGridSha256": sha256_json(proposed),
        "editsSha256": sha256_json(edits),
        "activeEdits": count,
        "proposedGridM": proposed,
        "volumesM3": volumes,
        "volumesYd3": {k: v / YARD_IN_METRES**3 for k, v in volumes.items()},
        "maxNeighborGrade": grade,
        "requiresSlopeReview": grade > (1.0 / 3.0),
        "method": "uniform-raster-cell-center-integration",
        "limitations": [
            "Raster cell integration is an estimate, not a surveyed earthwork quantity",
            "Existing grid is unchanged; design delta applies only to this scenario",
            "Input source hash and datum labels are declarations, not independent verification",
            "Adjacent cells do not replace geotechnical side-slope, compaction, shrink/swell or haul analysis",
        ],
        "blockingGates": REVIEW_GATES,
    }
    result["scenarioSha256"] = sha256_json(result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", type=Path, required=True, help="Locally supplied JSON input")
    opts = parser.parse_args()
    raw = opts.scenario.read_bytes()
    if len(raw) > 25_000_000:
        parser.error("scenario input exceeds 25 MB")
    try:
        request = json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
        result = evaluate_scenario(request)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        parser.error(str(error))
    print(json.dumps(result, indent=2, sort_keys=True, allow_nan=False))


if __name__ == "__main__":
    main()
