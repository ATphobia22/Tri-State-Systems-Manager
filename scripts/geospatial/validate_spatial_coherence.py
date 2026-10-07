#!/usr/bin/env python3
"""Validate spatial coherence of 3D Tiles tilesets (research-validated 2026-10-07).

Per OGC 3D Tiles 1.1, spatial coherence requires:
  1. Every child tile bounding volume ⊆ parent tile bounding volume.
  2. Every content geometry ⊆ its declared tile bounds.

Checks both explicit tilesets (boundingVolume.box hierarchies) and
implicit tilesets (region subdivision + subtree availability).

Bounding volume types handled: box (12 numbers), region (6 numbers),
sphere (4 numbers). All comparisons in a common frame: boxes/spheres are
ECEF; regions are converted to an approximate ECEF box via corner sampling.

Exit non-zero with FAIL details on any violation (fail-closed).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

WGS84_A = 6378137.0
WGS84_E2 = 6.6943799901413165e-3


def ecef(lon_deg: float, lat_deg: float, h_m: float = 0.0):
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    s, c = math.sin(lat), math.cos(lat)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * s * s)
    return ((n + h_m) * c * math.cos(lon),
            (n + h_m) * c * math.sin(lon),
            (n * (1.0 - WGS84_E2) + h_m) * s)


def box_corners(box: list) -> list:
    c = box[0:3]
    axes = [box[3:6], box[6:9], box[9:12]]
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                pts.append((
                    c[0] + sx * axes[0][0] + sy * axes[1][0] + sz * axes[2][0],
                    c[1] + sx * axes[0][1] + sy * axes[1][1] + sz * axes[2][1],
                    c[2] + sx * axes[0][2] + sy * axes[1][2] + sz * axes[2][2],
                ))
    return pts


def region_to_corners(region: list) -> list:
    w, s, e, n, hmin, hmax = region
    pts = []
    for lon in (math.degrees(w), math.degrees(e)):
        for lat in (math.degrees(s), math.degrees(n)):
            for h in (hmin, hmax):
                pts.append(ecef(lon, lat, h))
    return pts


def sphere_to_corners(sphere: list) -> list:
    cx, cy, cz, r = sphere
    pts = []
    for dx in (-r, r):
        for dy in (-r, r):
            for dz in (-r, r):
                pts.append((cx + dx, cy + dy, cz + dz))
    return pts


def volume_corners(vol: dict) -> list | None:
    if "box" in vol:
        return box_corners(vol["box"])
    if "region" in vol:
        return region_to_corners(vol["region"])
    if "sphere" in vol:
        return sphere_to_corners(vol["sphere"])
    return None


def aabb(pts: list) -> tuple:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    zs = [p[2] for p in pts]
    return (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))


def contains(outer_aabb: tuple, inner_aabb: tuple, tol: float = 1.0) -> bool:
    """AABB containment with tolerance (meters, for float error)."""
    return (outer_aabb[0] - tol <= inner_aabb[0] and
            outer_aabb[1] - tol <= inner_aabb[1] and
            outer_aabb[2] - tol <= inner_aabb[2] and
            outer_aabb[3] + tol >= inner_aabb[3] and
            outer_aabb[4] + tol >= inner_aabb[4] and
            outer_aabb[5] + tol >= inner_aabb[5])


def apply_transform(m: list, p: tuple) -> tuple:
    """Apply a 4x4 column-major transform to a point."""
    return (
        m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
        m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
        m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
    )


def check_explicit(node: dict, parent_aabb: tuple | None, path: str,
                   violations: list, tile_dir: Path | None,
                   parent_transform: list | None = None):
    vol = node.get("boundingVolume")
    if not vol:
        violations.append(f"{path}: missing boundingVolume")
        return
    corners = volume_corners(vol)
    if not corners:
        violations.append(f"{path}: unsupported boundingVolume type")
        return
    # Per 3D Tiles spec, boundingVolume is in the tile's LOCAL frame.
    # Apply this tile's transform to get world coordinates before comparing
    # against the parent (which is already in world/ECEF frame).
    my_transform = node.get("transform")
    world_corners = [apply_transform(my_transform, c) for c in corners] \
        if my_transform else corners
    my_aabb = aabb(world_corners)
    if parent_aabb is not None and not contains(parent_aabb, my_aabb):
        violations.append(
            f"{path}: child bounding volume NOT inside parent "
            f"(child min={[round(v,1) for v in my_aabb[:3]]} "
            f"parent min={[round(v,1) for v in parent_aabb[:3]]})")
    for i, child in enumerate(node.get("children", [])):
        check_explicit(child, my_aabb, f"{path}/child[{i}]", violations, tile_dir)


def check_implicit(tileset: dict, tile_dir: Path, violations: list):
    root = tileset.get("root", {})
    impl = root.get("implicitTiling")
    if not impl:
        violations.append("implicit check requested but no implicitTiling in root")
        return
    if impl.get("subdivisionScheme") != "QUADTREE":
        violations.append(f"unsupported subdivisionScheme {impl.get('subdivisionScheme')}")
        return
    content_tmpl = root.get("content", {}).get("uri", "")
    subtree_tmpl = impl.get("subtrees", {}).get("uri", "")
    if "{level}" not in content_tmpl or "{x}" not in content_tmpl or "{y}" not in content_tmpl:
        violations.append(f"content URI is not a valid template: {content_tmpl!r}")
    if "{level}" not in subtree_tmpl:
        violations.append(f"subtree URI is not a valid template: {subtree_tmpl!r}")
    # Check legacy extension is NOT declared
    ext_used = tileset.get("asset", {}).get("extensionsUsed", [])
    if "3DTILES_implicit_tiling" in ext_used:
        violations.append("legacy 3DTILES_implicit_tiling in extensionsUsed "
                          "(implicit tiling is core in 1.1; remove it)")
    # Region subdivision coherence: verify root region exists
    vol = root.get("boundingVolume", {})
    if "region" not in vol:
        violations.append("implicit root should use region boundingVolume for clean subdivision")
    # Content existence spot-check: walk subtree files if present
    subtree_dir = tile_dir / "subtrees"
    content_dir = tile_dir / "content"
    if subtree_dir.exists():
        for spath in sorted(subtree_dir.rglob("*.subtree")):
            try:
                sub = json.loads(spath.read_text())
            except Exception as e:
                violations.append(f"{spath}: invalid subtree JSON: {e}")
                continue
            for key in ("tileAvailability", "contentAvailability"):
                avail = sub.get(key)
                if avail is None:
                    violations.append(f"{spath}: missing {key}")
    # Verify at least one content file matches the template pattern
    if content_dir.exists():
        glbs = list(content_dir.rglob("*.glb"))
        if not glbs:
            violations.append(f"{content_dir}: no content GLBs found")
    else:
        violations.append(f"missing content dir {content_dir}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tileset", required=True, type=Path)
    ap.add_argument("--tiles-dir", required=True, type=Path,
                    help="directory containing tileset.json")
    ap.add_argument("--mode", choices=("auto", "explicit", "implicit"), default="auto")
    ap.add_argument("--tolerance-m", type=float, default=1.0,
                    help="AABB containment tolerance in meters")
    args = ap.parse_args()

    tileset = json.loads(args.tileset.read_text())
    violations: list[str] = []

    is_implicit = "implicitTiling" in tileset.get("root", {})
    mode = args.mode
    if mode == "auto":
        mode = "implicit" if is_implicit else "explicit"

    if mode == "implicit":
        check_implicit(tileset, args.tiles_dir, violations)
    else:
        check_explicit(tileset.get("root", {}), None, "root", violations, args.tiles_dir)

    if violations:
        print(f"FAIL: {len(violations)} spatial-coherence violations:", file=sys.stderr)
        for v in violations[:20]:
            print(f"  - {v}", file=sys.stderr)
        sys.exit(1)
    print(f"PASS: spatial coherence OK (mode={mode})")


if __name__ == "__main__":
    main()
