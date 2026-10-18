#!/usr/bin/env python3
"""
manifold_validation.py — Manifold/watertight validation for TSM LOD2 building meshes.

Validates triangle meshes produced by the LOD2 pipeline
(scripts/geospatial/lod2-proof-of-concept.py) for topological integrity:

  * manifold:      every edge is shared by exactly 2 faces
  * watertight:    manifold AND zero boundary edges (closed solid)
  * non-manifold vertices: link of the vertex is not a single cycle/chain
  * volume:        signed tetrahedron sum (m^3); sign encodes winding

Backends:
  * manifold3d (pip install manifold3d) — used when available for
    construction status (Error.NoError), genus, component count and
    guaranteed-manifold boolean operations.
  * pure-Python fallback — edge-count manifold analysis, implemented here
    with numpy only. No hard dependency on manifold3d.

Repair:
  * repair_mesh() merges duplicate vertices (tolerance), drops degenerate
    faces, and flips winding so signed volume is positive (outward normals).

Usage:
    python3 manifold_validation.py --input buildings.geojson --output report.json
    python3 manifold_validation.py --input buildings.geojson --output report.json --limit 50
    python3 manifold_validation.py --input buildings.geojson --output report.json --repair
"""

import argparse
import importlib.util
import json
import math
import os
import sys
import traceback

import numpy as np

# ---------------------------------------------------------------------------
# Optional manifold3d backend
# ---------------------------------------------------------------------------
try:
    from manifold3d import Manifold, Mesh as _M3Mesh, Error as _M3Error
    MANIFOLD3D_AVAILABLE = True
except ImportError:
    Manifold = None
    _M3Mesh = None
    _M3Error = None
    MANIFOLD3D_AVAILABLE = False

_HERE = os.path.dirname(os.path.abspath(__file__))
_POC_PATH = os.path.join(_HERE, "lod2-proof-of-concept.py")

MERGE_TOL_M = 0.02  # same tolerance as the LOD2 PoC


# ---------------------------------------------------------------------------
# Pure-Python topology analysis
# ---------------------------------------------------------------------------
def _edge_key(a, b):
    return (a, b) if a < b else (b, a)


def edge_face_counts(faces):
    """Map canonical edge -> number of incident faces."""
    counts = {}
    for f in faces:
        a, b, c = int(f[0]), int(f[1]), int(f[2])
        for e in (_edge_key(a, b), _edge_key(b, c), _edge_key(c, a)):
            counts[e] = counts.get(e, 0) + 1
    return counts


def non_manifold_vertices(vertices, faces):
    """Vertices whose link is not a single cycle (interior) or chain (boundary).

    For each vertex v, the link is the graph of edges opposite v in the
    incident triangles. Manifold => link is one connected component and every
    link vertex has degree 2 (interior, closed loop) or exactly two link
    vertices have degree 1 (boundary, single chain). Anything else is flagged.
    """
    n = len(vertices)
    incident = [[] for _ in range(n)]
    for fi, f in enumerate(faces):
        for v in (int(f[0]), int(f[1]), int(f[2])):
            incident[v].append(fi)

    bad = []
    for v in range(n):
        tris = incident[v]
        if not tris:
            bad.append(v)  # isolated vertex
            continue
        # link graph: adjacency of link vertices
        adj = {}
        seen_edges = set()
        dup = False
        for fi in tris:
            a, b, c = (int(x) for x in faces[fi])
            # edge opposite v
            if a == v:
                e = _edge_key(b, c)
            elif b == v:
                e = _edge_key(a, c)
            else:
                e = _edge_key(a, b)
            if e in seen_edges:
                dup = True
                break
            seen_edges.add(e)
            x, y = e
            adj.setdefault(x, set()).add(y)
            adj.setdefault(y, set()).add(x)
        if dup:
            bad.append(v)
            continue
        # connectivity: single component?
        start = next(iter(adj))
        stack = [start]
        seen = {start}
        while stack:
            cur = stack.pop()
            for nb in adj[cur]:
                if nb not in seen:
                    seen.add(nb)
                    stack.append(nb)
        if len(seen) != len(adj):
            bad.append(v)
            continue
        degs = sorted(len(adj[k]) for k in adj)
        # interior: all degree 2; boundary: exactly two degree-1, rest degree 2
        if all(d == 2 for d in degs):
            continue
        ones = sum(1 for d in degs if d == 1)
        if ones == 2 and all(d in (1, 2) for d in degs):
            continue
        bad.append(v)
    return bad


def mesh_volume(vertices, faces):
    """Signed volume (m^3) via tetrahedron sum. Positive => outward winding."""
    v = np.asarray(vertices, dtype=np.float64)
    f = np.asarray(faces, dtype=np.int64)
    v0 = v[f[:, 0]]
    v1 = v[f[:, 1]]
    v2 = v[f[:, 2]]
    return float(np.sum(np.einsum("ij,ij->i", v0, np.cross(v1, v2))) / 6.0)


