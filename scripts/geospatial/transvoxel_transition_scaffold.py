#!/usr/bin/env python3
"""Transvoxel transition-cell scaffold (R4).

Full Lengyel 73-class tables are NOT embedded. Emits 2:1 face stitch strips
and status=SCAFFOLD_NOT_TRANSVOXEL_COMPLETE.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence, Tuple

Vec3 = Tuple[float, float, float]
Tri = Tuple[int, int, int]


@dataclass(frozen=True)
class LodFace:
    axis: int
    coarse_level: int
    fine_level: int
    origin: Vec3
    extent: float


@dataclass
class StitchResult:
    vertices: List[Vec3]
    triangles: List[Tri]
    status: str = "SCAFFOLD_NOT_TRANSVOXEL_COMPLETE"


def stitch_quad_face_2to1(face: LodFace) -> StitchResult:
    if face.fine_level != face.coarse_level + 1:
        raise ValueError("only 2:1 level steps supported in scaffold")
    if face.axis not in (0, 1, 2):
        raise ValueError("axis must be 0,1,2")

    o = face.origin
    e = face.extent
    u = (face.axis + 1) % 3
    v = (face.axis + 2) % 3

    def corner(su: float, sv: float) -> Vec3:
        p = [o[0], o[1], o[2]]
        p[u] = o[u] + su * e
        p[v] = o[v] + sv * e
        return (p[0], p[1], p[2])

    grid = [[corner(i * 0.5, j * 0.5) for i in range(3)] for j in range(3)]
    verts: List[Vec3] = []
    index = {}
    for j in range(3):
        for i in range(3):
            index[(i, j)] = len(verts)
            verts.append(grid[j][i])

    tris: List[Tri] = []
    for j in range(2):
        for i in range(2):
            a = index[(i, j)]
            b = index[(i + 1, j)]
            c = index[(i, j + 1)]
            d = index[(i + 1, j + 1)]
            tris.append((a, b, d))
            tris.append((a, d, c))

    return StitchResult(vertices=verts, triangles=tris)


def detect_2to1_faces(
    leaves: Sequence[Tuple[int, Vec3, float]],
) -> List[LodFace]:
    faces: List[LodFace] = []
    for i, (li, oi, ei) in enumerate(leaves):
        for j, (lj, oj, ej) in enumerate(leaves):
            if i >= j:
                continue
            if abs(li - lj) != 1:
                continue
            coarse_l, fine_l = (li, lj) if li < lj else (lj, li)
            co, ce = (oi, ei) if li < lj else (oj, ej)
            fo, fe = (oj, ej) if li < lj else (oi, ei)
            for axis in range(3):
                if abs((co[axis] + ce) - fo[axis]) < 1e-6 * max(ce, fe) or abs(
                    (fo[axis] + fe) - co[axis]
                ) < 1e-6 * max(ce, fe):
                    faces.append(
                        LodFace(
                            axis=axis,
                            coarse_level=coarse_l,
                            fine_level=fine_l,
                            origin=co,
                            extent=ce,
                        )
                    )
                    break
    return faces


if __name__ == "__main__":
    face = LodFace(axis=1, coarse_level=0, fine_level=1, origin=(0.0, 0.0, 0.0), extent=10.0)
    r = stitch_quad_face_2to1(face)
    assert len(r.vertices) == 9 and len(r.triangles) == 8
    print("transvoxel_transition_scaffold OK", r.status)
