#!/usr/bin/env python3
"""Generate deterministic OGC 3D Tiles 1.1 LOD1 building blocks.

Input: posey-buildings-derived.geojson (parcel polygons with ground
elevations in ft NAVD88 and flood-depth screening values).

For each building feature a simple LOD1 block model (extruded prism) is
generated as a GLB in a tile-local ENU frame, following the same pattern as
scripts/geospatial/build-terrain-3d-tiles.py:
  - horizontal placement uses WGS84 ellipsoidal surface geometry
  - NAVD88 elevation is retained as the visualization vertical offset
    without a NAVD88-to-ellipsoid transformation

This is visualization data, not survey-grade engineering geometry.
Building heights are estimated (see --extrusion-ft), footprints are parcel
polygons (not surveyed building footprints), and flood coloring reflects
screening-grade depth values, not certified flood determinations.

Determinism: features are processed in ascending sourceObjectId order, the
extrusion height and colors are fixed constants, polygon triangulation is a
deterministic ear-clipping implementation, and JSON is emitted with compact
separators. Same input bytes => same output bytes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

WGS84_A = 6378137.0
WGS84_E2 = 6.6943799901413165e-3
FT_TO_M = 0.3048

# Fixed LOD1 visualization constants (documented estimates, not surveyed).
DEFAULT_EXTRUSION_FT = 10.0
COLOR_FLOODED = [0.20, 0.45, 0.85, 1.0]   # blue tint: screening depth > 0
COLOR_DRY = [0.60, 0.57, 0.52, 1.0]       # neutral warm gray

GENERATOR = "TSM deterministic building 3D Tiles converter v1"


def surface(lon_deg: float, lat_deg: float) -> tuple[float, float, float]:
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    s, c = math.sin(lat), math.cos(lat)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * s * s)
    return n * c * math.cos(lon), n * c * math.sin(lon), n * (1.0 - WGS84_E2) * s


def enu_basis(lon_deg: float, lat_deg: float) -> tuple[tuple[float, float, float], ...]:
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    return (
        (-math.sin(lon), math.cos(lon), 0.0),
        (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)),
        (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)),
    )


def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def norm(v):
    d = math.sqrt(dot(v, v))
    return (0.0, 0.0, 1.0) if d == 0.0 else (v[0] / d, v[1] / d, v[2] / d)


def signed_area_2d(pts) -> float:
    s = 0.0
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        s += x0 * y1 - x1 * y0
    return s / 2.0


def ear_clip(pts) -> list[tuple[int, int, int]]:
    """Deterministic ear-clipping triangulation of a simple polygon.

    pts: list of (x, y) with no duplicated closing vertex. Returns triangle
    index triples with consistent orientation matching the input winding.
    """
    n = len(pts)
    if n < 3:
        return []
    if n == 3:
        return [(0, 1, 2)]
    ccw = signed_area_2d(pts) > 0.0

    def is_convex(prev, cur, nxt) -> bool:
        ux, uy = pts[cur][0] - pts[prev][0], pts[cur][1] - pts[prev][1]
        vx, vy = pts[nxt][0] - pts[cur][0], pts[nxt][1] - pts[cur][1]
        z = ux * vy - uy * vx
        return z > 0.0 if ccw else z < 0.0

    def in_triangle(px, py, ax, ay, bx, by, cx, cy) -> bool:
        # Barycentric sign test with a small tolerance; points on the edge
        # count as inside so ears are only cut when strictly clear.
        def sign(x0, y0, x1, y1, x2, y2):
            return (x0 - x2) * (y1 - y2) - (x1 - x2) * (y0 - y2)
        d1 = sign(px, py, ax, ay, bx, by)
        d2 = sign(px, py, bx, by, cx, cy)
        d3 = sign(px, py, cx, cy, ax, ay)
        has_neg = (d1 < -1e-12) or (d2 < -1e-12) or (d3 < -1e-12)
        has_pos = (d1 > 1e-12) or (d2 > 1e-12) or (d3 > 1e-12)
        return not (has_neg and has_pos)

    remaining = list(range(n))
    tris: list[tuple[int, int, int]] = []
    guard = 0
    while len(remaining) > 3 and guard < n * n:
        guard += 1
        cut = False
        m = len(remaining)
        for i in range(m):
            prev, cur, nxt = remaining[(i - 1) % m], remaining[i], remaining[(i + 1) % m]
            if not is_convex(prev, cur, nxt):
                continue
            ax, ay = pts[prev]
            bx, by = pts[cur]
            cx, cy = pts[nxt]
            ear_clear = True
            for j in remaining:
                if j in (prev, cur, nxt):
                    continue
                if in_triangle(pts[j][0], pts[j][1], ax, ay, bx, by, cx, cy):
                    ear_clear = False
                    break
            if ear_clear:
                tris.append((prev, cur, nxt))
                del remaining[i]
                cut = True
                break
        if not cut:
            break  # degenerate; fall back below
    if len(remaining) == 3:
        tris.append((remaining[0], remaining[1], remaining[2]))
    elif len(remaining) > 3:
        # Degenerate fallback: fan from vertex 0 (deterministic).
        for i in range(1, len(remaining) - 1):
            tris.append((remaining[0], remaining[i], remaining[i + 1]))
    return tris


def largest_polygon_coords(geometry) -> list | None:
    """Return the exterior ring (without closing duplicate) of the largest
    polygon by absolute 2D area. Holes are ignored (documented)."""
    gtype = geometry.get("type")
    polys = []
    if gtype == "Polygon":
        polys = [geometry["coordinates"]]
    elif gtype == "MultiPolygon":
        polys = geometry["coordinates"]
    else:
        return None
    best, best_area = None, -1.0
    for poly in polys:
        if not poly or not poly[0]:
            continue
        ring = poly[0]
        if len(ring) >= 2 and ring[0] == ring[-1]:
            ring = ring[:-1]
        if len(ring) < 3:
            continue
        area = abs(signed_area_2d(ring))
        if area > best_area:
            best, best_area = ring, area
    return best


def ground_elevation_ft(props) -> float | None:
    for key in ("groundElevationMeanFt", "groundElevationFt",
                "groundElevationMinFt", "groundElevationMaxFt"):
        v = props.get(key)
        if isinstance(v, (int, float)) and math.isfinite(v):
            return float(v)
    return None


def is_flooded(props) -> bool:
    if props.get("isFlooded") is True:
        return True
    d = props.get("floodDepthFt")
    return isinstance(d, (int, float)) and d > 0.0


@dataclass
class BuildingTile:
    source_id: int
    uri: str
    center: tuple[float, float, float]   # ENU local frame
    half: tuple[float, float, float]
    origin: tuple[float, float, float]   # ECEF
    axes: tuple[tuple[float, float, float], ...]
    flooded: bool
    ground_ft: float


def build_prism(ring_lonlat, base_z_m: float, top_z_m: float,
                origin, axes) -> tuple[list, list]:
    """Build a flat-shaded extruded prism. Returns (positions, normals) as
    non-indexed triangle lists in the tile-local ENU frame."""
    pts2 = [(lon, lat) for lon, lat in ring_lonlat]
    # Local ENU (x=east, y=north) for triangulation/winding decisions.
    local = []
    for lon, lat in pts2:
        d = sub(surface(lon, lat), origin)
        local.append((dot(d, axes[0]), dot(d, axes[1])))
    # Drop near-duplicate consecutive vertices for triangulation stability.
    clean = []
    for p in local:
        if not clean or math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 1e-6:
            clean.append(p)
    if clean and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) < 1e-6:
        clean.pop()
    if len(clean) < 3:
        return [], []
    tris = ear_clip(clean)
    if not tris:
        return [], []

    positions: list = []
    normals: list = []

    def emit(a, b, c):
        n = norm(cross(sub(b, a), sub(c, a)))
        positions.extend([a, b, c])
        normals.extend([n, n, n])

    n = len(clean)
    for i0, i1, i2 in tris:
        # Top cap (+z): ensure CCW seen from above.
        a = (clean[i0][0], clean[i0][1], top_z_m)
        b = (clean[i1][0], clean[i1][1], top_z_m)
        c = (clean[i2][0], clean[i2][1], top_z_m)
        if signed_area_2d([clean[i0], clean[i1], clean[i2]]) < 0:
            b, c = c, b
        emit(a, b, c)
        # Bottom cap (-z): opposite winding.
        a = (clean[i0][0], clean[i0][1], base_z_m)
        b = (clean[i1][0], clean[i1][1], base_z_m)
        c = (clean[i2][0], clean[i2][1], base_z_m)
        if signed_area_2d([clean[i0], clean[i1], clean[i2]]) > 0:
            b, c = c, b
        emit(a, b, c)
    # Sides: outward-facing quads for each edge.
    ccw = signed_area_2d(clean) > 0.0
    for i in range(n):
        j = (i + 1) % n
        x0, y0 = clean[i]
        x1, y1 = clean[j]
        p00 = (x0, y0, base_z_m)
        p01 = (x0, y0, top_z_m)
        p10 = (x1, y1, base_z_m)
        p11 = (x1, y1, top_z_m)
        # For CCW polygons, outward is to the right of edge i->j.
        if ccw:
            emit(p00, p10, p11)
            emit(p00, p11, p01)
        else:
            emit(p00, p11, p10)
            emit(p00, p01, p11)
    return positions, normals


def pad4(data: bytes, fill: bytes = b"\0") -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def glb(positions, normals_list, base_color) -> bytes:
    pos_bin = b"".join(struct.pack("<3f", *v) for v in positions)
    nrm_bin = b"".join(struct.pack("<3f", *v) for v in normals_list)
    binary = pad4(pos_bin + nrm_bin)
    lo = [min(v[i] for v in positions) for i in range(3)]
    hi = [max(v[i] for v in positions) for i in range(3)]
    doc = {
        "asset": {"version": "2.0", "generator": GENERATOR},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        # Z-up ENU -> Y-up glTF, same convention as the terrain converter.
        "nodes": [{"mesh": 0, "matrix": [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]}],
        "meshes": [{"primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1},
            "mode": 4,
            "material": 0,
        }]}],
        "materials": [{"pbrMetallicRoughness": {
            "baseColorFactor": base_color,
            "metallicFactor": 0.0,
            "roughnessFactor": 0.9,
        }}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bin), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bin), "byteLength": len(nrm_bin), "target": 34962},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(positions),
             "type": "VEC3", "min": lo, "max": hi},
            {"bufferView": 1, "componentType": 5126, "count": len(normals_list),
             "type": "VEC3"},
        ],
    }
    js = pad4(json.dumps(doc, separators=(",", ":")).encode("utf-8"), b" ")
    cj = struct.pack("<I4s", len(js), b"JSON") + js
    cb = struct.pack("<I4s", len(binary), b"BIN\0") + binary
    return struct.pack("<4sII", b"glTF", 2, 12 + len(cj) + len(cb)) + cj + cb


def box12(center, half) -> list:
    c, h = center, half
    return [c[0], c[1], c[2],
            h[0], 0.0, 0.0,
            0.0, h[1], 0.0,
            0.0, 0.0, h[2]]


def absolute_transform(origin, axes) -> list:
    e, n, u = axes
    o = origin
    return [e[0], e[1], e[2], 0.0,
            n[0], n[1], n[2], 0.0,
            u[0], u[1], u[2], 0.0,
            o[0], o[1], o[2], 1.0]


def write_hashes(root: Path, files: Iterable[Path]) -> None:
    lines = []
    for p in sorted(files):
        digest = hashlib.sha256(p.read_bytes()).hexdigest()
        lines.append(f"{digest}  {p.relative_to(root).as_posix()}\n")
    (root / "SHA256SUMS").write_text("".join(lines))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--geojson", required=True, type=Path)
    ap.add_argument("--out-dir", required=True, type=Path)
    ap.add_argument("--extrusion-ft", type=float, default=DEFAULT_EXTRUSION_FT)
    ap.add_argument("--limit", type=int, default=0,
                    help="process only the first N features (deterministic subset for testing)")
    ap.add_argument("--source-url", default="https://poseyin.wthgis.com/")
    ap.add_argument("--source-version", default="TSM derived building screening dataset v1")
    args = ap.parse_args()
    if args.extrusion_ft <= 0:
        raise SystemExit("--extrusion-ft must be positive")

    data = json.loads(args.geojson.read_text())
    features = data.get("features", [])
    # Deterministic order: ascending sourceObjectId.
    def sort_key(ft):
        sid = ft.get("properties", {}).get("sourceObjectId")
        return (0, int(sid)) if isinstance(sid, (int, float)) else (1, 0)
    features = sorted(features, key=sort_key)
    if args.limit > 0:
        features = features[:args.limit]

    args.out_dir.mkdir(parents=True, exist_ok=True)
    height_m = args.extrusion_ft * FT_TO_M

    tiles: list[BuildingTile] = []
    paths: list[Path] = []
    skipped = 0
    for ft in features:
        props = ft.get("properties", {}) or {}
        sid = props.get("sourceObjectId")
        if not isinstance(sid, (int, float)):
            skipped += 1
            continue
        sid = int(sid)
        ring = largest_polygon_coords(ft.get("geometry", {}))
        if not ring:
            skipped += 1
            continue
        elev_ft = ground_elevation_ft(props)
        if elev_ft is None:
            skipped += 1
            continue
        # Centroid of the ring for the tile-local ENU origin.
        lon0 = sum(p[0] for p in ring) / len(ring)
        lat0 = sum(p[1] for p in ring) / len(ring)
        origin = surface(lon0, lat0)
        axes = enu_basis(lon0, lat0)
        base_z_m = elev_ft * FT_TO_M
        top_z_m = base_z_m + height_m
        positions, normals_list = build_prism(ring, base_z_m, top_z_m, origin, axes)
        if not positions:
            skipped += 1
            continue
        flooded = is_flooded(props)
        color = COLOR_FLOODED if flooded else COLOR_DRY
        uri = f"{sid}.glb"
        path = args.out_dir / uri
        path.write_bytes(glb(positions, normals_list, color))
        paths.append(path)
        xs = [v[0] for v in positions]
        ys = [v[1] for v in positions]
        zs = [v[2] for v in positions]
        center = ((min(xs) + max(xs)) / 2.0,
                  (min(ys) + max(ys)) / 2.0,
                  (min(zs) + max(zs)) / 2.0)
        half = (max((max(xs) - min(xs)) / 2.0, 0.01),
                max((max(ys) - min(ys)) / 2.0, 0.01),
                max((max(zs) - min(zs)) / 2.0, 0.01))
        tiles.append(BuildingTile(sid, uri, center, half, origin, axes,
                                  flooded, elev_ft))

    if not tiles:
        raise SystemExit("no building tiles generated")

    # Root bounding volume: all tile corners in ECEF -> center + radius box.
    corners = []
    for t in tiles:
        e, n_, u = t.axes
        o = t.origin
        for sx in (-t.half[0], t.half[0]):
            for sy in (-t.half[1], t.half[1]):
                for sz in (-t.half[2], t.half[2]):
                    corners.append((o[0] + e[0] * sx + n_[0] * sy + u[0] * sz,
                                    o[1] + e[1] * sx + n_[1] * sy + u[1] * sz,
                                    o[2] + e[2] * sx + n_[2] * sy + u[2] * sz))
    rc = tuple(sum(p[i] for p in corners) / len(corners) for i in range(3))
    radius = max(math.sqrt(sum((p[i] - rc[i]) ** 2 for i in range(3)))
                 for p in corners)
    root_box = [rc[0], rc[1], rc[2],
                radius, 0.0, 0.0,
                0.0, radius, 0.0,
                0.0, 0.0, radius]

    def child_node(t: BuildingTile) -> dict:
        return {
            "boundingVolume": {"box": box12(t.center, t.half)},
            "geometricError": 0,
            "refine": "REPLACE",
            "transform": absolute_transform(t.origin, t.axes),
            "content": {"uri": t.uri},
            "extras": {"tsm": {
                "sourceObjectId": t.source_id,
                "flooded": t.flooded,
                "groundElevationFtNavd88": t.ground_ft,
                "lod": 1,
            }},
        }

    root = {
        "boundingVolume": {"box": root_box},
        "geometricError": radius,
        "refine": "REPLACE",
        "children": [child_node(t) for t in tiles],
    }
    tileset = {
        "asset": {"version": "1.1", "extras": {"tsm": {
            "authorityClass": "DERIVED",
            "engineeringUse": False,
            "regulatoryUse": False,
        }}},
        "geometricError": radius,
        "root": root,
    }
    (args.out_dir / "tileset.json").write_text(
        json.dumps(tileset, indent=2) + "\n")

    geojson_sha = hashlib.sha256(args.geojson.read_bytes()).hexdigest()
    manifest = {
        "schemaVersion": "1.0.0",
        "artifactId": "tsm-buildings-3d-tiles-lod1",
        "format": "OGC 3D Tiles 1.1 + glTF 2.0 GLB",
        "source": {
            "sourceUrl": args.source_url,
            "sourceVersionOrEffectiveDate": args.source_version,
            "sourceId": "posey-buildings-derived",
        },
        "input": {
            "geojsonSha256": geojson_sha,
            "featureCount": len(features),
            "tileCount": len(tiles),
            "skipped": skipped,
        },
        "transformation": (
            "IGIO building polygon -> largest ring -> deterministic ear-clip triangulation -> "
            "flat-shaded LOD1 prism extruded by a fixed estimated height in a "
            "tile-local ENU frame; WGS84 surface horizontal placement; NAVD88 "
            "ground elevation retained as visualization vertical offset without "
            "vertical datum conversion. Flooded features tinted blue, dry neutral."
        ),
        "parameters": {
            "extrusionFt": args.extrusion_ft,
            "extrusionEstimated": True,\n            "footprintGeometry": "authoritative IGIO LiDAR-derived polygon",\n            "elevationSource": "IGIO footprint joined to committed Posey 3DEP-derived DEM",
            "colorFlooded": COLOR_FLOODED,
            "colorDry": COLOR_DRY,
        },
        "softwareVersion": GENERATOR,
        "authorityClass": "DERIVED",
        "engineeringUse": False,
        "regulatoryUse": False,
        "tileCount": len(tiles),
        "deterministic": True,
        "content": sorted(p.relative_to(args.out_dir).as_posix() for p in paths),
    }
    (args.out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n")
    write_hashes(args.out_dir,
                 paths + [args.out_dir / "tileset.json",
                          args.out_dir / "manifest.json"])
    print(f"generated {len(tiles)} GLBs; skipped={skipped}; out={args.out_dir}")


if __name__ == "__main__":
    main()
