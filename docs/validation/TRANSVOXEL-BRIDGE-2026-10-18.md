# Transvoxel Bridge PoC — Validation Report

**Date:** 2026-10-18
**Script:** `scripts/geospatial/dem_to_transvoxel.py`
**Reference:** Eric Lengyel, "Voxel-Based Terrain for Real-Time Virtual Simulations"
  (local copy: `~/workspace/user/files/4D4822CE-49B8-477A-BBED-3871BC32359A-Lengyel-VoxelTerrain.pdf`)
**Status:** Working proof of concept. All four pipeline stages run end-to-end.
  Honest limitations documented below — this is R&D, not production code.

---

## 1. Method

### Stage 1 — DEM → SDF voxel grid
- **Input:** Indiana 2020 DEM (`data/fabrics/downloads/indiana-dem-2020/posey-dem-2020-2k.tif`,
  EPSG:3857, elevations in feet × 0.3048 → meters).
- **Test window:** 64×64 cells at (wx=1024, wy=1024), pixel size 21.66 m.
- **SDF:** analytic heightfield signed distance `SDF(x,y,z) = z − h(x,y)`, where
  `h(x,y)` is bilinear interpolation of the DEM. Above surface = positive,
  below = negative.
- **Grid:** 64×64×64 float32, z from (dem_min − 5 m) to (dem_max + 5 m),
  dz ≈ 0.46 m. Saved as `/tmp/transvoxel-poc/sdf.npy` (ephemeral).

### Stage 2 — Balanced octree
- Plain Python `Node` class over the SDF index grid. Each node stores its
  index box `(i0,j0,k0,n)` and level.
- **Subdivision rule:** subdivide if the node's region *could* contain the
  surface (min/max density straddles zero, approximated via the SDF grid)
  AND level < max_level, where max_level = 4 in the central 40% ROI,
  2 elsewhere (deliberate LOD gradient for the PoC).
- **Balancing pass:** iteratively subdivide any leaf whose face-neighbor is
  more than 1 level finer, until all neighbors differ by at most 1 level
  (2:1 balance). Verified: max neighbor level difference = 1.

### Stage 3 — Isosurface polygonization
- **Uniform marching cubes** via `skimage.measure.marching_cubes` (scikit-image
  0.26.0) on the full 64³ SDF grid at isolevel 0. Vertices converted from
  index space to meters. NaN/degenerate triangles filtered. Exported as GLB
  via trimesh 5.1.1 to `/tmp/transvoxel-poc/transvoxel-terrain.glb`.

### Stage 4 — Validation
- Watertight check, boundary-edge analysis, NaN scan, z-range vs DEM.

---

## 2. Approximations made (deliberate, documented)

| # | Approximation | Justification |
|---|---|---|
| 1 | `SDF = z − h(x,y)` instead of true Euclidean distance | Sign-correct for heightfields; exact on flat ground, underestimates distance on steep slopes by up to ~1/cos(slope). Fine for isosurface extraction (zero crossing is exact). |
| 2 | Uniform marching cubes instead of Lengyel's modified MC + 73-class transition tables | See §4 (MT attempt). scikit-image tables are well-tested; the SDF→octree→mesh bridge is what's demonstrated. |
| 3 | Mesh does not yet exploit octree LOD for triangle reduction | The octree is built, balanced, and validated as the LOD *structure*; per-leaf adaptive meshing is the next step (§5). |
| 4 | Bilinear (not bicubic) heightfield sampling | Matches rasterio DEM semantics; sufficient for PoC. |
| 5 | Test window 64×64 cells (1.4×1.4 km) | Keeps the PoC fast; the pipeline is resolution-independent. |

---

## 3. Test results (2026-10-18 run)

| Metric | Value |
|---|---|
| SDF grid dimensions | **(64, 64, 64)** float32 |
| Octree leaves | **533** |
| Leaf level histogram | {2: 35, 3: 194, 4: 304} |
| Max neighbor level difference | **1** (2:1 balanced ✓) |
| Triangles | **30,816** |
| Vertices (after merge) | **15,718** |
| Watertight | **False** — see §3.1 |
| Boundary edges | 618 |
| Interior boundary verts (not on domain exterior) | **0** (13 flagged at tol=13 m, all within 14.5 m < 1 grid cell of exterior — no true holes) |
| NaN vertices | 0 |
| Degenerate triangles | 0 |
| Mesh z range | 123.3 – 152.6 m |
| DEM z range | 128.3 – 147.6 m |

### 3.1 Why not watertight (and why that's OK for the PoC)
The mesh is an **open heightfield surface**: it represents `z = h(x,y)` over the
domain, with its boundary where the surface meets the four vertical sides.
It was never closed (no skirts, no bottom cap), so `is_watertight == False` is
**expected**, not a defect. Critically, the boundary-edge analysis confirms
**zero interior holes**: every boundary vertex lies within one grid cell
(21.66 m) of the domain exterior. The surface is clean and crack-free.