def validate_manifold(vertices, faces):
    """Validate a triangle mesh. Returns a JSON-serialisable report dict.

    Pure-Python analysis always runs; manifold3d construction status is added
    when the package is available.
    """
    v = np.asarray(vertices, dtype=np.float64)
    f = np.asarray(faces, dtype=np.int64)
    counts = edge_face_counts(f)
    boundary = [e for e, c in counts.items() if c == 1]
    nonman = [e for e, c in counts.items() if c > 2]
    nm_verts = non_manifold_vertices(v, f)
    vol = mesh_volume(v, f)

    report = {
        "backend": "manifold3d" if MANIFOLD3D_AVAILABLE else "pure-python",
        "manifold3d_available": MANIFOLD3D_AVAILABLE,
        "vertices": int(len(v)),
        "triangles": int(len(f)),
        "edges": int(len(counts)),
        "boundary_edges": int(len(boundary)),
        "non_manifold_edges": int(len(nonman)),
        "non_manifold_vertices": int(len(nm_verts)),
        "is_manifold": bool(len(nonman) == 0),
        "is_watertight": bool(len(nonman) == 0 and len(boundary) == 0),
        "volume_m3": vol,
        "outward_winding": bool(vol > 0),
        "manifold3d": None,
    }

    if MANIFOLD3D_AVAILABLE:
        try:
            m = Manifold(_M3Mesh(
                vert_properties=np.ascontiguousarray(v, dtype=np.float32),
                tri_verts=np.ascontiguousarray(f, dtype=np.uint32),
            ))
            ok = m.status() == _M3Error.NoError
            comps = m.decompose() if ok else []
            report["manifold3d"] = {
                "status": m.status().name,
                "valid": bool(ok),
                "volume_m3": float(m.volume()) if ok else 0.0,
                "genus": int(m.genus()) if ok else -1,
                "components": int(len(comps)),
            }
        except Exception as e:  # never let the optional backend break validation
            report["manifold3d"] = {"status": "construction_failed",
                                    "error": f"{type(e).__name__}: {e}"}
    return report


# ---------------------------------------------------------------------------
# Repair
# ---------------------------------------------------------------------------
def repair_mesh(vertices, faces, tol=MERGE_TOL_M):
    """Basic repair: merge duplicate vertices, drop degenerate faces, fix winding.

    Returns (vertices, faces) as numpy arrays.
    """
    v = np.asarray(vertices, dtype=np.float64)
    f = np.asarray(faces, dtype=np.int64).copy()

    # 1. merge duplicate vertices within tol
    scale = 1.0 / tol
    keys = np.floor(v * scale + 0.5).astype(np.int64)
    seen = {}
    remap = np.empty(len(v), dtype=np.int64)
    new_v = []
    for i, k in enumerate(map(tuple, keys)):
        if k in seen:
            remap[i] = seen[k]
        else:
            seen[k] = len(new_v)
            remap[i] = len(new_v)
            new_v.append(v[i])
    new_v = np.array(new_v)
    f = remap[f]

    # 2. drop degenerate faces (any repeated vertex index)
    keep = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 2] != f[:, 0])
    f = f[keep]

    # 3. fix winding: positive signed volume => outward normals
    if len(f) and mesh_volume(new_v, f) < 0:
        f = f[:, ::-1].copy()

    return new_v, np.ascontiguousarray(f)


# ---------------------------------------------------------------------------
# Boolean operations (manifold3d required for guarantees)
# ---------------------------------------------------------------------------
def _to_manifold(vertices, faces):
    if not MANIFOLD3D_AVAILABLE:
        raise RuntimeError("manifold3d is not installed: pip install manifold3d")
    v = np.ascontiguousarray(np.asarray(vertices, dtype=np.float64), dtype=np.float32)
    f = np.ascontiguousarray(np.asarray(faces, dtype=np.int64), dtype=np.uint32)
    return Manifold(_M3Mesh(vert_properties=v, tri_verts=f))


def _from_manifold(m):
    om = m.to_mesh()
    v = np.asarray(om.vert_properties, dtype=np.float64)[:, :3]
    f = np.asarray(om.tri_verts, dtype=np.int64)
    return v, f


def boolean_union(mesh_a, mesh_b):
    """Guaranteed-manifold union of two (vertices, faces) meshes. Returns (v, f)."""
    ma = _to_manifold(*mesh_a)
    mb = _to_manifold(*mesh_b)
    return _from_manifold(ma + mb)


def boolean_difference(mesh_a, mesh_b):
    """Guaranteed-manifold difference A - B. Returns (v, f)."""
    ma = _to_manifold(*mesh_a)
    mb = _to_manifold(*mesh_b)
    return _from_manifold(ma - mb)


