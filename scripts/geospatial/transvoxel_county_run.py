#!/usr/bin/env python3
"""County-scale Transvoxel mesh-emission run from real neighboring terrain tiles.

Drives the canonical Lengyel transition-cell mesher (transvoxel_transition_mesh,
coarse-corner mapping [0,2,6,8] verified against Lengyel's official Transvoxel.cpp)
over a declared AOI built from real USGS 3DEP 1 m DEM tiles. The AOI is chunked;
each chunk is meshed independently (own windowed tile reads, own sampler) and
seam/crack checks run both within chunks and ACROSS chunk boundaries, including
the boundaries that coincide with real tile edges.

Scope model (honest): this emits transition-face meshes (the benchmark's
"bounded real-DEM transition face" model from benchmark-real-dem-transvoxel.py),
tiled across the AOI in a chunk grid -- it is not a full adaptive-octree terrain
extraction of the county. The report states exactly what fraction of the county
the AOI represents and projects full-county cost from measured per-cell numbers.

Resilient, never fail-closed: nodata / out-of-extent / unsupported-CRS tiles are
skipped and counted, never silently zero-filled and never aborting the run.

Usage:
  python3 transvoxel_county_run.py --tiles a.tif b.tif c.tif d.tif \
      --outdir docs/validation/transvoxel-county-run [--max-chunks N]

Outputs (in outdir):
  run-report-2026-10-23.json   machine-readable report (schemaVersion 1.0.0)
  sample-chunk-mesh.json        small representative mesh sample (one chunk)
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import resource
import sys
import time
from pathlib import Path
from typing import Any, Optional

import numpy as np
import rasterio
from rasterio.windows import Window

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from transvoxel_transition_mesh import mesh_transition_cell  # noqa: E402

# --- reuse the benchmark's seam methodology (same rounding/tolerance) ---
_spec = importlib.util.spec_from_file_location(
    "tv_benchmark", str(HERE / "benchmark-real-dem-transvoxel.py")
)
_tv_benchmark = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_tv_benchmark)
_seam_intersection_key = _tv_benchmark._seam_intersection_key
_stable_sdf_sample = _tv_benchmark._stable_sdf_sample

CELL_METERS = 20.0
CHUNK_CELLS = 125          # 125 x 20 m = 2.5 km per chunk side
AOI_INSET_METERS = 6.0     # inset inside the tile union so chunks tile exactly
MARGIN_CELLS = 1           # 1-cell (20 m) sampler margin per chunk side
SEAM_TOLERANCE_METERS = 0.02
SCHEMA_VERSION = "1.0.0"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _rss_bytes() -> int:
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if sys.platform == "darwin" else value * 1024)


class TileSet:
    """Real input tiles with per-tile provenance; unsupported tiles are skipped."""

    def __init__(self, paths: list[Path]):
        self.records: list[dict[str, Any]] = []
        self.skipped: list[dict[str, Any]] = []
        crs0: Optional[str] = None
        for path in paths:
            try:
                src = rasterio.open(path)
            except Exception as exc:  # resilient: record, do not abort
                self.skipped.append({"path": path.name, "reason": f"open failed: {exc}"})
                continue
            rec = {
                "path": path.name,
                "sha256": sha256_file(path),
                "bytes": path.stat().st_size,
                "crs": str(src.crs),
                "width": src.width,
                "height": src.height,
                "bounds": [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top],
                "transform": [src.transform.a, src.transform.b, src.transform.c,
                              src.transform.d, src.transform.e, src.transform.f],
                "nodata": src.nodata,
                "dtype": str(src.dtypes[0]),
                "_src": src,
            }
            if crs0 is None:
                crs0 = rec["crs"]
            if rec["crs"] != crs0:
                self.skipped.append({"path": path.name,
                                     "reason": f"CRS {rec['crs']} != run CRS {crs0}; skipped, not reprojected silently"})
                src.close()
                continue
            self.records.append(rec)
        if not self.records:
            raise RuntimeError("no usable input tiles; cannot run on empty input")
        self.crs = crs0

    def union_bounds(self) -> tuple[float, float, float, float]:
        left = min(r["bounds"][0] for r in self.records)
        bottom = min(r["bounds"][1] for r in self.records)
        right = max(r["bounds"][2] for r in self.records)
        top = max(r["bounds"][3] for r in self.records)
        return (left, bottom, right, top)

    def read_window_meters(self, xmin: float, ymin: float, xmax: float, ymax: float) -> tuple[np.ndarray, bool]:
        """Read 1 m source pixels over a meter bbox from whichever tiles cover it.

        Fixed tile priority (input order) resolves the ~12 m tile overlaps.
        Regions outside every tile come back NaN and are counted, never filled.
        Returns (array[rows, cols] float32 with NaN for missing, had_missing).
        """
        out_w = int(round(xmax - xmin))
        out_h = int(round(ymax - ymin))
        out = np.full((out_h, out_w), np.nan, dtype=np.float32)
        had_missing = False
        for rec in self.records:
            src = rec["_src"]
            b = rec["bounds"]
            ix0, iy0 = max(xmin, b[0]), max(ymin, b[1])
            ix1, iy1 = min(xmax, b[2]), min(ymax, b[3])
            if ix1 <= ix0 or iy1 <= iy0:
                continue
            # source pixels are 1 m, north-up: row = top - y
            col0 = int(round(ix0 - b[0]))
            col1 = int(round(ix1 - b[0]))
            row1 = int(round(b[3] - iy0))  # bottom edge -> larger row
            row0 = int(round(b[3] - iy1))
            col0, col1 = max(col0, 0), min(col1, src.width)
            row0, row1 = max(row0, 0), min(row1, src.height)
            if col1 <= col0 or row1 <= row0:
                continue
            block = src.read(1, window=Window(col0, row0, col1 - col0, row1 - row0)).astype(np.float32)
            nodata = rec["nodata"]
            if nodata is not None:
                block[block == nodata] = np.nan
            block[~np.isfinite(block)] = np.nan
            # destination slice in output array (row 0 = ymax at top)
            dcol0 = int(round(ix0 - xmin))
            drow0 = int(round(ymax - iy1))
            # only fill where still NaN (fixed priority: first tile wins overlaps)
            dest = out[drow0:drow0 + (row1 - row0), dcol0:dcol0 + (col1 - col0)]
            mask = np.isnan(dest)
            dest[mask] = block[mask]
        had_missing = bool(np.isnan(out).any())
        return out, had_missing


def block_mean_to_grid(src1m: np.ndarray, cells: int, margin: int) -> np.ndarray:
    """Block-average 1 m pixels to the global 20 m lattice; NaN-aware (NaN only if all-NaN).

    Two-pass nanmean keeps peak temporaries small (no full-res boolean mask)."""
    h, w = src1m.shape
    assert h == (cells + 2 * margin) * 20 and w == (cells + 2 * margin) * 20, (src1m.shape, cells)
    n = cells + 2 * margin
    with np.errstate(invalid="ignore"):
        # pass 1: mean over x within each 20 m row-band -> (n, n*20)
        t = np.nanmean(src1m.reshape(n, 20, n * 20), axis=1)
        # pass 2: mean over y within each 20 m column-band -> (n, n)
        grid = np.nanmean(t.reshape(n, n, 20), axis=2)
    return np.asarray(grid, dtype=np.float64)


def run_county(tiles: list[Path], outdir: Path, max_chunks: Optional[int]) -> dict[str, Any]:
    t_start = time.perf_counter()
    tileset = TileSet(tiles)
    union = tileset.union_bounds()
    # AOI: union inset so the extent is an exact multiple of the chunk size
    ax0 = union[0] + AOI_INSET_METERS
    ay0 = union[1] + AOI_INSET_METERS
    ax1 = union[2] - AOI_INSET_METERS
    ay1 = union[3] - AOI_INSET_METERS
    aoi_w = ax1 - ax0
    aoi_h = ay1 - ay0
    cells_x = int(round(aoi_w / CELL_METERS))
    cells_y = int(round(aoi_h / CELL_METERS))
    nchunk_x = cells_x // CHUNK_CELLS
    nchunk_y = cells_y // CHUNK_CELLS
    # trim AOI to exact chunk tiling
    ax1 = ax0 + nchunk_x * CHUNK_CELLS * CELL_METERS
    ay1 = ay0 + nchunk_y * CHUNK_CELLS * CELL_METERS
    cells_x, cells_y = nchunk_x * CHUNK_CELLS, nchunk_y * CHUNK_CELLS
    aoi_area_km2 = (ax1 - ax0) * (ay1 - ay0) / 1e6

    tile_edge_x = sorted({round(b) for r in tileset.records for b in (r["bounds"][0], r["bounds"][2])})
    tile_edge_y = sorted({round(b) for r in tileset.records for b in (r["bounds"][1], r["bounds"][3])})

    digest = hashlib.sha256()
    chunk_reports: list[dict[str, Any]] = []
    class_hist: dict[str, int] = {}
    totals = {"tested": 0, "meshed": 0, "skipped_nodata": 0, "verts": 0, "tris": 0}
    seam_within_checked = seam_within_mismatch = 0
    seam_cross_checked = seam_cross_mismatch = 0
    seam_one_sided = 0  # mismatches where one side emitted no seam points (nodata edge)
    seam_two_sided = 0  # mismatches where both sides emitted seam points (true cracks)
    seam_mismatch_examples: list[dict[str, Any]] = []
    max_crack_m = 0.0
    # per x-column: (previous chunk's north-edge seam keys, its skipped-cell count)
    prev_north: dict[int, tuple[dict[int, tuple[str, ...]], int]] = {}
    sample_chunk: Optional[dict[str, Any]] = None

    # Pass 1: build each chunk's 20 m grid (kept in memory; ~8 MB for 64 chunks)
    # and take the GLOBAL z-range, so every chunk meshes identical z-cells and
    # cross-chunk seam checks compare like-for-like cells (per-chunk z-ranges
    # would make boundary z-cells one-sided by construction).
    chunk_grids: dict[tuple[int, int], tuple[np.ndarray, float, float, float, float, float]] = {}
    gzmin, gzmax = math.inf, -math.inf
    pass1_index = 0
    for ci in range(nchunk_x):
        for cj in range(nchunk_y):
            if max_chunks is not None and pass1_index >= max_chunks:
                break
            pass1_index += 1
            cx0 = ax0 + ci * CHUNK_CELLS * CELL_METERS
            cy0 = ay0 + cj * CHUNK_CELLS * CELL_METERS
            # source window at 1 m with margin, in meters
            wx0 = cx0 - MARGIN_CELLS * CELL_METERS
            wy0 = cy0 - MARGIN_CELLS * CELL_METERS
            wx1 = cx0 + (CHUNK_CELLS + MARGIN_CELLS) * CELL_METERS
            wy1 = cy0 + (CHUNK_CELLS + MARGIN_CELLS) * CELL_METERS
            # clamp to tile union; outside -> NaN (counted, never fabricated)
            rx0, ry0 = max(wx0, union[0]), max(wy0, union[1])
            rx1, ry1 = min(wx1, union[2]), min(wy1, union[3])
            src1m_full = np.full(
                (int(round(wy1 - wy0)), int(round(wx1 - wx0))), np.nan, dtype=np.float32)
            block, _ = tileset.read_window_meters(rx0, ry0, rx1, ry1)
            dcol0 = int(round(rx0 - wx0))
            drow0 = int(round(wy1 - ry1))
            src1m_full[drow0:drow0 + block.shape[0], dcol0:dcol0 + block.shape[1]] = block
            grid = block_mean_to_grid(src1m_full, CHUNK_CELLS, MARGIN_CELLS)
            # grid index: row 0 = wy1 (top/north); col 0 = wx0 (west)
            finite = np.isfinite(grid)
            if not finite.any():
                continue
            zmin_c = math.floor(float(np.nanmin(grid)) / CELL_METERS) * CELL_METERS - CELL_METERS
            zmax_c = math.ceil(float(np.nanmax(grid)) / CELL_METERS) * CELL_METERS + CELL_METERS
            gzmin, gzmax = min(gzmin, zmin_c), max(gzmax, zmax_c)
            chunk_grids[(ci, cj)] = (grid, wx0, wy1, cx0, cy0,
                                     float(np.count_nonzero(finite) / finite.size))
        if max_chunks is not None and pass1_index >= max_chunks:
            break
    if not chunk_grids:
        raise RuntimeError("no chunk with valid data; cannot run on empty input")
    zmin, zmax = gzmin, gzmax
    z_cells = max(1, int(math.ceil((zmax - zmin) / CELL_METERS)))

    # Pass 2: mesh each chunk's west-edge transition face; seam checks within/across chunks.
    chunk_index = 0
    for ci in range(nchunk_x):
        for cj in range(nchunk_y):
            if max_chunks is not None and chunk_index >= max_chunks:
                break
            chunk_index += 1
            if (ci, cj) not in chunk_grids:
                chunk_reports.append({"chunk": [ci, cj], "status": "NO_VALID_DATA",
                                      "tested": 0, "meshed": 0, "skipped_nodata": 0})
                prev_north.pop(ci, None)  # cannot stitch across a data gap; do not compare
                continue
            grid, wx0, wy1, cx0, cy0, valid_frac = chunk_grids[(ci, cj)]
            del chunk_grids[(ci, cj)]  # free as we go; peak stays bounded
            height_at = make_height_at(grid, wx0, wy1)
            # west-edge transition face of this chunk: x fixed at cx0
            x_face = cx0
            tested = meshed = skipped = 0
            chunk_verts: list[tuple[float, float, float]] = []
            chunk_tris: list[tuple[int, int, int]] = []
            # rolling column meshes for within-chunk y-seams; edge columns kept for cross-chunk
            south_edge: dict[int, tuple[list, list]] = {}
            north_edge: dict[int, tuple[list, list]] = {}
            prev_col: Optional[dict[int, tuple[list, list]]] = None
            prev_col_skipped = 0
            south_skipped = 0
            north_skipped = 0
            col_skipped: dict[int, int] = {}
            for j in range(CHUNK_CELLS):
                y_cell = cy0 + j * CELL_METERS
                col_mesh: dict[int, tuple[list, list]] = {}
                j_skipped = 0
                for k in range(z_cells):
                    z_cell = zmin + k * CELL_METERS

                    def sdf(x: float, y: float, z: float) -> float:
                        return _stable_sdf_sample(z, height_at(x, y))

                    tested += 1
                    try:
                        vertices, triangles, metadata = mesh_transition_cell(
                            sdf, (x_face, y_cell, z_cell), axis=0,
                            extent=CELL_METERS, direction=1)
                    except ValueError as error:
                        if "NoData" in str(error) or "extent" in str(error):
                            skipped += 1
                            j_skipped += 1
                            continue
                        raise
                    vertices = [tuple(float(v) for v in p) for p in vertices]
                    triangles = [tuple(int(v) for v in t) for t in triangles]
                    if not vertices and not triangles:
                        continue
                    if not vertices or not triangles:
                        raise AssertionError(f"case {metadata.get('case')} emitted incomplete geometry")
                    if any(not math.isfinite(v) for p in vertices for v in p):
                        raise AssertionError("mesher emitted a non-finite vertex")
                    if any(min(t) < 0 or max(t) >= len(vertices) for t in triangles):
                        raise AssertionError("mesher emitted an invalid triangle index")
                    meshed += 1
                    case_id = metadata.get("case")
                    if case_id is not None:
                        key = str(case_id)
                        class_hist[key] = class_hist.get(key, 0) + 1
                    col_mesh[k] = (vertices, triangles)
                    base = len(chunk_verts)
                    chunk_verts.extend(vertices)
                    chunk_tris.extend(tuple(base + i for i in t) for t in triangles)
                # within-chunk z-seams for this column (mirrors the benchmark's z check)
                for k in range(z_cells - 1):
                    lower_v, lower_t = col_mesh.get(k, ([], []))
                    upper_v, upper_t = col_mesh.get(k + 1, ([], []))
                    if lower_v or upper_v:
                        z_boundary = zmin + (k + 1) * CELL_METERS
                        seam_within_checked += 1
                        lk = _seam_intersection_key(lower_v, lower_t, 2, z_boundary)
                        rk = _seam_intersection_key(upper_v, upper_t, 2, z_boundary)
                        if lk != rk:
                            seam_within_mismatch += 1
                            one_sided = (not lk) != (not rk)
                            crack = _crack_width(lk, rk) if not one_sided else None
                            if crack is not None:
                                max_crack_m = max(max_crack_m, crack)
                                seam_two_sided += 1
                            else:
                                seam_one_sided += 1
                            if len(seam_mismatch_examples) < 10:
                                seam_mismatch_examples.append({
                                    "scope": "within-chunk", "chunk": [ci, cj],
                                    "axis": "z", "boundary": z_boundary,
                                    "leftPoints": len(lk), "rightPoints": len(rk),
                                    "oneSided": one_sided,
                                    "adjacentToNoData": j_skipped > 0,
                                    "crackMeters": crack})
                # within-chunk y-seam vs previous column
                if prev_col is not None:
                    y_boundary = cy0 + j * CELL_METERS
                    for k in set(prev_col) | set(col_mesh):
                        lv, lt = prev_col.get(k, ([], []))
                        rv, rt = col_mesh.get(k, ([], []))
                        if lv or rv:
                            seam_within_checked += 1
                            lk = _seam_intersection_key(lv, lt, 1, y_boundary)
                            rk = _seam_intersection_key(rv, rt, 1, y_boundary)
                            if lk != rk:
                                seam_within_mismatch += 1
                                adjacent_nodata = (prev_col_skipped > 0) or (j_skipped > 0)
                                one_sided = (not lk) != (not rk)
                                crack = _crack_width(lk, rk) if not one_sided else None
                                if crack is not None:
                                    max_crack_m = max(max_crack_m, crack)
                                    seam_two_sided += 1
                                else:
                                    seam_one_sided += 1
                                if len(seam_mismatch_examples) < 10:
                                    seam_mismatch_examples.append({
                                        "scope": "within-chunk", "chunk": [ci, cj],
                                        "axis": "y", "boundary": y_boundary,
                                        "leftPoints": len(lk), "rightPoints": len(rk),
                                        "oneSided": one_sided,
                                        "adjacentToNoData": adjacent_nodata,
                                        "crackMeters": crack})
                prev_col = col_mesh
                prev_col_skipped = j_skipped
                col_skipped[j] = j_skipped
                if j == 0:
                    south_edge = col_mesh
                    south_skipped = j_skipped
                if j == CHUNK_CELLS - 1:
                    north_edge = col_mesh
                    north_skipped = j_skipped
            # cross-chunk y-seam: this chunk's south edge vs previous chunk's north edge
            if ci in prev_north:
                y_boundary = cy0  # == prev chunk's north edge plane
                prev_keys, prev_north_skipped = prev_north[ci]
                for k in set(prev_keys) | set(south_edge):
                    sv, st = south_edge.get(k, ([], []))
                    nk = prev_keys.get(k, ())
                    sk = _seam_intersection_key(sv, st, 1, y_boundary)
                    if sv or nk:
                        seam_cross_checked += 1
                        on_tile_edge = any(abs(y_boundary - e) < CELL_METERS for e in tile_edge_y)
                        if sk != nk:
                            seam_cross_mismatch += 1
                            adjacent_nodata = (south_skipped > 0) or (prev_north_skipped > 0)
                            one_sided = (not sk) != (not nk)
                            crack = _crack_width(sk, nk) if not one_sided else None
                            if crack is not None:
                                max_crack_m = max(max_crack_m, crack)
                                seam_two_sided += 1
                            else:
                                seam_one_sided += 1
                            if len(seam_mismatch_examples) < 10:
                                seam_mismatch_examples.append({
                                    "scope": "cross-chunk", "chunks": [[ci, cj - 1], [ci, cj]],
                                    "axis": "y", "boundary": y_boundary,
                                    "leftPoints": len(sk), "rightPoints": len(nk),
                                    "oneSided": one_sided,
                                    "adjacentToNoData": adjacent_nodata,
                                    "onTileEdge": on_tile_edge, "crackMeters": crack})
            prev_north[ci] = (
                {k: _seam_intersection_key(v, t, 1, cy0 + CHUNK_CELLS * CELL_METERS)
                 for k, (v, t) in north_edge.items()},
                north_skipped)

            payload = json.dumps(
                {"chunk": [ci, cj], "verts": chunk_verts, "tris": chunk_tris},
                separators=(",", ":"), allow_nan=False).encode()
            digest.update(payload)
            totals["tested"] += tested
            totals["meshed"] += meshed
            totals["skipped_nodata"] += skipped
            totals["verts"] += len(chunk_verts)
            totals["tris"] += len(chunk_tris)
            c_elapsed = time.perf_counter() - t_start
            print(f"chunk ({ci},{cj}) tested={tested} meshed={meshed} skipped={skipped} "
                  f"verts={len(chunk_verts)} tris={len(chunk_tris)} "
                  f"elapsed={c_elapsed:.1f}s rss={_rss_bytes()/1e6:.0f}MB", flush=True)
            chunk_reports.append({
                "chunk": [ci, cj],
                "boundsMeters": [cx0, cy0, cx0 + CHUNK_CELLS * CELL_METERS, cy0 + CHUNK_CELLS * CELL_METERS],
                "zCells": z_cells, "zRangeMeters": [zmin, zmax],
                "zRangeNote": "global AOI z-range shared by all chunks for like-for-like seam checks",
                "validGridFraction": valid_frac,
                "tested": tested, "meshed": meshed, "skippedNoData": skipped,
                "vertices": len(chunk_verts), "triangles": len(chunk_tris),
            })
            if sample_chunk is None and chunk_verts:
                sample_chunk = {"chunk": [ci, cj], "vertices": chunk_verts[:5000],
                                "triangles": [t for t in chunk_tris if max(t) < 5000][:5000],
                                "note": "truncated sample for inspection; full mesh hashed, not stored"}
        if max_chunks is not None and chunk_index >= max_chunks:
            break

    elapsed = time.perf_counter() - t_start
    cells_per_sec = totals["tested"] / elapsed if elapsed > 0 else 0.0
    # Full-county PROJECTION (Posey County, IN ~1087 km^2). Two views, both labeled:
    # (a) strip model: the transition-face strips actually meshed, scaled by area;
    # (b) full-column model: every 20 m (x,y) column of the county meshed across its
    #     z-range -- the production-scale interpretation of "mesh emission at AOI scale".
    posey_km2 = 1087.0
    strip_cells = totals["tested"] * (posey_km2 / aoi_area_km2) if aoi_area_km2 else 0.0
    strip_seconds = strip_cells / cells_per_sec if cells_per_sec else float("inf")
    county_columns = posey_km2 * 1e6 / (CELL_METERS * CELL_METERS)
    mean_z_cells = float(z_cells)  # global z-range shared by all chunks in this run
    column_cells = county_columns * mean_z_cells
    column_seconds = column_cells / cells_per_sec if cells_per_sec else float("inf")

    report = {
        "schemaVersion": SCHEMA_VERSION,
        "evidenceStatus": "REAL_DEM_TRANSVOXEL_COUNTY_RUN",
        "runScope": ("multi-tile transition-face mesh emission over a declared sub-county AOI; "
                     "not a full adaptive-octree terrain extraction of the county"),
        "runDateUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "inputs": {
            "tiles": [{k: r[k] for k in ("path", "sha256", "bytes", "crs", "width", "height",
                                                     "bounds", "nodata", "dtype")} for r in tileset.records],
            "skippedTiles": tileset.skipped,
            "tileUnionMeters": list(union),
            "tileLayout": "2x2 neighboring USGS 3DEP 1 m LiDAR tiles (2017 Indiana statewide); "
                          "12 m overlaps resolved by fixed input-order priority",
            "tileEdgeX": tile_edge_x, "tileEdgeY": tile_edge_y,
        },
        "aoi": {
            "crs": tileset.crs,
            "boundsMeters": [ax0, ay0, ax1, ay1],
            "areaKm2": aoi_area_km2,
            "fractionOfPoseyCounty": aoi_area_km2 / posey_km2,
            "cellMeters": CELL_METERS,
            "chunkCells": CHUNK_CELLS,
            "chunkGrid": [nchunk_x, nchunk_y],
            "chunksRun": chunk_index,
            "aoiInsetMeters": AOI_INSET_METERS,
            "verticalUnits": "meters (source DEM meters; NAVD88 per 3DEP 1 m spec, not re-certified here)",
        },
        "mesh": {
            "transitionCellsTested": totals["tested"],
            "transitionCellsMeshed": totals["meshed"],
            "cellsSkippedNoData": totals["skipped_nodata"],
            "vertexCount": totals["verts"],
            "triangleCount": totals["tris"],
            "meshSha256": digest.hexdigest(),
            "transitionCaseHistogram": class_hist,
            "seamToleranceMeters": SEAM_TOLERANCE_METERS,
            "seamsWithinChunk": {"checked": seam_within_checked, "mismatches": seam_within_mismatch},
            "seamsCrossChunk": {"checked": seam_cross_checked, "mismatches": seam_cross_mismatch},
            "seamMismatchesOneSidedNoDataEdge": seam_one_sided,
            "seamMismatchesTwoSidedTrueCrack": seam_two_sided,
            "maxCrackMeters": max_crack_m,
            "maxCrackNote": ("max over two-sided mismatches only, at 2 cm seam-key quantization; "
                             "one-sided nodata-edge mismatches carry crackMeters=null"),
            "seamMismatchExamples": seam_mismatch_examples,
            "chunkReports": chunk_reports,
        },
        "performance": {
            "wallTimeSeconds": elapsed,
            "processPeakRssBytes": _rss_bytes(),
            "transitionCellsPerSecond": cells_per_sec,
            "hardware": "VM: 2 vCPU, 7.7 GiB RAM, no GPU; concurrent sibling workload present",
            "measurement": "actual Python process wall time and ru_maxrss on this VM",
        },
        "fullCountyProjection": {
            "basis": "PROJECTION from measured end-to-end per-cell rate; not a measured county run",
            "poseyCountyKm2": posey_km2,
            "measuredCellsPerSecond": cells_per_sec,
            "stripModel": {
                "projectedTransitionCells": strip_cells,
                "projectedWallSeconds": strip_seconds,
                "projectedWallHours": strip_seconds / 3600 if math.isfinite(strip_seconds) else None,
                "note": "Same transition-face strip model as measured, scaled by county/AOI area.",
            },
            "fullColumnModel": {
                "countyColumns20m": county_columns,
                "meanZCellsPerColumn": mean_z_cells,
                "projectedTransitionCells": column_cells,
                "projectedWallSeconds": column_seconds,
                "projectedWallHours": column_seconds / 3600 if math.isfinite(column_seconds) else None,
                "note": ("Production-scale interpretation: every 20 m column of the county meshed "
                         "across its z-range. Uses the measured blended cell rate (empty + surface "
                         "cells); a real adaptive octree would change constant factors. Treat as "
                         "order-of-magnitude planning arithmetic, not a commitment."),
            },
        },
        "limitations": [
            "AOI is a ~400 km^2 sub-county tile union, not all of Posey County (~37%).",
            "Emits transition-face meshes per chunk (benchmark model), not a full adaptive-octree terrain mesh.",
            "Seam checks cover y-boundaries within and across chunks (the stitched faces), not all six orientations.",
            "Vertical datum/accuracy per 3DEP 1 m product spec; not re-certified by this run.",
            "12 m tile overlaps resolved by fixed input-order priority; overlap disagreement between tiles is not separately measured.",
        ],
    }
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "run-report-2026-10-23.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if sample_chunk is not None:
        (outdir / "sample-chunk-mesh.json").write_text(
            json.dumps(sample_chunk, separators=(",", ":")) + "\n", encoding="utf-8")
    return report


def make_height_at(g: np.ndarray, ox: float, oy_top: float):
    """Bilinear height sampler over a chunk's 20 m grid, aligned to the global lattice.

    Mirrors benchmark-real-dem-transvoxel.py: ulp snapping so shared cell
    boundaries sample identical rows/columns deterministically across chunks."""
    n = g.shape[0]

    def height_at(x: float, y: float) -> float:
        fx = (x - ox) / CELL_METERS
        fy = (oy_top - y) / CELL_METERS

        def snap_index(v: float) -> tuple[int, float]:
            nearest = round(v)
            if abs(v - nearest) <= 1e-6:
                # Exactly on a lattice line: address the cell below/left
                # (index nearest-1, fraction 1.0). Bilinear value is identical
                # to the (nearest, nearest+1) addressing, but this keeps the
                # chunk's south/west margin row addressable instead of raising
                # "left the chunk grid extent" at chunk-boundary planes.
                return nearest - 1, 1.0
            base = math.floor(v)
            return base, v - base

        c0, dx = snap_index(fx)
        r0, dy = snap_index(fy)
        if r0 < 0 or c0 < 0 or r0 + 1 >= n or c0 + 1 >= n:
            raise ValueError("SDF query left the chunk grid extent")
        blk = g[r0:r0 + 2, c0:c0 + 2]
        if not np.isfinite(blk).all():
            raise ValueError("SDF query intersects NoData; no synthetic elevation is permitted")
        return float(
            blk[0, 0] * (1 - dx) * (1 - dy) + blk[0, 1] * dx * (1 - dy)
            + blk[1, 0] * (1 - dx) * dy + blk[1, 1] * dx * dy)

    return height_at


def _crack_width(left_keys: tuple[str, ...], right_keys: tuple[str, ...]) -> float:
    """Max Euclidean distance between non-matching seam point sets (meters).

    Called only for two-sided mismatches (both sides emitted seam points), at the
    2 cm seam-key quantization. Returns 0.0 when a side is empty (one-sided case);
    callers record those separately with crackMeters=null."""
    def pts(keys):
        return [tuple(float(v) for v in k.split(",")) for k in keys]
    lp, rp = pts(left_keys), pts(right_keys)
    if not lp or not rp:
        return 0.0
    best = 0.0
    for a in lp:
        d = min(math.dist(a, b) for b in rp)
        best = max(best, d)
    for b in rp:
        d = min(math.dist(b, a) for a in lp)
        best = max(best, d)
    return best


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tiles", nargs="+", type=Path, required=True)
    parser.add_argument("--outdir", type=Path, required=True)
    parser.add_argument("--max-chunks", type=int, default=None)
    args = parser.parse_args()
    report = run_county(args.tiles, args.outdir, args.max_chunks)
    print(json.dumps({
        "tested": report["mesh"]["transitionCellsTested"],
        "meshed": report["mesh"]["transitionCellsMeshed"],
        "skippedNoData": report["mesh"]["cellsSkippedNoData"],
        "verts": report["mesh"]["vertexCount"],
        "tris": report["mesh"]["triangleCount"],
        "seamsWithin": report["mesh"]["seamsWithinChunk"],
        "seamsCross": report["mesh"]["seamsCrossChunk"],
        "oneSided": report["mesh"]["seamMismatchesOneSidedNoDataEdge"],
        "twoSided": report["mesh"]["seamMismatchesTwoSidedTrueCrack"],
        "maxCrackMeters": report["mesh"]["maxCrackMeters"],
        "wallSeconds": report["performance"]["wallTimeSeconds"],
        "peakRssMB": report["performance"]["processPeakRssBytes"] / 1e6,
        "cellsPerSecond": report["performance"]["transitionCellsPerSecond"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
