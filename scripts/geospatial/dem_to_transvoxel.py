#!/usr/bin/env python3
"""Table-driven Transvoxel transition-cell mesher CLI.

Consumes real scalar samples/positions exported by the DEM/SDF pipeline and
emits indexed transition geometry using the official Lengyel transition tables.
The input is a JSON object with a "cells" array. Each cell contains:
  {"origin":[x,y,z],"axis":0|1|2,"extent":positive_number,"samples":[13 finite values]}
Samples 0..8 are the fine-side 3x3 scalar field and choose the 9-bit case.
Samples 9..12 are independent coarse-side corner values used for edge interpolation. This module generates transition-cell triangles; it does not approve an AOI, infer
missing elevations, or fabricate raster input. Official tables are MIT-licensed.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

from transvoxel_transition_mesh import mesh_transition_cell, self_test


def _finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{label} must be a finite number")
    return float(value)


def _polygonize(cell: dict[str, Any]) -> dict[str, Any]:
    origin_raw = cell.get("origin")
    samples_raw = cell.get("samples")
    axis = cell.get("axis")
    direction = cell.get("direction", 1)
    extent = _finite_number(cell.get("extent"), "extent")
    if not isinstance(origin_raw, list) or len(origin_raw) != 3:
        raise ValueError("cell.origin must contain xyz")
    origin = tuple(_finite_number(v, f"origin[{i}]") for i, v in enumerate(origin_raw))
    if isinstance(axis, bool) or not isinstance(axis, int) or axis not in (0, 1, 2):
        raise ValueError("cell.axis must be 0, 1, or 2")
    if isinstance(direction, bool) or not isinstance(direction, int) or direction not in (-1, 1):
        raise ValueError("cell.direction must be -1 or 1")
    if extent <= 0:
        raise ValueError("cell.extent must be > 0")
    if not isinstance(samples_raw, list) or len(samples_raw) != 9:
        raise ValueError("cell.samples must contain exactly 9 fine-side scalar samples")
    samples = [_finite_number(v, f"samples[{i}]") for i, v in enumerate(samples_raw)]

    def sdf(x: float, y: float, z: float) -> float:
        point = (x, y, z)
        a, b = (axis + 1) % 3, (axis + 2) % 3
        u = min(1.0, max(0.0, (point[a] - origin[a]) / extent))
        v = min(1.0, max(0.0, (point[b] - origin[b]) / extent))
        ix = min(2, max(0, int(round(u * 2))))
        iy = min(2, max(0, int(round(v * 2))))
        # The official transition cell has 13 spatial positions but only nine
        # independent scalar values. Coarse-side corner scalars duplicate the
        # fine-face corners; interpolate_edge applies that endpoint mapping.
        return samples[iy * 3 + ix]

    vertices, triangles, metadata = mesh_transition_cell(sdf, origin, axis, extent, direction=direction)
    if any(not math.isfinite(component) for vertex in vertices for component in vertex):
        raise ValueError("mesher produced a non-finite vertex")
    if any(index < 0 or index >= len(vertices) for triangle in triangles for index in triangle):
        raise ValueError("mesher produced an out-of-range triangle index")
    return {
        "case": metadata.get("case"),
        "classId": metadata.get("class_id"),
        "invertWinding": metadata.get("invert", False),
        "vertices": [list(vertex) for vertex in vertices],
        "triangles": [list(triangle) for triangle in triangles],
        "vertexCount": len(vertices),
        "triangleCount": len(triangles),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true", help="exhaustively test all 512 masks")
    parser.add_argument("--input", type=Path, help="JSON file with a cells array")
    parser.add_argument("--output", type=Path, help="output JSON path (stdout when omitted)")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    if args.input is None:
        parser.error("--input is required unless --self-test is used")
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    cells = payload.get("cells") if isinstance(payload, dict) else None
    if not isinstance(cells, list) or not cells:
        parser.error("input JSON must contain a non-empty cells array")
    output = {
        "schemaVersion": "1.0.0",
        "algorithm": "Transvoxel transition-cell tables (Lengyel MIT)",
        "inputSha256": __import__("hashlib").sha256(args.input.read_bytes()).hexdigest(),
        "cells": [_polygonize(cell) for cell in cells],
    }
    encoded = json.dumps(output, sort_keys=True, separators=(",", ":")) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
