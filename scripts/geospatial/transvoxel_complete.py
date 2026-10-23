#!/usr/bin/env python3
"""
transvoxel_complete.py — Completion of the TSM Transvoxel terrain pipeline.

Builds on dem_to_transvoxel.py (DEM -> SDF -> balanced octree -> marching
cubes) and transvoxel_stitch_poc.py (crack-free face transitions). Adds the
three remaining pieces:

  --skirts    Extrude boundary edges downward + bottom cap -> watertight solid.
  --tile      Tile a large DEM region, mesh each tile, merge with crack-free
              seams (analytic SDF => shared-face vertices coincide
              bit-identically, same principle as the stitch PoC).
  --validate  Height-error validation: mesh vertices vs the bilinear DEM
              sampler (the analytic field the SDF is built from).
  --all       Tile -> skirts on the merged mesh -> validate.

Honest notes:
  - Skirts assume a heightfield mesh whose boundary is the domain perimeter
    (true for marching-cubes heightfield extraction). Extra boundary loops
    are each fan-capped with a warning.
  - Height error is measured against the bilinear DEM sampler, not against a
    higher-resolution ground truth.
  - Tiling does not use Lengyel's 73-class transition tables (same documented
    scope as the PoC); per-leaf adaptive meshing remains future work.

Usage:
    python3 transvoxel_complete.py --skirts --wx 1024 --wy 1024 --n 64
    python3 transvoxel_complete.py --tile --wx 1024 --wy 1024 --W 192 --H 192 \\
        --tile_n 64 --out /tmp/tvx
    python3 transvoxel_complete.py --validate --mesh /tmp/tvx/transvoxel-tiled.glb \\
        --wx 1024 --wy 1024 --W 192 --H 192
    python3 transvoxel_complete.py --all --wx 1024 --wy 1024 --W 128 --H 128 \\
        --tile_n 64 --out /tmp/tvx-all
"""

import argparse
import json
import logging
import os
import sys

import numpy as np

log = logging.getLogger("transvoxel-complete")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dem_to_transvoxel import (
    DEM_PATH, FT_TO_M,
    load_dem_window, make_height_sampler,
)

FT_TO_M = FT_TO_M  # noqa: F811  (re-export for clarity)


# ============================ helpers ============================

def dem_window_for_region(wx, wy, W, H):
    """Load a DEM region (pixels) and return (dem_m, px, sampler)."""
    dem_m, px = load_dem_window(DEM_PATH, wx, wy, W, height=H)
    local_sampler = make_height_sampler(dem_m, px)

    # Downstream tiling helpers pass raster-global pixel coordinates multiplied
    # by metric pixel spacing; translate them into this window's local frame.
    origin_x_m, origin_y_m = wx * px, wy * px

    def global_sampler(x, y):
        return local_sampler(np.asarray(x) - origin_x_m, np.asarray(y) - origin_y_m)

    return dem_m, px, global_sampler


def mesh_tile(h, tile_wx, tile_wy, n, px, Z0, dz):
    """Marching-cubes mesh for one tile; vertices in GLOBAL meters."""
    from skimage.measure import marching_cubes
    ii, jj = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    hs = h((tile_wx + ii) * px, (tile_wy + jj) * px)
    z = Z0 + np.arange(n) * dz
    sdf = z[None, None, :] - hs[:, :, None]
    sdf_zyx = np.transpose(sdf.astype(np.float32), (2, 1, 0))
    try:
        verts, faces, _, _ = marching_cubes(sdf_zyx, level=0.0)
    except ValueError:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64)
    v = np.empty_like(verts)
    v[:, 0] = (tile_wx + verts[:, 2]) * px   # global x
    v[:, 1] = (tile_wy + verts[:, 1]) * px   # global y
    v[:, 2] = Z0 + verts[:, 0] * dz
    ok = np.isfinite(v).all(axis=1)
    v = v[ok]
    old2new = np.full(ok.shape[0], -1, dtype=np.int64)
    old2new[np.where(ok)[0]] = np.arange(int(ok.sum()))
    faces = old2new[faces]
    keep = (faces >= 0).all(axis=1)
    faces = faces[keep]
    T = v[faces]
    area = 0.5 * np.linalg.norm(
        np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1)
    return v, faces[area > 1e-12]


