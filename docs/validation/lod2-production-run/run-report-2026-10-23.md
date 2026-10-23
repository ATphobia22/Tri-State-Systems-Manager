# LOD2 Production Run — 2026-10-23

**Status: COMPLETED — full 7,453-building production run executed and VERIFIED.**

The LOD2 production run that had never executed is done. All 7,453 buildings
with LiDAR-derived roof planes were processed end-to-end on this VM.

## How to reproduce

```bash
~/workspace/lod2-venv/bin/python scripts/geospatial/lod2-batch-reconstruct.py \
  --outdir <outdir> --progress-every 200
```

- **Pipeline:** `scripts/geospatial/lod2-batch-reconstruct.py` → per-building
  `process_one()` from `scripts/geospatial/lod2-proof-of-concept.py`
  (TU Delft 3DBAG/geoflow plane-arrangement, pure Python: shapely + numpy +
  trimesh). PoC method validated 2026-10-18 (`docs/validation/LOD2-POC-2026-10-18.md`).
- **Environment:** `~/workspace/lod2-venv` (durable): shapely 2.2.0,
  trimesh 5.1.1, pyproj 3.8.0, numpy 2.5.4, Python 3.12.3.
  (No shapely/trimesh existed on this VM before; installed via egress proxy.)
- **Resilience:** per-building try/except — a failure never aborts the batch;
  `--resume` skips objectids already in the summary file; summary checkpointed
  every 200 buildings. Fail-closed is banned by user directive and is not used.

## Inputs (all present — VERIFIED)

| input | value |
|---|---|
| GeoJSON | `/home/hatch/workspace/pipeline-run/posey-buildings-lod2-23082.geojson` |
| SHA-256 | `5a8b6990b19590f18fbd414584fad1c5a936b96c271692c91577b243039ed8a6` |
| total features | 23,082 |
| achievedLod==2 AND roofPlanes (candidates) | **7,453** (verified count in input) |
| roof-plane CRS | EPSG:3857 (LiDAR EPT native; median 2.4 m vs `lidarRoofElevM` per PoC doc) |
| raw planes per building | min 1, median 2, max 6 |

No imagery, no GDAL, no GPU, and no new LiDAR downloads were needed: the run
uses only the pre-computed `roofPlanes` already in the input file.

## Run timing & resources (measured, not estimated)

| metric | value |
|---|---|
| wall clock | **19.3 s** (summary `elapsed_s`) |
| throughput | ~388 buildings/s |
| peak RSS (300-building instrumented probe, same code path) | **168.9 MB** (input parse ~170 MB transient) |
| VM | 2 vCPU, ~7 GB RAM — no GPU — resources were never a constraint |

## Results (from `lod2-batch-summary-2026-10-23.json`, SHA-256 below)

| status | count | % |
|---|---|---|
| processed | 7,453 | 100 |
| **built** (`ok`, GLB exported) | **5,256** | 70.5 |
| — watertight | 5,174 | 98.4 of built |
| — built but not watertight | 82 | 1.6 of built |
| `no-usable-planes` | 2,197 | 29.5 |
| `failed` (exceptions) | **0** | 0 |

Aggregate geometry: 119,439 triangles, 70,188 vertices, 5,256 GLBs totaling
**6.6 MB**. Total enclosed volume (watertight only): 23,435,270.6 m³.

### Failure categories (honest, per-building)

1. **`no-usable-planes` — 2,197 buildings.** The input carries raw `roofPlanes`,
   but the PoC's validated quality gate (`rmse_m ≤ 0.15`, `inlier_count ≥ 30`)
   removed every plane. Breakdown: all 2,563 raw planes in these buildings
   failed the `inlier_count ≥ 30` gate (RMSE gate passed on all). 1,837 of these
   buildings had only 1 raw plane to begin with. This is an **input data-quality
   limit (sparse LiDAR inliers), not a pipeline bug** — these buildings are
   candidates for LOD1 (footprint + height) instead of LOD2. The status is
   recorded per building in the summary JSON.
2. **Built but not watertight — 82 buildings.** All 82 produced exactly 1
   subdivision cell (no kept intersection lines → single roof plane over the
   footprint) and carry real geometry (29–610 triangles). The `watertight:
   false` flag is preserved in the summary and the GLB is still exported, so
   downstream consumers can decide (use, repair, or drop).
3. **Exceptions — 0.** The resilient per-building path never needed to fire.

### Independent spot validation

5 random watertight GLBs re-loaded from disk and re-verified with trimesh
(dump + concatenate): all confirmed `is_watertight=True`, volumes
780.6–14,827.9 m³ recompute correctly, footprints in metres around the local
origin, origins in EPSG:3857 consistent with the Point Township area
(e.g. origin `[-9770912.8, 4603918.1]`). Min triangles among built: 14;
zero-triangle builds: 0.

## What is NOT claimed

- The 2,197 `no-usable-planes` buildings do **not** have LOD2 geometry —
  LOD2 coverage of the Posey County set is 5,256/23,082 footprints (22.8%).
- Watertightness of the 82 non-watertight builds is reported as-is, not fixed.
- This run produces geometry only. The 23,082 acceptance-chain validator and
  its deliverable files are explicitly **untouched** (blocked on the user's
  decision) — this geometry is an input to it, not a validation of it.
- GLB float32 local-origin encoding follows the PoC's
  `tsm_origin_3857`/`tsm_objectid` metadata convention.

## Files

- Full per-building summary: `lod2-batch-summary-2026-10-23.json`
  (SHA-256 `e303884787b6ad5def7eb4a58e1b84176b788295016da4d92be22a6d9d5646af`)
- Machine-readable metrics: `run-report-2026-10-23.json` (this document's numbers)
- 5 sample GLBs: `samples/` (3 watertight: 748866, 760981, 751569;
  2 non-watertight: 740323, 740339; rows in `samples/sample-rows.json`)
- **Full geometry set (5,256 GLBs, 6.6 MB) is NOT committed** — lives at
  `~/workspace/lod2-scratch/full/` on the VM (durable workspace), reproducible
  from the input + the two scripts above.

## Remaining work (for parent/orchestrator)

- The 2,197 `no-usable-planes` buildings need a decision: LOD1 fallback,
  denser LiDAR re-extraction, or exclusion from the LOD2 tier.
- The 82 non-watertight builds could be repaired or excluded; flagged per building.
- Feeding the 5,256 GLBs into the 3D-tiles twin and the acceptance chain is
  downstream of the user's pending decision on the validator.
