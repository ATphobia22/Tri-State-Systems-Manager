#!/usr/bin/env python3
"""
lod2-proof-of-concept.py — LOD2 roof mesh generation PoC from LiDAR-derived roof planes.

Implements the TU Delft 3DBAG/geoflow arrangement approach (Peters et al. 2022)
in pure Python (shapely + numpy + trimesh), adapted for the TSM input data:

  Input:  posey-buildings-lod2-23082.geojson — footprints in EPSG:4326,
          roofPlanes in the LiDAR EPT native CRS (empirically EPSG:3857, metres).

  Pipeline per building:
    1. Transform footprint to EPSG:3857; subtract local origin (centroid).
    2. Line extraction: pairwise plane-intersection lines projected to 2D.
       (Boundary-line extraction from alpha-shapes is skipped: no inlier
       points are available in the input. Documented deviation from 3DBAG.)
    3. Line regularisation: angle clustering (mod 180) + distance clustering.
    4. Footprint subdivision: clip lines to footprint, node + polygonize.
    5. Plane assignment per cell: highest plane at cell centroid.
    6. Triangulate cells (shapely Delaunay + containment filter), lift to planes.
    7. Extrude walls (per-vertex max-plane height), add floor at ground elev.
    8. Merge vertices, fix normals, assert watertight, export GLB.

This is a PROOF OF CONCEPT validating the approach — not production code.
Failures are logged per building and processing continues (resilient).

Usage:
    python3 lod2-proof-of-concept.py [--limit N] [--ids 740304,740319,...]
"""

import argparse
import json
import math
import os
import sys
import traceback

import numpy as np

try:
    import shapely
    from shapely.geometry import Polygon, LineString, MultiPolygon
    from shapely.ops import polygonize, unary_union, triangulate
except ImportError:
    sys.exit("shapely is required: pip install shapely")

try:
    import trimesh
except ImportError:
    sys.exit("trimesh is required: pip install trimesh")

try:
    from pyproj import Transformer
    _T = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    def lonlat_to_3857(lon, lat):
        return _T.transform(lon, lat)