def merge_meshes(vert_list, face_list, weld_tol=1e-9):
    """Concatenate meshes, weld coincident vertices, drop duplicate faces."""
    V = np.vstack(vert_list)
    offs = np.cumsum([0] + [len(v) for v in vert_list[:-1]])
    F = np.vstack([f + o for f, o in zip(face_list, offs)]).astype(np.int64)
    # weld: round to tolerance grid, group bit-identical (or near-identical)
    key = np.round(V / weld_tol).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    # Build the welded vertex array: V_welded[inv[i]] == V[i].
    # Duplicates overwrite each other with (near-)identical coordinates.
    V_welded = np.empty((int(inv.max()) + 1, 3), dtype=np.float64)
    V_welded[inv] = V
    V, F = V_welded, inv[F]
    # drop duplicate faces (sorted vertex tuples) and degenerate
    srt = np.sort(F, axis=1)
    _, uidx = np.unique(srt, axis=0, return_index=True)
    F = F[np.sort(uidx)]
    keep = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    F = F[keep]
    # compact vertex array
    used = np.unique(F)
    remap = np.full(len(V), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return V[used], remap[F]


# ============================ Stage A: skirts ============================

def boundary_loops(V, F):
    """Return ordered boundary loops as lists of vertex indices."""
    nv = len(V)
    e = np.sort(F, axis=1)
    edges = np.vstack([e[:, [0, 1]], e[:, [1, 2]], e[:, [0, 2]]])
    edges = np.sort(edges, axis=1)
    keys = edges[:, 0] * (nv + 1) + edges[:, 1]
    ukeys, counts = np.unique(keys, return_counts=True)
    bnd = ukeys[counts == 1]
    b0 = (bnd // (nv + 1)).astype(np.int64)
    b1 = (bnd % (nv + 1)).astype(np.int64)
    nbrs = {}
    for a, b in zip(b0, b1):
        nbrs.setdefault(int(a), set()).add(int(b))
        nbrs.setdefault(int(b), set()).add(int(a))
    used = set()
    loops = []
    for start in list(nbrs.keys()):
        if all(((min(start, w), max(start, w)) in used) for w in nbrs[start]):
            continue
        loop, cur, prev = [start], start, None
        while True:
            nxt = None
            for w in nbrs[cur]:
                ek = (min(cur, w), max(cur, w))
                if ek not in used and w != prev:
                    nxt, nek = w, ek
                    break
            if nxt is None:
                break
            used.add(nek)
            prev, cur = cur, nxt
            if cur == start:
                break
            loop.append(cur)
            if len(loop) > len(nbrs) + 2:  # safety
                break
        if len(loop) >= 3:
            loops.append(loop)
    return loops


def orient_faces_outward(V, F, interior):
    """Flip faces whose normal points toward the interior point."""
    T = V[F]
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    c = T.mean(axis=1)
    flip = ((n * (interior - c)).sum(axis=1)) > 0
    F2 = F.copy()
    F2[flip] = F2[flip][:, [0, 2, 1]]
    return F2


def add_skirts(V, F, z_bottom):
    """Extrude boundary loops down to z_bottom and cap the bottom.

    Returns (V2, F2). The result should be watertight for a heightfield mesh.
    """
    loops = boundary_loops(V, F)
    log.info(f"boundary loops found: {len(loops)} "
             f"(sizes {[len(l) for l in loops]})")
    if not loops:
        log.warning("no boundary loops; mesh may already be closed")
        return V, F
    if len(loops) > 1:
        log.warning(f"{len(loops)} boundary loops; capping each "
                    f"(assumes heightfield domain)")

    V2 = [V]
    F2 = [F]
    interior = np.array([V[:, 0].mean(), V[:, 1].mean(),
                         0.5 * (V[:, 2].min() + V[:, 2].max())])
    for loop in loops:
        m = len(loop)
        base = sum(len(v) for v in V2)
        # bottom duplicates
        bot = V[loop].copy()
        bot[:, 2] = z_bottom
        V2.append(bot)
        skirt = []
        for k in range(m):
            a = loop[k]
            b = loop[(k + 1) % m]
            a2 = base + k
            b2 = base + (k + 1) % m
            skirt.append([a, b, b2])
            skirt.append([a, b2, a2])
        skirt = np.array(skirt, dtype=np.int64)
        skirt = orient_faces_outward(np.vstack(V2), skirt, interior)
        F2.append(skirt)
        # bottom cap: centroid fan
        cidx = sum(len(v) for v in V2)
        centroid = bot.mean(axis=0, keepdims=True)
        V2.append(centroid)
        cap = []
        for k in range(m):
            cap.append([cidx, base + k, base + (k + 1) % m])
        cap = np.array(cap, dtype=np.int64)
        cap = orient_faces_outward(np.vstack(V2), cap, interior)
        F2.append(cap)
    return np.vstack(V2), np.vstack(F2).astype(np.int64)


# ============================ Stage B: tiling ============================

def tile_origins(start, total, tile_n, overlap):
    """Tile start positions (node indices) covering [start, start+total).

    Each tile holds tile_n nodes spanning (tile_n - 1) cells. Adjacent tiles
    must share exactly one node plane (step = tile_n - 1) so marching-cubes
    vertices on the shared face coincide bit-identically (analytic SDF).
    `overlap` adds extra shared planes; coincident faces are deduped on merge.
    """
    step = tile_n - 1 - overlap
    if step <= 0:
        raise ValueError("overlap must be < tile_n - 1")
    pos = list(range(start, start + total - tile_n + 1, step))
    last = start + total - tile_n
    if not pos or pos[-1] != last:
        pos.append(last)
    return pos


def run_tiling(wx, wy, W, H, tile_n, overlap, px, h):
    """Mesh each tile; merge with coincident-face dedupe. Returns (V, F).

    Crack-free guarantee: each tile keeps only triangles whose centroid lies
    in its owned half-open cell range. Adjacent tiles therefore never both
    triangulate the shared face -- exactly one tile owns it -- so there is no
    marching-cubes face-ambiguity mismatch at seams. The merged mesh equals
    what a single global marching-cubes run would produce (identical cells,
    identical SDF values).
    """
    xs = tile_origins(wx, W, tile_n, overlap)
    ys = tile_origins(wy, H, tile_n, overlap)
    log.info(f"tiling {len(xs)}x{len(ys)} = {len(xs)*len(ys)} tiles "
             f"(n={tile_n}, overlap={overlap})")
    # z-range from the full region sampler (cheap: sample corners+center)
    gx = np.linspace(0, W - 1, 9) * 1.0
    gy = np.linspace(0, H - 1, 9) * 1.0
    XX, YY = np.meshgrid(gx, gy, indexing="ij")
    hs = h((wx + XX) * px, (wy + YY) * px)
    Z0 = float(hs.min()) - 5.0
    Z1 = float(hs.max()) + 5.0
    dz = (Z1 - Z0) / (tile_n - 1)
    vl, fl, counts, kept_counts = [], [], [], []
    for j, ty in enumerate(ys):
        for i, tx in enumerate(xs):
            v, f = mesh_tile(h, tx, ty, tile_n, px, Z0, dz)
            if len(f):
                # Ownership by generating CELL (half-open ranges partition the
                # domain). A non-degenerate MC triangle's centroid lies
                # strictly inside its generating cell, so cell index =
                # floor(centroid/px) assigns each triangle to exactly one tile.
                # The shared face between tiles is therefore triangulated only
                # by the left/bottom tile -- no MC face-ambiguity mismatch.
                c = v[f].mean(axis=1)
                ci = np.floor(c[:, 0] / px - 1e-9).astype(np.int64)
                cj = np.floor(c[:, 1] / px - 1e-9).astype(np.int64)
                cx_hi = xs[i + 1] if i + 1 < len(xs) else tx + tile_n - 1
                cy_hi = ys[j + 1] if j + 1 < len(ys) else ty + tile_n - 1
                keep = ((ci >= tx) & (ci < cx_hi) &
                        (cj >= ty) & (cj < cy_hi))
                f = f[keep]
                kept_counts.append(int(keep.sum()))
            counts.append(len(f))
            if len(f):
                vl.append(v)
                fl.append(f)
        log.info(f"  row {j+1}/{len(ys)} done")
    log.info(f"per-tile triangles after ownership clip: min {min(kept_counts)} "
             f"max {max(kept_counts)} total {sum(kept_counts)}")
    V, F = merge_meshes(vl, fl)
    log.info(f"merged: {len(V)} verts, {len(F)} faces "
             f"(deduped {sum(kept_counts) - len(F)} coincident faces)")
    return V, F, Z0, Z1, px


# ============================ Stage C: validation ============================

def validate_heights(V, h, px):
    """Compare mesh vertex z to the bilinear DEM sampler. Returns stats."""
    z_dem = h(V[:, 0], V[:, 1])
    err = V[:, 2] - z_dem
    ae = np.abs(err)
    stats = {
        "n_vertices": int(len(V)),
        "rmse_m": float(np.sqrt((err ** 2).mean())),
        "mae_m": float(ae.mean()),
        "max_abs_m": float(ae.max()),
        "mean_m": float(err.mean()),
        "p50_m": float(np.percentile(ae, 50)),
        "p95_m": float(np.percentile(ae, 95)),
        "p99_m": float(np.percentile(ae, 99)),
        "p999_m": float(np.percentile(ae, 99.9)),
        "gt_1m_frac": float((ae > 1.0).mean()),
    }
    return stats, err


# ============================ CLI ============================

def cmd_skirts(args):
    dem_m, px, h = dem_window_for_region(args.wx, args.wy, args.n, args.n)
    N = args.n
    Z0 = float(dem_m.min()) - 5.0
    Z1 = float(dem_m.max()) + 5.0
    dz = (Z1 - Z0) / (N - 1)
    log.info(f"meshing single window n={N}")
    v, f = mesh_tile(h, args.wx, args.wy, N, px, Z0, dz)
    log.info(f"raw mesh: {len(v)} verts, {len(f)} tris")
    V2, F2 = add_skirts(v, f, Z0)
    import trimesh
    mesh = trimesh.Trimesh(vertices=V2, faces=F2, process=False)
    mesh.merge_vertices()
    log.info(f"solid: {len(mesh.vertices)} verts, {len(mesh.faces)} faces, "
             f"watertight={mesh.is_watertight}")
    out = os.path.join(args.out, "transvoxel-solid.glb")
    mesh.export(out)
    log.info(f"exported {out} ({os.path.getsize(out)/1e6:.1f} MB)")
    return {"watertight": bool(mesh.is_watertight),
            "verts": int(len(mesh.vertices)), "faces": int(len(mesh.faces)),
            "out": out}


def cmd_tile(args):
    dem_m, px, h = dem_window_for_region(args.wx, args.wy, args.W, args.H)
    log.info(f"DEM region {args.W}x{args.H}, px={px:.2f} m, "
             f"h {dem_m.min():.1f}..{dem_m.max():.1f} m")
    V, F, Z0, Z1, px = run_tiling(args.wx, args.wy, args.W, args.H,
                                  args.tile_n, args.overlap, px, h)
    import trimesh
    mesh = trimesh.Trimesh(vertices=V, faces=F, process=False)
    mesh.merge_vertices()
    out = os.path.join(args.out, "transvoxel-tiled.glb")
    mesh.export(out)
    log.info(f"exported {out} ({os.path.getsize(out)/1e6:.1f} MB)")
    return {"verts": int(len(mesh.vertices)), "faces": int(len(mesh.faces)),
            "z0": Z0, "z1": Z1, "out": out,
            "mesh_path": out, "V": V, "F": F}


def cmd_validate(args, V=None, h=None, px=None):
    import trimesh
    if V is None:
        mesh = trimesh.load(args.mesh, force="mesh")
        V = np.asarray(mesh.vertices)
        # need sampler for the region
        _, px, h = dem_window_for_region(args.wx, args.wy, args.W, args.H)
    stats, _ = validate_heights(V, h, px)
    log.info("height-error validation (mesh z vs bilinear DEM sampler):")
    for k, v_ in stats.items():
        log.info(f"  {k}: {v_:.4f}" if isinstance(v_, float) else f"  {k}: {v_}")
    out = os.path.join(args.out, "height-error-validation.json")
    with open(out, "w") as fh:
        json.dump(stats, fh, indent=2)
    log.info(f"wrote {out}")
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["skirts", "tile", "validate", "all"],
                    default="all")
    ap.add_argument("--wx", type=int, default=1024)
    ap.add_argument("--wy", type=int, default=1024)
    ap.add_argument("--n", type=int, default=64,
                    help="window size for --mode skirts")
    ap.add_argument("--W", type=int, default=128)
    ap.add_argument("--H", type=int, default=128)
    ap.add_argument("--tile_n", type=int, default=64)
    ap.add_argument("--overlap", type=int, default=0)
    ap.add_argument("--mesh", default=None,
                    help="input mesh for --mode validate")
    ap.add_argument("--out", default="/tmp/transvoxel-complete")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    report = {}
    if args.mode in ("skirts", "all"):
        # In --all mode the skirts apply to the tiled mesh; run tile first.
        if args.mode == "all":
            tiled = cmd_tile(args)
            V, F = tiled["V"], tiled["F"]
            Z0 = tiled["z0"]
            V2, F2 = add_skirts(V, F, Z0)
            import trimesh
            mesh = trimesh.Trimesh(vertices=V2, faces=F2, process=False)
            mesh.merge_vertices()
            log.info(f"solid: {len(mesh.vertices)} verts, "
                     f"{len(mesh.faces)} faces, "
                     f"watertight={mesh.is_watertight}")
            out = os.path.join(args.out, "transvoxel-tiled-solid.glb")
            mesh.export(out)
            log.info(f"exported {out} ({os.path.getsize(out)/1e6:.1f} MB)")
            report["solid"] = {"watertight": bool(mesh.is_watertight),
                               "verts": int(len(mesh.vertices)),
                               "faces": int(len(mesh.faces)), "out": out}
            report["tiled"] = {k: tiled[k] for k in
                               ("verts", "faces", "z0", "z1", "out")}
            # validate the solid's top surface: use pre-skirt verts
            _, px, h = dem_window_for_region(args.wx, args.wy,
                                             args.W, args.H)
            report["validation"] = cmd_validate(args, V=V, h=h, px=px)
        else:
            report["solid"] = cmd_skirts(args)
    elif args.mode == "tile":
        tiled = cmd_tile(args)
        report["tiled"] = {k: tiled[k] for k in
                           ("verts", "faces", "z0", "z1", "out")}
    elif args.mode == "validate":
        if args.mesh is None:
            log.error("--mesh required for --mode validate")
            sys.exit(2)
        report["validation"] = cmd_validate(args)

    with open(os.path.join(args.out, "complete-report.json"), "w") as fh:
        json.dump(report, fh, indent=2, default=str)
    log.info("done")


if __name__ == "__main__":
    main()
