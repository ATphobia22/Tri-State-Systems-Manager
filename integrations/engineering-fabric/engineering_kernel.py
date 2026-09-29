#!/usr/bin/env python3
"""Deterministic TSM engineering kernel and external-worker boundary.

The module contains only unit-explicit, deterministic calculations. External
solvers are invoked through a separate process boundary and never mutate the
native engineering state directly.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path
from typing import Any, Mapping, Sequence


def _finite(value: float, name: str) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def peak_flow_rational(c: float, rainfall_in_per_hr: float, area_acres: float) -> float:
    """Return SI discharge using Q=C*i*A with i in in/hr and A in acres."""
    c = _finite(c, "runoff coefficient")
    intensity = _finite(rainfall_in_per_hr, "rainfall intensity")
    area = _finite(area_acres, "area")
    if not 0.0 <= c <= 1.0 or intensity < 0.0 or area < 0.0:
        raise ValueError("invalid rational-method inputs")
    return c * intensity * area * 0.00117255


def manning_velocity(
    hydraulic_radius_m: float, slope: float, roughness_n: float
) -> float:
    radius = _finite(hydraulic_radius_m, "hydraulic radius")
    slope = _finite(slope, "slope")
    roughness = _finite(roughness_n, "roughness")
    if radius < 0.0 or slope < 0.0 or roughness <= 0.0:
        raise ValueError("invalid Manning inputs")
    return (1.0 / roughness) * radius ** (2.0 / 3.0) * math.sqrt(slope)


def manning_discharge(
    area_m2: float, hydraulic_radius_m: float, slope: float, roughness_n: float
) -> float:
    area = _finite(area_m2, "area")
    if area < 0.0:
        raise ValueError("area must be non-negative")
    return area * manning_velocity(hydraulic_radius_m, slope, roughness_n)


def flood_depth(water_surface_elevation_m: float, ground_elevation_m: float) -> float:
    return max(
        0.0,
        _finite(water_surface_elevation_m, "water surface elevation")
        - _finite(ground_elevation_m, "ground elevation"),
    )


def required_design_elevation(wse_m: float, freeboard_m: float) -> float:
    wse = _finite(wse_m, "water surface elevation")
    freeboard = _finite(freeboard_m, "freeboard")
    if freeboard < 0.0:
        raise ValueError("freeboard must be non-negative")
    return wse + freeboard


def berm_cross_section_m2(height_m: float, top_width_m: float, side_slope_hv: float) -> float:
    height = _finite(height_m, "height")
    width = _finite(top_width_m, "top width")
    slope = _finite(side_slope_hv, "side slope")
    if height < 0.0 or width < 0.0 or slope < 0.0:
        raise ValueError("berm dimensions must be non-negative")
    return height * (width + slope * height)


def berm_volume_m3(
    height_m: float, top_width_m: float, side_slope_hv: float, length_m: float
) -> float:
    length = _finite(length_m, "length")
    if length < 0.0:
        raise ValueError("length must be non-negative")
    return berm_cross_section_m2(height_m, top_width_m, side_slope_hv) * length


def cut_fill_volumes(
    existing_elevations_m: Sequence[float],
    proposed_elevations_m: Sequence[float],
    cell_area_m2: float,
) -> Mapping[str, float]:
    if len(existing_elevations_m) != len(proposed_elevations_m):
        raise ValueError("existing and proposed samples must have equal length")
    area = _finite(cell_area_m2, "cell area")
    if area <= 0.0:
        raise ValueError("cell area must be positive")
    cut = 0.0
    fill = 0.0
    for existing, proposed in zip(existing_elevations_m, proposed_elevations_m):
        delta = _finite(proposed, "proposed elevation") - _finite(existing, "existing elevation")
        if delta > 0.0:
            fill += delta * area
        else:
            cut += -delta * area
    return {"cut_m3": cut, "fill_m3": fill, "net_m3": fill - cut}


def sha256_json(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(payload).hexdigest()


def build_solver_result(
    solver: str,
    solver_version: str,
    inputs: Any,
    values: Mapping[str, float],
    relative_uncertainty: float,
    provenance: Sequence[str],
) -> dict[str, Any]:
    if relative_uncertainty < 0.0 or not math.isfinite(relative_uncertainty):
        raise ValueError("relative uncertainty must be finite and non-negative")
    result = {
        "schemaVersion": "TSM-SolverResult-1.0",
        "solver": solver,
        "solverVersion": solver_version,
        "status": "success",
        "inputHash": sha256_json(inputs),
        "resultHash": "",
        "units": "SI",
        "values": dict(sorted(values.items())),
        "uncertainty": {"method": "declared-relative-bound", "relativeBound": relative_uncertainty},
        "provenance": list(provenance),
    }
    result["resultHash"] = sha256_json({k: v for k, v in result.items() if k != "resultHash"})
    return result


ALLOWED_WORKERS = {
    "cad": "TSM_CAD_WORKER",
    "usd": "TSM_USD_WORKER",
    "vision": "TSM_VISION_WORKER",
    "numerics": "TSM_NUMERICS_WORKER",
    "routing": "TSM_ROUTING_WORKER",
    "solver": "TSM_SOLVER_WORKER",
    "post-process": "TSM_POST_PROCESS_WORKER",
}


def run_worker(kind: str, payload: Mapping[str, Any], timeout_s: float = 120.0) -> dict[str, Any]:
    """Run one configured worker with JSON stdin/stdout and no shell expansion."""
    import os

    if kind not in ALLOWED_WORKERS:
        raise ValueError(f"worker kind not allowed: {kind}")
    executable = os.environ.get(ALLOWED_WORKERS[kind])
    if not executable:
        raise RuntimeError(f"{ALLOWED_WORKERS[kind]} is not configured; refusing implicit fallback")
    encoded = json.dumps(payload, sort_keys=True).encode()
    if len(encoded) > 2 * 1024 * 1024:
        raise ValueError("worker request exceeds 2 MiB")
    completed = subprocess.run(
        [executable],
        input=encoded,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=timeout_s,
        shell=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"worker failed ({completed.returncode}): {completed.stderr.decode(errors='replace')[:4000]}"
        )
    if len(completed.stdout) > 4 * 1024 * 1024:
        raise RuntimeError("worker response exceeds 4 MiB")
    return json.loads(completed.stdout)


def _cli() -> int:
    parser = argparse.ArgumentParser(description="TSM deterministic engineering kernel")
    sub = parser.add_subparsers(dest="command", required=True)
    flow = sub.add_parser("peak-flow")
    flow.add_argument("--c", type=float, required=True)
    flow.add_argument("--intensity-in-per-hr", type=float, required=True)
    flow.add_argument("--area-acres", type=float, required=True)
    berm = sub.add_parser("berm-volume")
    berm.add_argument("--height-m", type=float, required=True)
    berm.add_argument("--top-width-m", type=float, required=True)
    berm.add_argument("--side-slope-hv", type=float, required=True)
    berm.add_argument("--length-m", type=float, required=True)
    args = parser.parse_args()
    if args.command == "peak-flow":
        print(json.dumps({"discharge_m3_s": peak_flow_rational(args.c, args.intensity_in_per_hr, args.area_acres)}))
    elif args.command == "berm-volume":
        print(json.dumps({"volume_m3": berm_volume_m3(args.height_m, args.top_width_m, args.side_slope_hv, args.length_m)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