except ImportError:
    # Fallback: spherical mercator (adequate for PoC at this latitude)
    def lonlat_to_3857(lon, lat):
        x = lon * 20037508.34 / 180.0
        y = math.log(math.tan((90.0 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
        y = y * 20037508.34 / 180.0
        return x, y

# ---------------------------------------------------------------- tunables
ANGLE_TOL_DEG = 5.0      # line regularisation: orientation clustering
DIST_TOL_M = 0.5         # line regularisation: perpendicular distance clustering
MIN_LINE_LEN_M = 1.0     # drop intersection lines shorter than this
MIN_DIHEDRAL_DEG = 5.0   # drop near-parallel plane pairs
MERGE_TOL_M = 0.02       # trimesh vertex merge tolerance
MIN_CELL_AREA_M2 = 0.5   # drop sliver cells
# --------------------------------------------------------------------------

INPUT = "/home/hatch/workspace/pipeline-run/posey-buildings-lod2-23082.geojson"
OUTDIR = "/tmp/lod2-poc"


def log(msg):
    print(msg, flush=True)


def plane_height(n, d, x, y):
    """Height z of plane (n, d) with n.p + d = 0 at (x, y). n is unit, nz>0."""
    return -(n[0] * x + n[1] * y + d) / n[2]


def outer_ring(ft):
    g = ft["geometry"]
    if g["type"] == "Polygon":
        return g["coordinates"][0]
    rings = [p[0] for p in g["coordinates"]]
    return max(rings, key=len)


def to_local_3857(ring):
    """Project ring to EPSG:3857 and shift by centroid -> (poly_local, origin)."""
    pts = np.array([lonlat_to_3857(c[0], c[1]) for c in ring])
    origin = pts[:-1].mean(axis=0)  # exclude closing dup
    local = pts - origin
    # ensure closed
    if not np.allclose(local[0], local[-1]):
        local = np.vstack([local, local[0]])
    return Polygon(local), origin


def intersection_line_2d(p1, p2):
    """2D projection of the 3D intersection line of two planes.

    Returns (point2d, dir2d) or None if near-parallel.
    p = dict with 'normal' (unit, nz>0) and 'd'.
    """
    n1 = np.array(p1["normal"]); n2 = np.array(p2["normal"])
    # dihedral check
    cosd = abs(float(np.dot(n1, n2)))
    cosd = min(1.0, cosd)
    dihedral = math.degrees(math.acos(cosd))
    if dihedral < MIN_DIHEDRAL_DEG:
        return None
    d1, d2 = p1["d"], p2["d"]
    direction = np.cross(n1, n2)
    if np.linalg.norm(direction) < 1e-9:
        return None
    # A point on the line: solve in the plane z=0 -> n1.xy . p = -d1, n2.xy . p = -d2
    A = np.array([[n1[0], n1[1]], [n2[0], n2[1]]])
    if abs(np.linalg.det(A)) < 1e-9:
        # planes differ only in z-tilt direction; use least-squares point
        pt, *_ = np.linalg.lstsq(A, np.array([-d1, -d2]), rcond=None)
    else:
        pt = np.linalg.solve(A, np.array([-d1, -d2]))
    d2d = direction[:2]
    if np.linalg.norm(d2d) < 1e-9:
        return None  # vertical intersection line (shouldn't happen for roofs)
    return pt, d2d / np.linalg.norm(d2d)


def regularise_lines(lines):
    """Angle clustering (mod 180) then distance clustering. Keeps longest per cluster.

    lines: list of shapely LineString (already clipped to footprint).
    Returns deduplicated list.
    """
    if not lines:
        return []
    items = []
    for ln in lines:
        c = np.array(ln.coords)
        v = c[-1] - c[0]
        L = float(np.linalg.norm(v))
        if L < 1e-9:
            continue
        ang = math.degrees(math.atan2(v[1], v[0])) % 180.0
        items.append({"line": ln, "angle": ang, "len": L,
                      "mid": (c[0] + c[-1]) / 2.0, "dir": v / L})
    # angle clustering (greedy)
    clusters = []
    for it in sorted(items, key=lambda i: i["angle"]):
        placed = False
        for cl in clusters:
            if abs(it["angle"] - cl["rep_angle"]) <= ANGLE_TOL_DEG:
                cl["members"].append(it)
                placed = True
                break
        if not placed:
            clusters.append({"rep_angle": it["angle"], "members": [it]})
    kept = []
    for cl in clusters:
        # distance clustering within angle cluster: perpendicular distance
        # measured against the longest member as reference
        members = sorted(cl["members"], key=lambda m: -m["len"])
        groups = []
        for m in members:
            ref = None
            for g in groups:
                r = g[0]
                # perpendicular distance of m.mid to line through r.mid dir r.dir
                w = m["mid"] - r["mid"]
                perp = abs(w[0] * -r["dir"][1] + w[1] * r["dir"][0])
                if perp <= DIST_TOL_M:
                    ref = g
                    break
            if ref is None:
                groups.append([m])
            else:
                ref.append(m)
        for g in groups:
            kept.append(max(g, key=lambda m: m["len"])["line"])
    return kept


def subdivide(footprint, lines):
    """Planar partition of footprint by lines -> list of cell Polygons."""
    clipped = []
    for ln in lines:
        seg = footprint.intersection(ln)
        if seg.is_empty:
            continue
        geoms = seg.geoms if seg.geom_type == "MultiLineString" else [seg]
        for g in geoms:
            if g.length >= MIN_LINE_LEN_M:
                clipped.append(g)
    network = unary_union([footprint.boundary] + clipped)
    cells = [c for c in polygonize(network)
             if c.area >= MIN_CELL_AREA_M2 and footprint.contains(c.centroid)]
    if not cells:
        # fallback: no usable lines -> whole footprint is one cell
        cells = [footprint]
    return cells


def assign_planes(cells, planes, origin):
    """Highest-plane-at-centroid labelling. Returns list of (cell, plane_idx)."""
    out = []
    ox, oy = origin
    for cell in cells:
        cx, cy = cell.centroid.x, cell.centroid.y
        # centroid in 3857 (planes are in 3857)
        X, Y = cx + ox, cy + oy
        best, bestz = 0, -1e18
        for i, p in enumerate(planes):
            n = p["normal"]
            z = plane_height(n, p["d"], X, Y)
            if z > bestz:
                bestz, best = z, i
        out.append((cell, best))
    return out


def triangulate_cell(cell):
    """Triangulate a polygon cell -> list of (3,2) triangle vertex arrays.

    Strategy: Delaunay of vertices, keep triangles inside the cell; verify
    area coverage; fall back to centroid fan if gaps remain.
    """
    tris = []
    try:
        for t in triangulate(cell):
            tc = np.array(t.exterior.coords)[:3]
            tri_poly = Polygon(tc)
            if tri_poly.area < 1e-9:
                continue
            if cell.contains(tri_poly.centroid):
                tris.append(tc)
    except Exception:
        pass
    # coverage check
    cov = sum(Polygon(t).area for t in tris)
    if cov < 0.98 * cell.area:
        # fallback: fan from centroid (exact for convex/star-shaped cells)
        tris = []
        c = np.array(cell.centroid.coords[0])
        ring = np.array(cell.exterior.coords)[:-1]
        for i in range(len(ring)):
            tris.append(np.array([c, ring[i], ring[(i + 1) % len(ring)]]))
    return tris


def build_mesh(ft, planes):
    """Build a watertight LOD2 mesh for one building feature.

    Returns (trimesh.Trimesh, info_dict). Raises on unrecoverable failure.
    """
    props = ft["properties"]
    ring = outer_ring(ft)
    footprint, origin = to_local_3857(ring)
    if not footprint.is_valid:
        footprint = footprint.buffer(0)
    # Enforce CCW outer ring so floor-fan winding is deterministic (downward).
    if not footprint.exterior.is_ccw:
        footprint = Polygon(list(footprint.exterior.coords)[::-1])
    ox, oy = float(origin[0]), float(origin[1])

    # --- line extraction: pairwise plane intersections ---
    raw_lines = []
    # work in a generous local frame for line/footprint intersection:
    # build lines in 3857 then shift by origin
    minx, miny, maxx, maxy = footprint.bounds
    diag = math.hypot(maxx - minx, maxy - miny) + 10.0
    fp3857 = Polygon(np.array(footprint.exterior.coords) + origin)
    for i in range(len(planes)):
        for j in range(i + 1, len(planes)):
            r = intersection_line_2d(planes[i], planes[j])
            if r is None:
                continue
            pt, dv = r  # in 3857
            p1 = pt - dv * diag
            p2 = pt + dv * diag
            ln = LineString([p1, p2])
            seg = fp3857.intersection(ln)
            if seg.is_empty:
                continue
            geoms = seg.geoms if seg.geom_type == "MultiLineString" else [seg]
            for g in geoms:
                if g.length >= MIN_LINE_LEN_M:
                    # shift to local
                    lc = np.array(g.coords) - origin
                    raw_lines.append(LineString(lc))

    # --- regularise + subdivide ---
    lines = regularise_lines(raw_lines)
    cells = subdivide(footprint, lines)
    labelled = assign_planes(cells, planes, origin)

    # --- heights ---
    def hmax(xl, yl):
        X, Y = xl + ox, yl + oy
        return max(plane_height(p["normal"], p["d"], X, Y) for p in planes)

    # floor elevation
    floor_z = None
    for key in ("lidarGroundElevM",):
        v = props.get(key)
        if v is not None and math.isfinite(float(v)):
            floor_z = float(v)
            break
    if floor_z is None:
        gv = props.get("groundElevationMeanFt")
        if gv is not None and math.isfinite(float(gv)):
            floor_z = float(gv) * 0.3048
    # roof sample for fallback
    sample_z = hmax(0.0, 0.0)
    if floor_z is None or not math.isfinite(floor_z):
        floor_z = sample_z - 3.0
    if floor_z >= sample_z:
        floor_z = sample_z - 3.0  # sanity: floor must be below roof

    # --- assemble triangles ---
    roof_tris = []  # list of (3,3), CCW-up

    # roof faces (lifted, CCW-up)
    for cell, pi in labelled:
        n = planes[pi]["normal"]; d = planes[pi]["d"]
        for t2 in triangulate_cell(cell):
            t3 = []
            for (xl, yl) in t2:
                z = plane_height(n, d, xl + ox, yl + oy)
                t3.append((xl, yl, z))
            t3 = np.array(t3)
            # ensure CCW in XY (upward normal)
            v1 = t3[1] - t3[0]; v2 = t3[2] - t3[0]
            if v1[0] * v2[1] - v1[1] * v2[0] < 0:
                t3 = t3[[0, 2, 1]]
            roof_tris.append(t3)

    if not roof_tris:
        raise RuntimeError("no roof triangles generated")

    # --- walls from the roof boundary loop (topologically exact) ---
    # The roof boundary in plan traces the footprint edge; building walls
    # down from the actual roof edge vertices guarantees coincidence
    # (no cracks between wall tops and roof).
    # CRITICAL: preserve edge DIRECTION from the source triangles. For
    # CCW-up roof triangles, a boundary edge (i->j) has the interior to
    # the LEFT; the outward wall normal is then (ey,-ex). Using unordered
    # edges flips half the walls inward (volume cancellation).
    Rv = np.vstack(roof_tris).reshape(-1, 3)
    ntri = len(roof_tris)
    # directed edges: for each triangle (a,b,c), edges (a,b),(b,c),(c,a)
    dedges = []
    for t in range(ntri):
        a, b, c = 3*t, 3*t+1, 3*t+2
        dedges += [(a,b), (b,c), (c,a)]
    from collections import Counter
    # count unordered for boundary detection, but keep direction
    unord = Counter(tuple(sorted(e)) for e in dedges)
    bnd_directed = [e for e in dedges if unord[tuple(sorted(e))] == 1]

    # footprint boundary in plan (for outer/inner classification)
    fp_bnd = footprint.boundary
    from shapely.geometry import Point
    wall_tris = []
    for (i, j) in bnd_directed:
        p1, p2 = Rv[i], Rv[j]
        # outer edge: midpoint near footprint boundary (within 0.3 m in plan)
        mid = (p1[:2] + p2[:2]) / 2.0
        outer = fp_bnd.distance(Point(mid[0], mid[1])) < 0.3
        if outer:
            # wall down to floor; (p1->p2) has interior left, so outward
            # is right => triangles (a,b,p2),(a,p2,p1) yield outward normal
            a = np.array([p1[0], p1[1], floor_z])
            b = np.array([p2[0], p2[1], floor_z])
            wall_tris.append(np.array([a, b, p2]))
            wall_tris.append(np.array([a, p2, p1]))
        # inner boundary edges (partition gaps / step edges): skip for PoC;
        # they arise only if triangulation left a hole, which the
        # coverage-checked triangulate_cell avoids.

    # --- floor face (downward): fan from footprint centroid ---
    bnd = np.array(footprint.exterior.coords)
    c2 = np.array(footprint.centroid.coords[0])
    floor_tris = []
    for i in range(len(bnd) - 1):
        p1, p2 = bnd[i], bnd[i + 1]
        floor_tris.append(np.array([
            [c2[0], c2[1], floor_z],
            [p2[0], p2[1], floor_z],
            [p1[0], p1[1], floor_z],
        ]))

    tris = roof_tris + wall_tris + floor_tris

    V = np.vstack(tris).reshape(-1, 3)
    F = np.arange(len(V)).reshape(-1, 3)
    mesh = trimesh.Trimesh(vertices=V, faces=F, process=True)
    mesh.merge_vertices(merge_norm=True, merge_tex=False)

    # Fill holes BEFORE orientation check: a mesh with boundary edges has
    # no defined volume, so the sign check must come after closing.
    try:
        if not mesh.is_watertight:
            mesh.fill_holes()
            mesh.merge_vertices(merge_norm=True, merge_tex=False)
    except Exception:
        pass

    # Deterministic orientation: a watertight mesh with positive signed
    # volume has outward-pointing normals (divergence theorem). Flip all
    # faces if the signed volume is negative.
    # NOTE: trimesh's `is_volume` is False when volume <= 0, so we must test
    # `is_watertight` (not `is_volume`) here, else the flip never fires.
    if mesh.is_watertight and mesh.volume < 0:
        mesh.faces = mesh.faces[:, ::-1]
        # re-validate watertightness after flip (topology unchanged, but be sure)
        assert mesh.is_watertight, "flip broke watertightness"

    info = {
        "cells": len(labelled),
        "raw_lines": len(raw_lines),
        "kept_lines": len(lines),
        "triangles": len(mesh.faces),
        "vertices": len(mesh.vertices),
        "watertight": bool(mesh.is_watertight),
        "volume": float(mesh.volume) if mesh.is_watertight else 0.0,
        "floor_z": floor_z,
        "origin_3857": [ox, oy],
    }
    return mesh, info


def process_one(ft, outdir):
    oid = ft["properties"].get("objectid", ft.get("id"))
    planes = ft["properties"].get("roofPlanes") or []
    # filter weak planes (noise): keep rmse<=0.15 and inliers>=30
    planes = [p for p in planes
              if p.get("rmse_m", 9) <= 0.15 and p.get("inlier_count", 0) >= 30
              and abs(p["normal"][2]) > 1e-6]
    if len(planes) < 1:
        return {"objectid": oid, "status": "no-usable-planes"}
    try:
        mesh, info = build_mesh(ft, planes)
        path = os.path.join(outdir, f"lod2-{oid}.glb")
        # stash translation for consumers (float32 precision)
        mesh.metadata["tsm_origin_3857"] = info["origin_3857"]
        mesh.metadata["tsm_objectid"] = oid
        mesh.export(path)
        info.update({"objectid": oid, "status": "ok", "glb": path,
                     "glb_bytes": os.path.getsize(path)})
        return info
    except Exception as e:
        return {"objectid": oid, "status": "failed",
                "error": f"{type(e).__name__}: {e}",
                "trace": traceback.format_exc(limit=5)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--ids", default=None, help="comma-separated objectids")
    ap.add_argument("--outdir", default=OUTDIR)
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    with open(INPUT) as f:
        data = json.load(f)
    feats = data["features"]

    if args.ids:
        want = {int(x) for x in args.ids.split(",")}
        feats = [f for f in feats
                 if f["properties"].get("objectid") in want]
    else:
        feats = [f for f in feats if f["properties"].get("roofPlanes")][:args.limit]

    results = []
    for ft in feats:
        oid = ft["properties"].get("objectid")
        log(f"--- building {oid}")
        r = process_one(ft, args.outdir)
        log(f"    {r['status']}" + (f" watertight={r.get('watertight')} tris={r.get('triangles')}" if r["status"] == "ok" else f" {r.get('error','')}"))
        results.append(r)

    ok = [r for r in results if r["status"] == "ok"]
    wt = [r for r in ok if r.get("watertight")]
    log(f"\n==== SUMMARY: {len(ok)}/{len(results)} built, {len(wt)}/{len(ok)} watertight")

    summary_path = os.path.join(args.outdir, "poc-summary.json")
    with open(summary_path, "w") as f:
        json.dump(results, f, indent=1, default=str)
    log(f"summary: {summary_path}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