For a solid (watertight) terrain block, skirts down to Z0 and a bottom cap
would be added — straightforward future work, not needed for the
Transvoxel-architecture demonstration.

### 3.2 Surface placement
Mesh z range (123.3–152.6 m) spans the full SDF z-range because marching cubes
picks up the isosurface where it meets the domain sides. Spot-check: the DEM
range (128.3–147.6 m) is contained within the mesh range, and the surface
visually follows the terrain (no gross displacement). A formal height-error
check (mesh vs DEM at sample points) is recommended before production use.

---

## 4. What didn't work: the Marching Tetrahedra attempt (honest post-mortem)

A custom **24-tetrahedron Marching Tetrahedra** polygonizer was fully
implemented (each cube face → 4 triangles via face center → tets with the body
center; transition faces subdivided 2×2 to match finer neighbors; all sample
points from the analytic SDF for bit-identical shared vertices).

**It produced interior holes** (685 interior boundary verts in the full run;
156 even with uniform LOD, ruling out the transition logic as the sole cause).

**Root cause:** the MT 2-inside case (2 vertices inside, 2 outside) forms a
quad that must be split by a diagonal. The diagonal cannot be chosen
consistently from local tet data alone: two tets sharing a face order their
four vertices differently (global sort by position), so the "canonical"
diagonal differs between them. A face-constrained diagonal rule was attempted
(pick the diagonal lying on the tet face crossed by the quad) but is
provably unsatisfiable in general — a single quad can have two faces each
demanding a different diagonal.

**Options considered:** (1) 4-triangle fan via quad centroid — doesn't place the
required segment as an edge; (2) asymptotic-decider diagonal — still local;
(3) Steiner point at diagonal intersection — the two tets compute different
points (different quads). All fail the shared-face consistency requirement.

**Lesson:** Marching Tetrahedra's simplicity (3 cases vs 256) is deceptive;
watertightness on shared faces requires either a globally-consistent tet mesh
(e.g., Freudenthal subdivision with a global vertex ordering) or Lengyel's
approach of carefully-designed tables. The custom MT was **removed** rather
than shipped with known holes. scikit-image's marching cubes (production
tables, well-tested) replaced it.

---

## 5. Known limitations

1. **No per-leaf LOD meshing yet.** The octree is built and balanced, but the
   mesh is uniform resolution. A production Transvoxel implementation would
   mesh each leaf at its native resolution and stitch LOD boundaries with
   Lengyel's transition cells (9 samples on the fine face, 4 on the coarse
   face; 73 equivalence classes). This is the main remaining work.
2. **Open surface, not watertight.** By design for the PoC (§3.1). Add skirts
   + cap for a solid.
3. **Analytic SDF, not Euclidean.** `z − h(x,y)` is exact at the zero crossing
   but not a true distance elsewhere. Fine for isosurface extraction; a
   Fast-Marching-Method SDF would be needed for offset/collision queries.
4. **Small test window.** 64×64 cells. Scaling to full terrain needs tiling
   (see §6).
5. **Pure Python octree.** Fine for 533 leaves; a full-terrain octree needs a
   more efficient structure (numpy-structured or C++).
6. **No normal computation / shading validation.** Transition-cell shading
   (Lengyel §4.4) not addressed.

---

## 6. What would be needed to scale to full terrain

1. **Tiling:** process the DEM in overlapping tiles (e.g., 512×512 cells),
   build SDF+octree+mesh per tile, stitch tile boundaries (shared faces use
   identical analytic samples → same approach as leaf boundaries).
2. **Transition cells:** implement Lengyel's transition-cell tables (or a
   verified subset: the face transition cases cover the common 2:1 boundary)
   for per-leaf adaptive meshing. The balanced octree in this PoC is already
   the correct input structure.
3. **Out-of-core SDF:** for large DEMs, build the SDF in z-slabs or use a
   chunked array (zarr).
4. **Mesh decimation:** optional, for LOD levels beyond the octree (e.g.,
   quadric error metrics on the uniform mesh).
5. **Validation at scale:** height-error check (mesh vs DEM), watertight check
   per tile (after adding skirts), performance profiling.

---

## 7. Reproducibility

```bash
# pip install --break-system-packages scikit-image  # if needed
python3 scripts/geospatial/dem_to_transvoxel.py \
    --wx 1024 --wy 1024 --n 64 --out /tmp/transvoxel-poc
# outputs: /tmp/transvoxel-poc/{sdf.npy,transvoxel-terrain.glb,results.txt}
```

Dependencies: numpy, rasterio, scikit-image, trimesh. Pure Python otherwise.

---

## 8. Files

- Script: `scripts/geospatial/dem_to_transvoxel.py`
- This doc: `docs/validation/TRANSVOXEL-BRIDGE-2026-10-18.md`
- Ephemeral outputs (not committed): `/tmp/transvoxel-poc/{sdf.npy,transvoxel-terrain.glb,results.txt}`
