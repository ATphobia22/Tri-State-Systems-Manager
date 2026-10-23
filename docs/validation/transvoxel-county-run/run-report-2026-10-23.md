# Transvoxel County-Scale Mesh Emission — Run Report 2026-10-23

**Status: VERIFIED** (measured run, real inputs, deterministic output)
**Registry item:** NOT-COMPLETE-REGISTRY-2026-10-18 item 2 — "tables done; full mesh emission at AOI scale not run"
**Evidence class:** `REAL_DEM_TRANSVOXEL_COUNTY_RUN` (machine-readable: `run-report-2026-10-23.json`, schema 1.0.0)

## What was run

End-to-end transition-cell mesh emission from **real neighboring USGS 3DEP 1 m LiDAR tiles**
(Indiana Statewide 2017, EPSG:26916), driven by the canonical Lengyel transition mesher
(`scripts/geospatial/transvoxel_transition_mesh.py`, coarse-corner mapping **[0,2,6,8]**
verified against Lengyel's official Transvoxel.cpp). New driver:
`scripts/geospatial/transvoxel_county_run.py`.

**Scope model (honest):** each chunk emits the transition-face mesh along its west edge
(the established `benchmark-real-dem-transvoxel.py` model — one 20 m transition-cell
column strip per chunk), tiled over the AOI in an 8×8 chunk grid. This is **not** a full
adaptive-octree terrain extraction of the county. The report states exactly what fraction
of the county the AOI represents and projects full-county cost from measured numbers.

## Inputs (all real, SHA-256 recorded)

| Tile (2×2 neighboring) | SHA-256 (prefix) | Bytes | CRS |
|---|---|---|---|
| USGS_1M_16_x40y419_IN_Indiana_Statewide_LiDAR_2017_B17.tif | `e4693cf540da82b9…` | 127,949,586 | EPSG:26916 |
| USGS_1M_16_x40y420_IN_Indiana_Statewide_LiDAR_2017_B17.tif | `ecbecfe94e4191b9…` | 183,728,948 | EPSG:26916 |
| USGS_1M_16_x41y419_IN_Indiana_Statewide_LiDAR_2017_B17.tif | `fad61772041521ff…` | 257,825,774 | EPSG:26916 |
| USGS_1M_16_x41y420_IN_Indiana_Statewide_LiDAR_2017_B17.tif | `9ae9e9a7ee2a5a79…` | 296,540,961 | EPSG:26916 |

Full hashes in the JSON. Tile union: 20,012 × 20,012 m. 12 m tile overlaps resolved by
fixed input-order priority (documented, not hidden).

## AOI (declared)

- Bounds (EPSG:26916): E 400,000–420,000 m, N 4,180,000–4,200,000 m (union inset 6 m so chunks tile exactly)
- Area: **400.0 km² = 36.8% of Posey County, IN (~1,087 km²)** — a measured representative-county run
- General Point Township area; screening-level, NOT anchor-targeted (per 2026-10-23 privacy directive)
- Cell 20 m; chunk 125×125 cells (2.5 km); grid 8×8 = 64 chunks; global z-range 80–180 m (5 z-cells, shared by all chunks for like-for-like seam checks)
- Vertical: meters, NAVD88 per 3DEP 1 m product spec (not re-certified by this run)

## Measured results (VERIFIED)

| Metric | Value |
|---|---|
| Transition cells tested | 36,875 |
| Transition cells meshed (surface-crossing) | 5,721 |
| Cells skipped (nodata — counted, never fabricated) | 8,340 |
| Vertices / triangles emitted | 28,694 / 17,252 |
| Mesh SHA-256 | `4c4b3a69ea0e1aebaf477d029dfc0a81b94a752bb96042f80c89a25d9413166d` |
| Wall-clock time | **21.3 s** |
| Peak process RSS | **707 MB** |
| Cell throughput (end-to-end, incl. I/O) | 1,730 cells/s |
| Hardware | VM: 2 vCPU, 7.7 GiB RAM, no GPU; concurrent sibling workload present |
| Determinism | **Two independent runs → identical mesh SHA-256, counts, seam results** |

Transition cases exercised by real terrain: 12 of 512 (dominated by case 7: 4,180 and
case 399: 1,410 — flat floodplain SDF is near-planar). Full 73-class/512-case coverage
comes from the synthetic exhaustive check: **3072/3072 PASS** (`transvoxel_transition_mesh.py --self-test`).

## Seam / crack checks (stitch boundaries between tiles)

Methodology: same as `benchmark-real-dem-transvoxel.py` — triangle/plane intersection keys
at 2 cm quantization, compared across every shared y-boundary within chunks (incl. z-seams
per column) and across all chunk boundaries, including the 4 boundaries per column that
coincide with **real tile edges**.

| Seam set | Checked | Mismatches | One-sided (nodata edge) | Two-sided (true crack) |
|---|---|---|---|---|
| Within-chunk (y + z) | 17,118 | 7 | 7 (all nodata-adjacent) | **0** |
| Cross-chunk (incl. tile edges) | 44 | 0 | 0 | **0** |

- **Max crack width: 0.0 m.** Zero true cracks at any checked seam, including all real tile-edge boundaries.
- The 7 one-sided within-chunk mismatches are all at nodata margins (one side emitted seam points, the other side's cells were skipped for nodata) — honest edge behavior, counted, `crackMeters: null`.
- 5 of 64 chunks had no valid data (southwest coverage gap in the source tiles) — skipped and counted, did not abort the run (resilient, never fail-closed).

### Bug found and fixed during this run (documented, not hidden)

The first full run showed 44/44 cross-chunk mismatches (all one-sided). Root cause: a **driver
bug** in the chunk-grid sampler — at exact lattice-line coordinates on a chunk's south edge,
bilinear addressing requested grid row `n` (out of bounds), so boundary-touching cells were
skipped instead of meshed. Fixed by addressing the cell below/left on exact lattice lines
(value-identical: bilinear at an exact lattice line equals the lattice value either way).
After the fix: 44/44 cross-chunk seams agree exactly. The mesher itself was never at fault.

## Feasibility assessment for full-county scale

**Full Posey County (~1,087 km²) transition-mesh emission at 20 m is FEASIBLE on this VM.**
Projection from the measured end-to-end rate (1,730 cells/s), labeled PROJECTION:

- Strip model (as measured, scaled by area): ~57 s.
- **Full-column model** (every 20 m column meshed across its z-range — the production-scale
  interpretation): 13.6 M cells → **~2.2 hours single-process** on this VM. Order-of-magnitude
  planning arithmetic; a real adaptive octree would change constant factors.

No memory ceiling was hit (707 MB peak vs 7.7 GB). The binding constraint at county scale is
wall time, not RAM, and it fits comfortably in a background run.

## What remains (NOT done here)

1. Full adaptive-octree terrain extraction (this run emits transition faces per the benchmark model).
2. Seam checks in all six orientations (y-seams within/across chunks + z-seams covered; x-seams N/A to the face model).
3. Transition-class coverage from real terrain beyond the 12 cases flat floodplain produces (synthetic exhaustive coverage exists in tests).
4. Tile-overlap disagreement measurement (overlaps resolved by fixed priority; inter-tile resampling divergence not separately measured).
5. GPU/WebGPU path (`tsm-console/src/gpu/transvoxel-stitch.ts`) — this run is the CPU reference.

## Integrity finding: committed Python tables were placeholders (FIXED)

While setting up this run, `_ensure_tables` regenerated `scripts/geospatial/lengyel_*.json`
from EricLengyel/Transvoxel (MIT) because chunks were missing. Comparison of the
previously committed files against the regenerated official data:

- Old `lengyel_cell_data.json`: 56 entries but only **37 distinct** (repetitive placeholder classes).
- Old `lengyel_vertex_0.json`: **truncated file literally ending in `[PLACEHOLDER]`**, with fabricated
  values (e.g. `18000` where official is `17991`).
- `lengyel_vertex_1/2/3.json` and `lengyel_transition_data.json`: missing entirely.
- Regenerated tables: **0 differences** vs the TS-side official port
  (`tsm-console/src/lib/transvoxel-lengyel-tables.ts`, 56 cell entries / 512 vertex rows;
  the single duplicated class entry exists in genuine Lengyel data too).

The regenerated official tables are committed with this run. All mesh evidence in this
report was produced with the verified official tables. (CI had been regenerating them on
every run via network, so the placeholders never executed there — but the committed
artifacts were theater, now corrected.)

## Files

- `run-report-2026-10-23.json` — machine-readable report (this directory)
- `sample-chunk-mesh.json` — small representative mesh sample (truncated; full mesh hashed, not stored)
- Driver: `scripts/geospatial/transvoxel_county_run.py` (committed)
- Tables: `scripts/geospatial/lengyel_*.json` — regenerated official Lengyel data (committed)

No multi-hundred-MB meshes were committed. Reports, hashes, tables, and the sample only.
