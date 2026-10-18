# NOT COMPLETE — Technical Gaps Registry (2026-10-18)

These items must NOT be represented as complete in docs, dashboard, or artifacts.
Each lists what exists vs. what is missing.

## 1. Hierarchical-Z and GPU Compute Culling
- **Status:** NOT IMPLEMENTED
- **What exists:** Nothing. Three.js does per-object frustum culling internally in the custom layer; that is not Hierarchical-Z.
- **Missing:** GPU compute-shader passes for bounding-sphere frustum culling and depth occlusion. Blocked: MapLibre has no WebGPU renderer; no library exists.
- **Do not claim:** Any form of GPU-driven culling.

## 2. Transvoxel Terrain Stitching
- **Status:** POC ONLY — NOT PRODUCTION
- **What exists:** `dem_to_transvoxel.py` (SDF grid + balanced octree + uniform mesh), `transvoxel_stitch_poc.py` (pragmatic face stitching, crack-free at 1mm on test data).
- **Missing:**
  - Formal voxel-density data contract (SDF format specification: grid alignment, units, datum, nodata handling, tiling scheme)
  - Balanced 2:1 LOD-neighbor *scheduling* (runtime system deciding which LOD to fetch/render per frame — the octree structure exists, the scheduler does not)
  - True Transvoxel transition cell tables (73 classes); current stitching is pragmatic edge-matching, not the Lengyel algorithm
  - Production tiling for full-terrain scale
- **Do not claim:** Production Transvoxel terrain.

## 3. Full C/S State Transitions
- **Status:** LOGIC ONLY — NOT PRODUCTION
- **What exists:** `state-word-scheduler.ts` — clean-room 5D state-word logic: `degradeWord`, `chunksToFetch`/`chunksToRelease`, `scheduleFrame`. Unit-tested.
- **Missing:**
  - Resource variants (actual multi-resolution assets per state word — geometry LODs, texture mip chains)
  - Production network fetch/release engine (real tile fetching, cache eviction, bandwidth adaptation against live telemetry)
- **Do not claim:** A working adaptive streaming system.

## 4. Coordinate Validation
- **Status:** PARTIAL — LOCAL MATH ONLY
- **What exists:** `GeoidModel.get_geoid_height` validated at one anchor point (37.845887, -88.005075 → -30.302 m). Local-frame math has regression coverage.
- **Missing (needs separate evidence):**
  - Authoritative CRS validation across all 23,082 features (not just the anchor)
  - Vertical-datum validation per-source (NGVD29 confirmed for model 4449 only; other sources unverified)
  - Coordinate epoch validation (tectonic/plate motion over time)
  - Survey-accuracy validation (stated vs. achieved precision per dataset)
- **Do not claim:** System-wide datum or CRS validation.

## 5. Occlusion Validation
- **Status:** NOT DONE
- **What exists:** Nothing.
- **Missing:**
  - Browser/device profiling (frame timing across target devices, especially iOS 15-era Safari)
  - WebGL context-loss testing (recovery behavior when the GPU context is lost)
- **Do not claim:** Any performance or robustness validation.

---

**Rule:** A PoC validates an approach. It does not constitute a complete subsystem.
When in doubt, check this registry before writing status claims.
