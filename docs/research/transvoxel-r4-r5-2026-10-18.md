# Transvoxel Algorithm & TSM R4/R5 Research Note (2026-10-18)

## Transvoxel algorithm (Lengyel)

**Problem.** Adaptive octree / LOD voxel terrains produce **T-junction cracks** when adjacent cells differ by one LOD level: a coarse face edge has no matching vertices on the fine neighbor.

**Core idea (Eric Lengyel, Transvoxel):**

1. Represent terrain as a **signed distance field** sampled on a regular grid (or octree leaves).
2. Extract isosurface with a **modified Marching Cubes** on uniform cells.
3. At **LOD boundaries**, replace ordinary MC cells with **transition cells**:
   - A transition cell sits on the face between a coarse cell and a fine cell (typically 2× resolution).
   - Vertices along the shared face are forced to match the **fine** sampling where needed.
   - Lengyel enumerates **73 equivalence classes** / large case tables (often cited with 512-case expansions for full marching configurations) so the triangulation on the coarse side is **subdivided consistently** with the fine side.
4. Result: **watertight** mesh across LOD seams without stitching strips as a post-pass.

**Relation to Marching Cubes.** Classic MC uses 15 base cases (+ reflections/rotations) on a single resolution. Transvoxel adds **transition-cell topology** so edge vertices align across resolution changes.

**TSM status (honest).**

| Stage | Status |
|-------|--------|
| DEM → heightfield SDF `f=z-h(x,y)` | Implemented (`dem_to_transvoxel.py`) |
| Balanced octree (neighbor level Δ ≤ 1) | Implemented (structure) |
| Uniform MC isosurface + GLB | Implemented |
| 73-class / transition-cell tables | **Not shipped** (R4 gap) |
| Per-leaf adaptive meshing | Documented next step |

**R4 recommendation.** Implement transition cells only on faces where `|lod_a - lod_b| = 1`; keep uniform MC interior. Validate with hole-free manifold checks before claiming “Transvoxel complete.”

## R5 — GPU SSE LOD select

**CPU today:** `AdaptiveSseBudget` scales a single SSE threshold from FPS (does not compute per-tile geometric SSE).

**Target formula (research prototype in `lod_sse_select.wgsl`):**

$$
\\mathrm{SSE} \\approx \\frac{\\mathrm{geometricError} \\cdot \\mathrm{viewportScale}}{\\max(\\|c - \\mathrm{camera}\\|, \\varepsilon)}
$$

- If SSE > τ: prefer coarser LOD.
- If SSE < τ/2: refine one level.

**Exit criterion.** Side-by-side with Cesium/3D Tiles refine decisions on Posey tileset within agreed tolerance; until then mark experimental.

## Sequence 1–2 (this commit series)

1. Terrain mesh builds **Float64** world positions → `toRtcPositions` → float32 attribute; mesh `position` = RTC center.
2. Building features enriched with `tsmStateWord` + `tsmLod`; `degradeBuildingStateWord` for runtime VRAM/bandwidth hooks; `attachStateWordToTileset` for tileset extras.
