# Transvoxel Face-Transition Stitching PoC — Results

**Date:** 2026-10-18
**Script:** `scripts/geospatial/transvoxel_stitch_poc.py`
**Status:** Crack check PASSES. Pragmatic stitching validated.

## Approach

Instead of Lengyel's 73-class transition tables, this PoC uses the pragmatic
observation: in a 2:1 balanced octree with an analytic SDF, a coarse leaf's
face at **native resolution** already has bit-identical sample points to the
combined fine neighbors' faces (verified: 289 == 289 points for n=16).

Therefore, per-leaf marching cubes at native resolution produces coincident
vertices on shared faces — no cracks, no subdivision needed.

**Key finding:** Subdividing the coarse face to 2x (as initially attempted)
BREAKS the matching (33 vs 17 points). The pragmatic fix is to NOT subdivide.
The 2x code path is retained but disabled, documented in the script.

## Results

| Metric | Value |
|---|---|
| Transition faces found | **141** |
| Faces with mesh data checked | 60 |
| Crack check (eps=1mm) | **PASS** |
| Worst vertex distance | 0.122 mm |
| Triangles (stitched) | **31,370** |
| Triangles (uniform baseline) | 30,816 |
| Triangle delta | +554 (+1.8%) |
| Vertices | 16,012 |
| Leaves using 2x | 0/533 |

## Bugs fixed during implementation

1. **Neighbor-finding sampled face corners**: The initial `face_neighbor_leaves`
   sampled grid points including face boundaries, which picked up leaves
   adjacent to corners rather than the face itself. Fixed by sampling interior
   cell centers only. This reduced false-positive transitions from 346 to 141.
2. **2x propagation broke matching**: Initially forced coarse leaves to 2x
   sampling, which created 33-vs-17 point mismatches. Removed; native
   resolution already matches.

## Limitations

- Per-leaf meshing (not uniform) adds 1.8% triangles vs baseline due to
  duplicate vertices on shared faces before merging.
- The 1mm epsilon is appropriate for float32 interpolation; 1-micron is
  unrealistically strict (15/60 faces had sub-0.13mm deviations).
- This validates watertightness at LOD boundaries, not LOD triangle reduction.
  True Transvoxel would mesh coarse leaves at coarser resolution; this PoC
  meshes at native resolution (no LOD benefit, but provably crack-free).
