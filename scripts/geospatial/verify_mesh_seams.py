#!/usr/bin/env python3
"""Independent geometrical interface seam audit for adaptive terrain meshes.

Input JSON: {interfaces:[{id, direction:'+x', planeCoordinateM,
  left:{vertices:[[x,y,z],...],triangles:[[i,j,k],...]},
  right:{vertices:...,triangles:...}}], toleranceM:0.0001}
No interpolation from missing terrain; no automatic survey/regulatory certification.

The checker compares actual triangle/plane intersection *coverage*, allowing a
straight coarse edge to be subdivided into multiple matching fine edges. It
cannot prove terrain outside the supplied interfaces has been meshed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

DIRECTIONS = ("+x", "-x", "+y", "-y", "+z", "-z")


def finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def distance(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    return math.dist(a, b)


def sub(a: tuple[float, ...], b: tuple[float, ...]) -> tuple[float, ...]:
    return tuple(a[i] - b[i] for i in range(3))


def dot(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    return sum(a[i] * b[i] for i in range(3))


def cross_length(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    return math.sqrt((a[1]*b[2] - a[2]*b[1])**2
                     + (a[2]*b[0] - a[0]*b[2])**2
                     + (a[0]*b[1] - a[1]*b[0])**2)


def lerp(a: tuple[float, ...], b: tuple[float, ...], t: float) -> tuple[float, ...]:
    return tuple(a[i] + (b[i] - a[i])*t for i in range(3))


def mesh_plane_segments(mesh: Any, axis: int, plane: float, tolerance: float) -> list[tuple]:
    if not isinstance(mesh, dict):
        raise ValueError("mesh object required")
    vertices, triangles = mesh.get("vertices"), mesh.get("triangles")
    if not isinstance(vertices, list) or not isinstance(triangles, list):
        raise ValueError("mesh vertices and triangles must be lists")
    verts = []
    for n, p in enumerate(vertices):
        if not isinstance(p, list) or len(p) != 3 or not all(finite(x) for x in p):
            raise ValueError(f"nonfinite/invalid vertex {n}")
        verts.append(tuple(map(float, p)))
    segments = []
    for n, tri in enumerate(triangles):
        if (not isinstance(tri, list) or len(tri) != 3 or
                any(not isinstance(i, int) or isinstance(i, bool) or i < 0 or i >= len(verts) for i in tri) or
                len(set(tri)) != 3):
            raise ValueError(f"invalid triangle {n}")
        v = [verts[i] for i in tri]
        if cross_length(sub(v[1], v[0]), sub(v[2], v[0])) <= tolerance * tolerance:
            raise ValueError(f"degenerate triangle {n}")
        signed = [p[axis] - plane for p in v]
        if all(d > tolerance for d in signed) or all(d < -tolerance for d in signed):
            continue
        if all(abs(d) <= tolerance for d in signed):
            # A triangle coplanar with the interface contributes all edges;
            # union-coverage matching handles differing triangulation.
            segments.extend((v[i], v[(i + 1) % 3]) for i in range(3))
            continue
        hits: list[tuple[float, ...]] = []
        for i in range(3):
            j = (i + 1) % 3
            da, db = signed[i], signed[j]
            if abs(da) <= tolerance:
                hits.append(v[i])
            if da * db < 0 and abs(da) > tolerance and abs(db) > tolerance:
                hits.append(lerp(v[i], v[j], da / (da - db)))
        unique = []
        for p in hits:
            if not any(distance(p, q) <= tolerance for q in unique):
                unique.append(p)
        if len(unique) == 2 and distance(unique[0], unique[1]) > tolerance:
            segments.append(tuple(unique))
        elif len(unique) > 2:
            raise ValueError(f"ambiguous plane intersection in triangle {n}")
    return segments


def uncovered_length(segment: tuple, opposing: list[tuple], tolerance: float) -> float:
    a, b = segment
    direction = sub(b, a)
    scale2 = dot(direction, direction)
    length = math.sqrt(scale2)
    if length <= tolerance:
        return 0.0
    intervals = []
    for c, d in opposing:
        tc = dot(sub(c, a), direction) / scale2
        td = dot(sub(d, a), direction) / scale2
        # Both opposing endpoints must be on the same supporting straight line.
        if (distance(c, lerp(a, b, tc)) > tolerance or
                distance(d, lerp(a, b, td)) > tolerance):
            continue
        lo, hi = max(0.0, min(tc, td)), min(1.0, max(tc, td))
        if hi > lo:
            intervals.append((lo, hi))
    intervals.sort()
    cursor, missing = 0.0, 0.0
    slack = tolerance / length
    for lo, hi in intervals:
        if hi < cursor:
            continue
        if lo > cursor + slack:
            missing += lo - cursor
        cursor = max(cursor, hi)
    if cursor < 1.0 - slack:
        missing += 1.0 - cursor
    return missing * length


def compare_interface(item: Any, tolerance: float) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError("interface entry must be an object")
    direction = item.get("direction")
    if direction not in DIRECTIONS:
        raise ValueError("direction must be +x/-x/+y/-y/+z/-z")
    coordinate = item.get("planeCoordinateM")
    if not finite(coordinate):
        raise ValueError("planeCoordinateM must be a finite metre coordinate")
    axis = "xyz".index(direction[1])
    left = mesh_plane_segments(item.get("left"), axis, coordinate, tolerance)
    right = mesh_plane_segments(item.get("right"), axis, coordinate, tolerance)
    if not left or not right:
        gap = "EMPTY_INTERFACE" if not left and not right else "ONE_SIDED_INTERFACE"
        return {"id": item.get("id"), "direction": direction, "status": gap,
                "leftSegments": len(left), "rightSegments": len(right),
                "uncoveredLengthM": None}
    missing = sum(uncovered_length(seg, right, tolerance) for seg in left)
    missing += sum(uncovered_length(seg, left, tolerance) for seg in right)
    return {
        "id": item.get("id"),
        "direction": direction,
        "status": "MATCH" if missing <= tolerance else "CRACK_OR_NONCOLLINEAR_SEGMENT",
        "leftSegments": len(left),
        "rightSegments": len(right),
        "uncoveredLengthM": round(missing, 10)
    }


def evaluate(data: Any, input_sha256: str | None = None, require_all_six: bool = False) -> dict[str, Any]:
    errors: list[str] = []
    if not isinstance(data, dict):
        data = {}
        errors.append("input must be an object")
    tolerance = data.get("toleranceM", 0.0001)
    if not finite(tolerance) or not (0 < tolerance <= 0.02):
        errors.append("toleranceM must be explicit finite positive value <= 0.02 m")
        tolerance = 0.0001
    items = data.get("interfaces")
    if not isinstance(items, list) or not items:
        errors.append("interfaces must be a nonempty list")
        items = []
    seen = set()
    records = []
    for i, item in enumerate(items):
        try:
            record = compare_interface(item, float(tolerance))
        except (ValueError, IndexError, ZeroDivisionError) as exc:
            errors.append(f"interfaces[{i}]: {exc}")
            continue
        identity = record["id"]
        if not isinstance(identity, str) or not identity.strip() or identity in seen:
            errors.append(f"interfaces[{i}]: unique nonempty interface ID required")
        seen.add(identity)
        records.append(record)
        if record["status"] != "MATCH":
            errors.append(f"interfaces[{i}]: {record['status']}")
    found = {r["direction"] for r in records if r["status"] == "MATCH"}
    if require_all_six and found != set(DIRECTIONS):
        errors.append("not all six signed interface orientations have measured matching geometry")
    return {
        "schemaVersion": "tsm.geometric-seam-audit.v1",
        "status": "INCOMPLETE" if errors else "MEASURED_SEAM_SEGMENTS_MATCH_FOR_REVIEW",
        "approved": False,
        "regulatoryDetermination": None,
        "inputSha256": input_sha256,
        "toleranceM": tolerance,
        "interfacePairsSubmitted": len(items),
        "matchedInterfaces": sum(r["status"] == "MATCH" for r in records),
        "verifiedDirections": sorted(found),
        "records": records,
        "errors": errors,
        "limitations": "Examines only supplied triangle-interface geometry and finite segment coverage; does not establish county polygon coverage, external survey grade, global manifoldness or regulatory authority."
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--tolerance-m", type=float, help="Override input tolerance")
    parser.add_argument("--require-all-six", action="store_true")
    parser.add_argument("--require-match", action="store_true")
    args = parser.parse_args()
    try:
        raw = args.input.read_bytes()
        data = json.loads(raw)
    except (OSError, ValueError) as exc:
        parser.exit(2, f"ERROR: cannot read mesh JSON ({type(exc).__name__})\n")
    if args.tolerance_m is not None:
        if not isinstance(data, dict):
            parser.exit(2, "ERROR: input must be JSON object\n")
        data["toleranceM"] = args.tolerance_m
    report = evaluate(data, hashlib.sha256(raw).hexdigest(), args.require_all_six)
    output = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    print(output)
    return 1 if args.require_match and report["status"] == "INCOMPLETE" else 0


if __name__ == "__main__":
    raise SystemExit(main())
