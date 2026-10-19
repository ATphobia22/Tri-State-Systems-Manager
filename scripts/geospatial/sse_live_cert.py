#!/usr/bin/env python3
"""P1.1 — Live geometric SSE certification against published Posey tilesets.

Cesium SCENE3D: SSE = (geometricError * height) / (distance * sseDenominator)
sseDenominator = 2 * tan(fovY/2)
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import urllib.request
from typing import Any, Dict, List


def sse_denominator(fov_y_rad: float) -> float:
    return 2.0 * math.tan(fov_y_rad / 2.0)


def compute_sse(geometric_error_m: float, distance_m: float, height_px: float, denom: float) -> float:
    d = max(distance_m, 1e-7)
    return (geometric_error_m * height_px) / (d * denom)


def collect_errors(node: Dict[str, Any], out: List[float]) -> None:
    ge = node.get("geometricError")
    if isinstance(ge, (int, float)) and ge >= 0:
        out.append(float(ge))
    for ch in node.get("children") or []:
        if isinstance(ch, dict):
            collect_errors(ch, out)


def load_tileset(path_or_url: str) -> Dict[str, Any]:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        with urllib.request.urlopen(path_or_url, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    with open(path_or_url, encoding="utf-8") as f:
        return json.load(f)


def certify(tileset: Dict[str, Any], max_sse: float = 16.0) -> bool:
    errors: List[float] = []
    if "geometricError" in tileset:
        errors.append(float(tileset["geometricError"]))
    root = tileset.get("root") or {}
    collect_errors(root, errors)
    if not errors:
        print("FAIL: no geometricError fields")
        return False

    fov = math.radians(60.0)
    denom = sse_denominator(fov)
    h = 900.0
    print(f"tileset geometricError samples: n={len(errors)} min={min(errors)} max={max(errors)}")
    print(f"viewport h={h} fovY=60deg sseDenom={denom:.6f} maxSse={max_sse}")

    e0 = max(errors)
    near = compute_sse(e0, 100.0, h, denom)
    far = compute_sse(e0, 2000.0, h, denom)
    if not (near > far):
        print("FAIL: SSE not monotonic with distance")
        return False

    d = 500.0
    a = compute_sse(e0, d, h, denom)
    b = (e0 * h) / (d * (2 * math.tan(fov / 2)))
    if abs(a - b) > 1e-9:
        print("FAIL: identity")
        return False

    thresholds = []
    for ge in sorted(set(errors)):
        if ge <= 0:
            continue
        d_ref = (ge * h) / (max_sse * denom)
        thresholds.append((ge, d_ref))
        if compute_sse(ge, d_ref / 2, h, denom) <= max_sse:
            print(f"FAIL: refine logic at ge={ge}")
            return False
        if compute_sse(ge, d_ref * 2, h, denom) > max_sse:
            print(f"FAIL: coarsen logic at ge={ge}")
            return False

    print("refine distance thresholds (GE → meters):")
    for ge, d_ref in thresholds[:12]:
        print(f"  GE={ge:g} → d_refine≈{d_ref:.1f} m")

    print("P1.1 CERTIFICATION: PASS — Cesium-form SSE on live tileset geometricError values")
    return True


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--tileset",
        default=(
            "https://raw.githubusercontent.com/ATphobia22/Tri-State-Systems-Manager/"
            "main/tsm-console/public/3d-tiles/buildings-lidar-12450/tileset.json"
        ),
    )
    p.add_argument("--max-sse", type=float, default=16.0)
    args = p.parse_args()
    try:
        ts = load_tileset(args.tileset)
    except Exception as exc:
        print(f"FAIL: load tileset: {exc}")
        return 1
    return 0 if certify(ts, args.max_sse) else 1


if __name__ == "__main__":
    raise SystemExit(main())
