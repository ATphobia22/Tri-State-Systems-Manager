# NOT COMPLETE — Technical Gaps Registry (updated 2026-10-19)

These items must NOT be over-claimed. Status reflects code on main after the 2026-10-19 closure pass.

## 1. Hierarchical-Z and GPU Compute Culling
- **Status:** PARTIAL — SOFTWARE PYRAMID + OCCLUSION QUERIES; **GPU H-Z STILL BLOCKED**
- **Built:**
  - WebGL2 occlusion-query culling (`occlusion-culling.ts`)
  - Software CPU depth pyramid (`hierarchical-z-software.ts`) — offline/test only; `HIERARCHICAL_Z_STATUS.gpuHierarchicalZ === false`
- **Still missing:** True GPU Hierarchical-Z (mipmapped depth + compute). Blocked: MapLibre has no WebGPU renderer path.
- **Do not claim:** Production GPU Hierarchical-Z.

## 2. Transvoxel Terrain Stitching
- **Status:** ADVANCED POC — CLASS TABLES COMPLETE; FULL MESH TABLES + TERRAIN SCALE STILL PARTIAL
- **Built:**
  - Voxel-density contract v1.0
  - LOD 2:1 scheduler (`lod-scheduler.ts`)
  - Lengyel `transitionCellClass[512]` in Python **and** TypeScript (`transvoxel-lengyel-classes.ts`, 56 classes certified)
  - Pragmatic stitch PoC (crack-check ~1mm on test data)
- **Still missing:**
  - Full 56-class **triangle vertex** tables at runtime scale (classification is complete; mesh emission for all classes is Python-side / sparse in JS)
  - Production tiling for full-county terrain
- **Do not claim:** Complete production Transvoxel terrain for Posey at interactive rates.

## 3. Full C/S State Transitions
- **Status:** LOGIC + LIFECYCLE + BANDWIDTH ADAPTIVE — ASSET COVERAGE STILL PARTIAL
- **Built:**
  - State-word scheduler, variants, tiles-fetch-bridge
  - Tile resource lifecycle (`tile-resource-lifecycle.ts`)
  - Bandwidth-adaptive concurrency (`bandwidth-adaptive-fetch.ts`) — throughput samples → concurrency + degrade steps
- **Still missing:** Full binary LOD asset sets for all production AOIs; live telemetry wiring into every render path.
- **Do not claim:** Fully populated adaptive streaming for every county tile.

## 4. Coordinate Validation
- **Status:** CONTRACT + BATCH HARNESS — SYSTEM-WIDE DATA PASS STILL REQUIRED
- **Built:**
  - Geodetic guards, `ElevationEvidenceProduct`, terrain `assertTerrainEvidence`
  - Batch harness (`coordinate-validation-batch.ts`) with coverage metrics
- **Still missing:** Running the batch to 100% coverage on all ~23k building features with verified per-source datum/epoch evidence.
- **Do not claim:** 100% feature catalog CRS/datum validation until a green batch report is committed.

## 5. Occlusion Validation
- **Status:** PARTIAL
- **Built:** WebGL context-loss recovery; occlusion query unit tests; software H-Z pyramid tests (structure)
- **Still missing:** Multi-device frame-timing profiles (especially older iOS Safari)
- **Do not claim:** Device-certified performance.

---

**Rule:** Closing a *code* gap is not the same as closing a *data* or *platform* gap. GPU H-Z remains platform-blocked. System-wide coordinate coverage remains a data job.
