#!/usr/bin/env python3
"""DEM-to-SDF and balanced-octree helpers plus a table-driven Transvoxel CLI.

The importable helpers are intentionally usable without a local DEM. Raster
loading is opt-in and fails closed when CRS, vertical units, NoData, or window
bounds are not established. Set TSM_DEM_PATH and, when source metadata does
not declare them, TSM_DEM_HORIZONTAL_CRS / TSM_DEM_VERTICAL_UNIT explicitly.
Vertical units accepted: m, ft, us-ft. Coordinates are returned in metres.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any, Callable, Iterable

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[1]
DEM_PATH = os.environ.get("TSM_DEM_PATH", str(ROOT_DIR / "data" / "posey-county" / "dem.tif"))
# Compatibility constant: load_dem_window normalizes source elevations to metres.
FT_TO_M = 1.0
VERTICAL_UNIT_TO_METERS = {"m": 1.0, "meter": 1.0, "meters": 1.0, "metre": 1.0, "metres": 1.0,
                           "ft": 0.3048, "foot": 0.3048, "feet": 0.3048,
                           "us-ft": 1200.0 / 3937.0, "us survey foot": 1200.0 / 3937.0}


def _vertical_unit(dataset: Any) -> tuple[str, float]:
    override = os.environ.get("TSM_DEM_VERTICAL_UNIT")
    tags = {str(k).lower(): str(v).strip().lower() for k, v in dataset.tags().items()}
    unit = override.strip().lower() if override else ""
    if not unit:
        for key in ("vertical_units", "z_units", "elevation_units", "unit"):
            if tags.get(key):
                unit = tags[key]
                break
    aliases = {"metres": "m", "meters": "m", "meter": "m", "metre": "m",
               "feet": "ft", "foot": "ft", "us survey foot": "us-ft", "us survey feet": "us-ft"}
    unit = aliases.get(unit, unit)
    if unit not in VERTICAL_UNIT_TO_METERS:
        raise ValueError("DEM vertical units are not declared by metadata; set TSM_DEM_VERTICAL_UNIT=m|ft|us-ft only after verifying source documentation")
    return unit, VERTICAL_UNIT_TO_METERS[unit]


def load_dem_window(path: str | os.PathLike[str], wx: int, wy: int, n: int, height: int | None = None) -> tuple[np.ndarray, float]:
    """Read a bounded n×n raster window; return elevations in metres and pixel size in metres.

    Geographic-degree rasters are rejected because a single scalar pixel size
    is not a valid metric spacing for the mesher. Missing values are not filled.
    """
    height = n if height is None else height
    if any(isinstance(v, bool) or not isinstance(v, int) for v in (wx, wy, n, height)):
        raise TypeError("wx, wy, width, and height must be integers")
    if wx < 0 or wy < 0 or n < 2 or height < 2 or n > 8192 or height > 8192:
        raise ValueError("window origin must be nonnegative and width/height must be in 2..8192")
    try:
        import rasterio
        from rasterio.windows import Window
    except ImportError as exc:
        raise RuntimeError("rasterio is required for DEM loading; install rasterio in the geospatial environment") from exc
    raster_path = Path(path).expanduser()
    if not raster_path.is_file():
        raise FileNotFoundError(f"DEM not found at {raster_path}; set TSM_DEM_PATH to a verified raster")
    with rasterio.open(raster_path) as src:
        if src.count < 1 or src.crs is None:
            raise ValueError("DEM must contain a band and a declared horizontal CRS")
        override_crs = os.environ.get("TSM_DEM_HORIZONTAL_CRS")
        if override_crs and str(src.crs) != override_crs and src.crs.to_string() != override_crs:
            raise ValueError(f"TSM_DEM_HORIZONTAL_CRS={override_crs!r} conflicts with raster CRS {src.crs}")
        if src.crs.is_geographic:
            raise ValueError("DEM uses angular coordinates; reproject to a suitable projected CRS before metric meshing")
        if wx + n > src.width or wy + height > src.height:
            raise ValueError(f"requested window x={wx} y={wy} width={n} height={height} exceeds raster bounds {src.width}×{src.height}")
        unit, scale = _vertical_unit(src)
        pixel_x = abs(float(src.transform.a))
        pixel_y = abs(float(src.transform.e))
        if not math.isfinite(pixel_x) or not math.isfinite(pixel_y) or pixel_x <= 0 or pixel_y <= 0:
            raise ValueError("DEM pixel transform is invalid")
        # Rasterio exposes the projected linear-unit conversion as a CRS property.
        # Convert the raster's native horizontal units to metres without assuming feet.
        if abs(float(src.transform.b)) > 1e-12 or abs(float(src.transform.d)) > 1e-12:
            raise ValueError("rotated/sheared DEM transforms are unsupported by this mesher")
        try:
            unit_info = src.crs.linear_units_factor
            horizontal_factor = float(unit_info[1])
        except (AttributeError, TypeError, ValueError, IndexError) as exc:
            raise ValueError("DEM CRS has no usable projected linear-unit conversion factor") from exc
        if not math.isfinite(horizontal_factor) or horizontal_factor <= 0:
            raise ValueError("DEM CRS has an invalid horizontal unit conversion factor")
        px_m = pixel_x * horizontal_factor
        if not math.isclose(pixel_x, pixel_y, rel_tol=1e-6):
            raise ValueError("non-square DEM pixels are unsupported by this mesher")
        data = src.read(1, window=Window(wx, wy, n, height), masked=True).astype(np.float64)
        if data.shape != (height, n):
            raise ValueError(f"raster returned unexpected window shape {data.shape}")
        mask = np.ma.getmaskarray(data)
        values = np.asarray(data.filled(np.nan), dtype=np.float64) * scale
        if mask.any() or not np.isfinite(values).all():
            raise ValueError("DEM window contains NoData or non-finite elevation values; do not silently fill terrain")
    # Preserve the source raster's affine origin in the caller's pixel indexing;
    # px_m is the metric grid spacing required by existing consumers.
    return values, px_m


def make_height_sampler(dem_m: np.ndarray, px: float) -> Callable[[Any, Any], Any]:
    """Create a vectorized bilinear sampler over a finite metre-valued DEM array."""
    data = np.asarray(dem_m, dtype=np.float64)
    if data.ndim != 2 or min(data.shape) < 2 or not np.isfinite(data).all():
        raise ValueError("DEM must be a finite 2D array with both dimensions >= 2")
    if not math.isfinite(px) or px <= 0:
        raise ValueError("pixel spacing must be positive and finite")
    ny, nx = data.shape

    def sample(x: Any, y: Any) -> Any:
        xa, ya = np.broadcast_arrays(np.asarray(x, dtype=np.float64), np.asarray(y, dtype=np.float64))
        gx, gy = xa / px, ya / px
        if not np.isfinite(gx).all() or not np.isfinite(gy).all():
            raise ValueError("sample coordinates must be finite")
        if (gx < 0).any() or (gx > nx - 1).any() or (gy < 0).any() or (gy > ny - 1).any():
            raise ValueError("sample coordinate lies outside DEM window; no extrapolation is performed")
        x0 = np.minimum(np.floor(gx).astype(np.int64), nx - 2)
        y0 = np.minimum(np.floor(gy).astype(np.int64), ny - 2)
        fx, fy = gx - x0, gy - y0
        result = (data[y0, x0] * (1 - fx) * (1 - fy)
                  + data[y0, x0 + 1] * fx * (1 - fy)
                  + data[y0 + 1, x0] * (1 - fx) * fy
                  + data[y0 + 1, x0 + 1] * fx * fy)
        return float(result) if np.ndim(x) == 0 and np.ndim(y) == 0 else result
    return sample


def build_sdf_grid(h: Callable[[Any, Any], Any], n: int, px: float, z0m: float, dz: float) -> np.ndarray:
    if isinstance(n, bool) or not isinstance(n, int) or n < 2 or n > 2048:
        raise ValueError("n must be an integer in 2..2048")
    if not all(math.isfinite(v) for v in (px, z0m, dz)) or px <= 0 or dz <= 0:
        raise ValueError("px and dz must be positive finite values and z0m finite")
    ii, jj = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    heights = np.asarray(h(ii * px, jj * px), dtype=np.float64)
    if heights.shape != (n, n) or not np.isfinite(heights).all():
        raise ValueError("height sampler returned an invalid/non-finite grid")
    z = z0m + np.arange(n, dtype=np.float64) * dz
    return (z[None, None, :] - heights[:, :, None]).astype(np.float32)


class Node:
    __slots__ = ("i0", "j0", "k0", "n", "level", "children", "parent")

    def __init__(self, i0: int, j0: int, k0: int, n: int, level: int, parent: "Node | None" = None):
        self.i0, self.j0, self.k0, self.n, self.level = i0, j0, k0, n, level
        self.children: list[Node] | None = None
        self.parent = parent

    def is_leaf(self) -> bool:
        return self.children is None


def _crosses_zero(sdf: np.ndarray, node: Node) -> bool:
    sub = sdf[node.i0:node.i0 + node.n + 1, node.j0:node.j0 + node.n + 1, node.k0:node.k0 + node.n + 1]
    return sub.size > 0 and float(np.nanmin(sub)) <= 0 <= float(np.nanmax(sub))


def build_octree(sdf: np.ndarray, max_level_fn: Callable[[Node], int]) -> Node:
    grid = np.asarray(sdf)
    if grid.ndim != 3 or len(set(grid.shape)) != 1 or grid.shape[0] < 2 or not np.isfinite(grid).all():
        raise ValueError("SDF must be a finite cubic 3D array")
    cells = grid.shape[0]
    if cells & (cells - 1):
        raise ValueError("SDF grid dimension must be a power of two (for example 32 or 64)")
    root = Node(0, 0, 0, cells, 0)

    def split(node: Node) -> None:
        target = max_level_fn(node)
        if isinstance(target, bool) or not isinstance(target, int) or target < node.level:
            raise ValueError("max_level_fn must return an integer >= current node level")
        if node.level >= target or node.n < 2 or not _crosses_zero(grid, node):
            return
        half = node.n // 2
        if half < 1:
            return
        node.children = [
            Node(node.i0 + di * half, node.j0 + dj * half, node.k0 + dk * half, half, node.level + 1, node)
            for di in (0, 1) for dj in (0, 1) for dk in (0, 1)
        ]
        for child in node.children:
            split(child)
    split(root)
    return root


def get_leaves(root: Node) -> list[Node]:
    out: list[Node] = []
    stack = [root]
    while stack:
        node = stack.pop()
        if node.is_leaf():
            out.append(node)
        else:
            stack.extend(reversed(node.children or []))
    return out


def leaf_at(root: Node, i: int, j: int, k: int) -> Node | None:
    if any(isinstance(v, bool) or not isinstance(v, int) for v in (i, j, k)):
        raise TypeError("voxel coordinates must be integers")
    if min(i, j, k) < 0 or max(i, j, k) >= root.n:
        return None
    node = root
    while node.children:
        child = next((c for c in node.children if c.i0 <= i < c.i0 + c.n and c.j0 <= j < c.j0 + c.n and c.k0 <= k < c.k0 + c.n), None)
        if child is None:
            return None
        node = child
    return node


def _face_adjacent(a: Node, b: Node) -> tuple[int, int] | None:
    for axis, (a0, b0, an, bn) in enumerate(((a.i0, b.i0, a.n, b.n), (a.j0, b.j0, a.n, b.n), (a.k0, b.k0, a.n, b.n))):
        if a0 + an == b0 or b0 + bn == a0:
            other = [idx for idx in range(3) if idx != axis]
            a_origin = (a.i0, a.j0, a.k0); b_origin = (b.i0, b.j0, b.k0)
            if all(max(a_origin[q], b_origin[q]) < min(a_origin[q] + a.n, b_origin[q] + b.n) for q in other):
                return axis, 1 if a0 + an == b0 else -1
    return None


def balance_octree(root: Node) -> Node:
    """Refine coarse face-neighbors until the octree is 2:1 balanced."""
    max_cells = root.n
    while True:
        leaves = get_leaves(root)
        split_ids: set[int] = set()
        for i, a in enumerate(leaves):
            for b in leaves[i + 1:]:
                if _face_adjacent(a, b) and abs(a.level - b.level) > 1:
                    split_ids.add(id(a if a.level < b.level else b))
        if not split_ids:
            return root
        for node in leaves:
            if id(node) in split_ids and node.is_leaf() and node.n >= 2:
                half = node.n // 2
                node.children = [Node(node.i0 + di * half, node.j0 + dj * half, node.k0 + dk * half, half, node.level + 1, node)
                                 for di in (0, 1) for dj in (0, 1) for dk in (0, 1)]
        if len(get_leaves(root)) > 2_000_000 or max_cells < 2:
            raise RuntimeError("octree balance exceeded the safety limit")


def face_neighbor_max_level(root: Node, leaf: Node, face: str) -> int:
    """Return the maximum level of any leaf sharing this face, or -1 at the domain boundary."""
    axes = {"+x": (0, 1), "-x": (0, -1), "+y": (1, 1), "-y": (1, -1), "+z": (2, 1), "-z": (2, -1)}
    if face not in axes:
        raise ValueError("unknown face {!r}; expected one of {}".format(face, tuple(axes)))
    axis, direction = axes[face]
    levels = []
    for other in get_leaves(root):
        if other is leaf:
            continue
        adjacent = _face_adjacent(leaf, other)
        if adjacent == (axis, direction):
            levels.append(other.level)
    return max(levels, default=-1)


def _finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("{} must be a finite number".format(label))
    return float(value)


def _polygonize(cell: dict[str, Any]) -> dict[str, Any]:
    from transvoxel_transition_mesh import mesh_transition_cell
    origin_raw, samples_raw, axis = cell.get("origin"), cell.get("samples"), cell.get("axis")
    extent = _finite_number(cell.get("extent"), "extent")
    direction = cell.get("direction", 1)
    if not isinstance(origin_raw, list) or len(origin_raw) != 3:
        raise ValueError("cell.origin must contain xyz")
    origin = tuple(_finite_number(v, "origin[{}]".format(i)) for i, v in enumerate(origin_raw))
    if isinstance(axis, bool) or not isinstance(axis, int) or axis not in (0, 1, 2):
        raise ValueError("cell.axis must be 0, 1, or 2")
    if isinstance(direction, bool) or not isinstance(direction, int) or direction not in (-1, 1):
        raise ValueError("cell.direction must be -1 or 1")
    if extent <= 0:
        raise ValueError("cell.extent must be positive and finite")
    if not isinstance(samples_raw, list) or len(samples_raw) != 9:
        raise ValueError("cell.samples must contain exactly 9 fine-side scalar samples")
    samples = [_finite_number(v, "samples[{}]".format(i)) for i, v in enumerate(samples_raw)]
    def sdf(x: float, y: float, z: float) -> float:
        p = (x, y, z); a, b = (axis + 1) % 3, (axis + 2) % 3
        u = min(1.0, max(0.0, (p[a] - origin[a]) / extent))
        v = min(1.0, max(0.0, (p[b] - origin[b]) / extent))
        return samples[min(2, round(v * 2)) * 3 + min(2, round(u * 2))]
    vertices, triangles, metadata = mesh_transition_cell(sdf, origin, axis, extent, direction=direction)
    return {"case": metadata.get("case"), "classId": metadata.get("class_id"),
            "invertWinding": metadata.get("invert", False),
            "vertices": [list(v) for v in vertices], "triangles": [list(t) for t in triangles],
            "vertexCount": len(vertices), "triangleCount": len(triangles)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        from transvoxel_transition_mesh import self_test
        self_test()
        return 0
    if args.input is None:
        parser.error("--input is required unless --self-test is used")
    raw = args.input.read_bytes()
    payload = json.loads(raw)
    cells = payload.get("cells") if isinstance(payload, dict) else None
    if not isinstance(cells, list) or not cells:
        parser.error("input JSON must contain a non-empty cells array")
    result = {"schemaVersion": "1.0.0", "algorithm": "Transvoxel transition-cell tables (Lengyel MIT)",
              "inputSha256": hashlib.sha256(raw).hexdigest(), "cells": [_polygonize(cell) for cell in cells]}
    encoded = json.dumps(result, sort_keys=True, separators=(",", ":")) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
