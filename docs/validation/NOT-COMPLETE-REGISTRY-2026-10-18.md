# NOT COMPLETE — Technical Gaps Registry (2026-10-18)

These items must NOT be represented as complete in docs, dashboard, or artifacts.
Each lists what exists vs. what is missing.

## 1. Hierarchical-Z and GPU Compute Culling
- **Status:** PARTIAL — OCCLUSION QUERIES BUILT, H-Z STILL BLOCKED
- **Built 2026-10-18:**
  - WebGL2 occlusion-query culling (`tsm-console/src/lib/occlusion-culling.ts`) — `OcclusionCuller` adapter over the existing `WebGL2DepthOcclusionController`, per-object `ANY_SAMPLES_PASSED` queries, async result polling, re-probe every N frames, fail-open fallback. 8 tests passing.
  - 3D Tiles fetch bridge (`tsm-console/src/lib/tiles-fetch-bridge.ts`) — connects LOD scheduler → TilesRenderer: load/evict via LRU cache, queue-depth backpressure triggers `degradeWord`. 7 tests passing.
- **Still missing:** True Hierarchical-Z (mipmapped depth pyramid + GPU compute). Blocked: MapLibre has no WebGPU renderer; no library exists.
- **Do not claim:** Hierarchical-Z or GPU compute-shader culling.

## 2. Transvoxel Terrain Stitching
- **Status:** POC ONLY — NOT PRODUCTION
- **What exists:** `dem_to_transvoxel.py` (SDF grid + balanced octree + uniform mesh), `transvoxel_stitch_poc.py` (pragmatic face stitching, crack-free at 1mm on test data).
- **Built 2026-10-18:**
  - Formal voxel-density data contract v1.0 (`docs/3D-TILES-VOXEL-DENSITY-CONTRACT-v1.md`)
  - Runtime LOD-neighbor scheduler (`tsm-console/src/lib/lod-scheduler.ts`) — SSE-driven selection, 2:1 balance enforcement, fetch plans with load/evict/refine/coarsen events. 14 tests passing.
- **Still missing:**
  - True Transvoxel transition cell tables (73 classes); current stitching is pragmatic edge-matching
  - True Transvoxel transition cell tables (73 classes); current stitching is pragmatic edge-matching, not the Lengyel algorithm
  - Production tiling for full-terrain scale
- **Do not claim:** Production Transvoxel terrain.

## 3. Full C/S State Transitions
- **Status:** LOGIC ONLY — NOT PRODUCTION
- **What exists:** `state-word-scheduler.ts` — clean-room 5D state-word logic: `degradeWord`, `chunksToFetch`/`chunksToRelease`, `scheduleFrame`. Unit-tested.
- **Built 2026-10-18:**
  - Resource variant descriptors (`tsm-console/src/lib/state-resource-variants.ts`) — maps state words to geometry LODs, texture resolutions, component lists, byte estimates. 9 tests passing.
- **Built 2026-10-18:**
  - Fetch bridge (`tiles-fetch-bridge.ts`) — LRU cache load/evict, queue-depth monitoring, backpressure → state degradation. Uses the real 3d-tiles-renderer APIs.
- **Still missing:**
  - Bandwidth-adaptive fetching against live telemetry (bridge monitors queue depth; does not yet adapt to measured throughput)
  - Actual binary assets (descriptors exist, not the data)
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
- **Status:** PARTIAL
- **Built 2026-10-18:**
  - WebGL context-loss recovery (`tsm-console/src/lib/webgl-context-recovery.ts`) — pauses rendering, rebuilds GPU resources on restore, handles failure. 12 tests passing.
- **Still missing:**
  - Browser/device profiling (frame timing across target devices, especially iOS 15-era Safari)
- **Do not claim:** Any performance or robustness validation.

---

**Rule:** A PoC validates an approach. It does not constitute a complete subsystem.
When in doubt, check this registry before writing status claims.
