#!/usr/bin/env python3
"""Per-leaf adaptive Transvoxel meshing using official Lengyel tables.

Loads transitionCellData[56] + transitionVertexData[512] from local JSON,
or regenerates from EricLengyel/Transvoxel (MIT) if missing/incomplete.

  python3 transvoxel_transition_mesh.py --self-test
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Callable, List, Optional, Tuple

import numpy as np

from transvoxel_tables import compute_case_index, get_transition_class

Vec3 = Tuple[float, float, float]
SdfFn = Callable[[float, float, float], float]

_DATA: Optional[dict] = None


def _ensure_tables(here: Path) -> None:
    """Regenerate Lengyel JSON tables if vertex chunks are missing or incomplete."""
    need = False
    for i in range(4):
        p = here / f"lengyel_vertex_{i}.json"
        if not p.is_file():
            need = True
            break
        try:
            rows = json.loads(p.read_text(encoding="utf-8"))
            if not isinstance(rows, list) or len(rows) != 128:
                need = True
                break
            if any(not isinstance(r, list) or len(r) != 12 for r in rows):
                need = True
                break
        except Exception:
            need = True
            break
    cell = here / "lengyel_cell_data.json"
    if not cell.is_file():
        need = True
    if not need:
        return
    regen = here / "regenerate_lengyel_tables.py"
    if not regen.is_file():
        raise FileNotFoundError(f"missing tables and regenerator at {here}")
    subprocess.check_call([sys.executable, str(regen)], cwd=str(here))


def _load_data() -> dict:
    global _DATA
    if _DATA is not None:
        return _DATA
    here = Path(__file__).resolve().parent
    _ensure_tables(here)
    full = here / "lengyel_transition_data.json"
    if full.is_file():
        try:
            data = json.loads(full.read_text(encoding="utf-8"))
            if len(data.get("transitionVertexData", [])) == 512:
                _DATA = data
                return _DATA
        except Exception:
            pass
    cell = json.loads((here / "lengyel_cell_data.json").read_text(encoding="utf-8"))
    verts: list = []
    for i in range(4):
        verts.extend(json.loads((here / f"lengyel_vertex_{i}.json").read_text(encoding="utf-8")))
    _DATA = {"transitionCellData": cell["transitionCellData"], "transitionVertexData": verts}
    assert len(_DATA["transitionCellData"]) == 56
    assert len(_DATA["transitionVertexData"]) == 512
    return _DATA


def _edge_endpoints(code: int) -> Tuple[int, int]:
    low = code & 0xFF
    return low & 0x0F, (low >> 4) & 0x0F


def _corner_uv(i: int) -> Tuple[float, float]:
    """Spatial endpoint IDs are row-major; case bits use a separate official permutation."""
    mapping = {
        0: (0.0, 0.0), 1: (0.5, 0.0), 2: (1.0, 0.0),
        3: (0.0, 0.5), 4: (0.5, 0.5), 5: (1.0, 0.5),
        6: (0.0, 1.0), 7: (0.5, 1.0), 8: (1.0, 1.0),
        9: (0.0, 0.0), 10: (1.0, 0.0),
        11: (0.0, 1.0), 12: (1.0, 1.0),
    }
    if i not in mapping:
        raise ValueError(f"transition vertex endpoint must be 0..12, got {i}")
    return mapping[i]

def face_point(origin: Vec3, axis: int, extent: float, u: float, v: float) -> Vec3:
    p = [origin[0], origin[1], origin[2]]
    a = (axis + 1) % 3
    b = (axis + 2) % 3
    p[a] = origin[a] + u * extent
    p[b] = origin[b] + v * extent
    return (p[0], p[1], p[2])


def sample_face_sdfs(sdf: SdfFn, origin: Vec3, axis: int, extent: float) -> List[float]:
    out = []
    for i in range(9):
        u, v = _corner_uv(i)
        x, y, z = face_point(origin, axis, extent, u, v)
        out.append(float(sdf(x, y, z)))
    return out


def _transition_point(origin: Vec3, axis: int, extent: float, endpoint: int, direction: int = 1) -> Vec3:
    u, v = _corner_uv(endpoint)
    point = list(face_point(origin, axis, extent, u, v))
    if endpoint >= 9:
        point[axis] = origin[axis] + direction * extent
    return (point[0], point[1], point[2])


def _transition_endpoint_sample_index(endpoint: int) -> int:
    """Map table endpoint IDs to the nine independent scalar samples."""
    if 0 <= endpoint < 9:
        return endpoint
    if 9 <= endpoint < 13:
        return (0, 2, 6, 8)[endpoint - 9]
    raise ValueError(f"transition vertex endpoint must be 0..12, got {endpoint}")


def interpolate_edge(sdf, origin, axis, extent, i0, i1, iso=0.0, direction=1, fine_samples=None) -> Vec3:
    p0 = _transition_point(origin, axis, extent, i0, direction)
    p1 = _transition_point(origin, axis, extent, i1, direction)
    samples = fine_samples if fine_samples is not None else sample_face_sdfs(sdf, origin, axis, extent)
    if len(samples) != 9:
        raise ValueError(f"transition interpolation requires 9 independent scalar samples, got {len(samples)}")
    s0 = float(samples[_transition_endpoint_sample_index(i0)]) - iso
    s1 = float(samples[_transition_endpoint_sample_index(i1)]) - iso
    denominator = s0 - s1
    t = 0.5 if abs(denominator) < 1e-12 else float(np.clip(s0 / denominator, 0.0, 1.0))
    return (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t)

def mesh_transition_cell(sdf, origin, axis, extent, iso=0.0, direction=1):
    data = _load_data()
    # Scalar samples are row-major. compute_case_index applies the official case-bit permutation.
    # Coarse-face corners duplicate row-major corner samples 0, 2, 6, and 8.
    samples = sample_face_sdfs(sdf, origin, axis, extent)
    case = compute_case_index(samples, iso)
    if case is None:
        return [], [], {"case": None, "class_id": None}
    class_id, invert = get_transition_class(case)
    cell = data["transitionCellData"][class_id]
    counts = cell["geometryCounts"]
    vindex = cell["vertexIndex"]
    vcount = (counts >> 4) & 0x0F
    tcount = counts & 0x0F
    codes = data["transitionVertexData"][case]
    cell_verts = []
    for slot in range(12):
        code = codes[slot]
        if code == 0xFFFF:
            break
        i0, i1 = _edge_endpoints(code)
        cell_verts.append(interpolate_edge(sdf, origin, axis, extent, i0, i1, iso, direction, fine_samples=samples))
    if len(cell_verts) < vcount:
        raise ValueError(f"case {case} needs {vcount} vertices but table supplied {len(cell_verts)}")
    cell_verts = cell_verts[:vcount]
    tris = []
    for t in range(tcount):
        base = t * 3
        if base + 2 >= len(vindex):
            break
        a, b, c = vindex[base], vindex[base + 1], vindex[base + 2]
        if max(a, b, c) >= len(cell_verts):
            continue
        tris.append((a, c, b) if invert else (a, b, c))
    meta = {"case": case, "class_id": class_id, "invert": invert, "vertexCount": len(cell_verts), "triangleCount": len(tris)}
    return cell_verts, tris, meta


def mesh_transition_face_grid(sdf, origin, axis, extent, fine_res=2, iso=0.0, direction=1):
    all_v, all_t, metas = [], [], []
    cell_e = extent / fine_res
    a, b = (axis + 1) % 3, (axis + 2) % 3
    for j in range(fine_res):
        for i in range(fine_res):
            o = [origin[0], origin[1], origin[2]]
            o[a] = origin[a] + i * cell_e
            o[b] = origin[b] + j * cell_e
            verts, tris, meta = mesh_transition_cell(sdf, tuple(o), axis, cell_e, iso, direction)
            base = len(all_v)
            all_v.extend(verts)
            all_t.extend((base + t[0], base + t[1], base + t[2]) for t in tris)
            metas.append(meta)
    if not all_v:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int32), metas
    return np.asarray(all_v, dtype=np.float64), np.asarray(all_t, dtype=np.int32), metas


def self_test() -> None:
    _load_data()
    tested = 0
    # Exhaust all 512 fine-side masks on all six signed face orientations.
    # The nine samples are ordered by the official table endpoint IDs; coarse corners reuse fine endpoint values 0, 2, 6, and 4.
    for axis in range(3):
        a, b = (axis + 1) % 3, (axis + 2) % 3
        for direction in (-1, 1):
            for mask in range(512):
                fine_case_bit_for_sample = (0, 1, 2, 7, 8, 3, 6, 5, 4)
        values = [-1.0 if (mask & (1 << case_bit_for_sample[i])) else 1.0 for i in range(9)]

                def case_sdf(x, y, z, fine=fine_values, cell_axis=axis, face_direction=direction):
                    point = (x, y, z)
                    u = min(2, max(0, int(round(point[a] * 2))))
                    v = min(2, max(0, int(round(point[b] * 2))))
                    return fine[v * 3 + u]

                verts, tris, meta = mesh_transition_cell(
                    case_sdf, (0.0, 0.0, 0.0), axis=axis, extent=1.0, direction=direction
                )
                expected = None if mask in (0, 511) else mask
                if meta["case"] != expected:
                    raise AssertionError(
                        f"axis {axis} direction {direction} case {mask}: got {meta['case']}, expected {expected}"
                    )
                if any(index < 0 or index >= len(verts) for tri in tris for index in tri):
                    raise AssertionError(f"axis {axis} direction {direction} case {mask}: invalid triangle index")
                if any(not np.isfinite(component) for vertex in verts for component in vertex):
                    raise AssertionError(f"axis {axis} direction {direction} case {mask}: non-finite vertex")
                tested += 1

    def sdf2(x, y, z):
        return (x + y + z) / 3.0 - 0.5

    verts, tris, meta = mesh_transition_cell(sdf2, (0.0, 0.0, 0.0), axis=2, extent=1.0)
    V, T, metas = mesh_transition_face_grid(sdf2, (0.0, 0.0, 0.0), axis=2, extent=2.0, fine_res=2)
    print("self-test meta", meta, "V", len(verts), "T", len(tris))
    print("grid V", len(V), "T", len(T), "cells", len(metas))
    print(f"TRANSVOXEL_EXHAUSTIVE_CASES: PASS ({tested}/3072 signed-orientation cases)")
    print("PER_LEAF_ADAPTIVE: PASS")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()
    if args.self_test:
        self_test()
        return 0
    p.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