def boolean_intersection(mesh_a, mesh_b):
    """Guaranteed-manifold intersection. Returns (v, f)."""
    ma = _to_manifold(*mesh_a)
    mb = _to_manifold(*mesh_b)
    return _from_manifold(ma ^ mb)


# ---------------------------------------------------------------------------
# LOD2 building validation
# ---------------------------------------------------------------------------
def _load_build_mesh():
    """Import build_mesh from lod2-proof-of-concept.py (hyphenated filename)."""
    spec = importlib.util.spec_from_file_location("lod2_poc", _POC_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {_POC_PATH}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.build_mesh


def validate_lod2_building(feature, build_mesh=None, repair=False):
    """Validate the LOD2 mesh for one GeoJSON building feature.

    feature: GeoJSON feature dict with properties.roofPlanes (as produced by
             the TSM LOD2 pipeline input: posey-buildings-lod2-23082.geojson).
    Returns a per-building report dict (JSON-serialisable).
    """
    props = feature.get("properties", {}) or {}
    oid = props.get("objectid", feature.get("id", "unknown"))
    planes = [p for p in (props.get("roofPlanes") or [])
              if p.get("rmse_m", 9) <= 0.15 and p.get("inlier_count", 0) >= 30
              and abs(p["normal"][2]) > 1e-6]
    if len(planes) < 1:
        return {"objectid": oid, "status": "no-usable-planes"}

    if build_mesh is None:
        build_mesh = _load_build_mesh()
    try:
        mesh, info = build_mesh(feature, planes)
    except Exception as e:
        return {"objectid": oid, "status": "build_failed",
                "error": f"{type(e).__name__}: {e}",
                "trace": traceback.format_exc(limit=5)}

    v = np.asarray(mesh.vertices, dtype=np.float64)
    f = np.asarray(mesh.faces, dtype=np.int64)
    report = validate_manifold(v, f)
    report.update({
        "objectid": oid,
        "status": "ok",
        "planes_used": len(planes),
    })

    if repair and not report["is_watertight"]:
        rv, rf = repair_mesh(v, f)
        rep = validate_manifold(rv, rf)
        rep["vertices_before"] = report["vertices"]
        rep["triangles_before"] = report["triangles"]
        report["repaired"] = rep
    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(
        description="Validate manifold/watertight integrity of TSM LOD2 building meshes.")
    ap.add_argument("--input", required=True, help="Input GeoJSON (buildings with roofPlanes)")
    ap.add_argument("--output", required=True, help="Output JSON report path")
    ap.add_argument("--limit", type=int, default=None, help="Max buildings to process")
    ap.add_argument("--repair", action="store_true",
                    help="Attempt repair on non-watertight meshes and report before/after")
    args = ap.parse_args()

    with open(args.input) as fh:
        gj = json.load(fh)
    feats = gj["features"] if gj.get("type") == "FeatureCollection" else gj
    feats = [f for f in feats if (f.get("properties", {}) or {}).get("roofPlanes")]
    if args.limit:
        feats = feats[:args.limit]
    print(f"validating {len(feats)} buildings with roofPlanes "
          f"(backend: {'manifold3d' if MANIFOLD3D_AVAILABLE else 'pure-python'})",
          flush=True)

    build_mesh = _load_build_mesh()
    results = []
    for i, ft in enumerate(feats):
        try:
            r = validate_lod2_building(ft, build_mesh=build_mesh, repair=args.repair)
        except Exception as e:
            oid = (ft.get("properties", {}) or {}).get("objectid", ft.get("id", "?"))
            r = {"objectid": oid, "status": "validator_error",
                 "error": f"{type(e).__name__}: {e}"}
        results.append(r)
        if (i + 1) % 25 == 0 or i + 1 == len(feats):
            print(f"  {i + 1}/{len(feats)}", flush=True)

    ok = [r for r in results if r.get("status") == "ok"]
    wt = [r for r in ok if r.get("is_watertight")]
    mn = [r for r in ok if r.get("is_manifold")]
    summary = {
        "total": len(results),
        "built": len(ok),
        "watertight": len(wt),
        "manifold": len(mn),
        "build_failed": len([r for r in results if r.get("status") == "build_failed"]),
        "no_usable_planes": len([r for r in results if r.get("status") == "no-usable-planes"]),
        "backend": "manifold3d" if MANIFOLD3D_AVAILABLE else "pure-python",
    }
    print(f"SUMMARY: {summary['built']}/{summary['total']} built, "
          f"{summary['watertight']}/{summary['built']} watertight, "
          f"{summary['manifold']}/{summary['built']} manifold")

    with open(args.output, "w") as fh:
        json.dump({"summary": summary, "buildings": results}, fh, indent=1)
    print(f"report written to {args.output}")


if __name__ == "__main__":
    main()
