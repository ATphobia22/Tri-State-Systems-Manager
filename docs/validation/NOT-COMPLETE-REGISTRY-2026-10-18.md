# NOT COMPLETE — Technical Gaps Registry (updated 2026-10-19 WebGPU pass)

## 1. Hierarchical-Z and GPU Compute Culling
- **Status:** PARTIAL — **GPU depth pyramid scaffold on Nanite plane B**; MapLibre still WebGL-only
- **Built:**
  - WebGL2 occlusion queries (`occlusion-culling.ts`)
  - CPU depth pyramid (`hierarchical-z-software.ts`)
  - WebGPU device bootstrap + portable limits (`webgpu-nanite/webgpu-device.ts`)
  - GPU depth pyramid compute (`webgpu-nanite/depth-pyramid.ts`) — max-reduce mips, workgroup 8×8
  - Plan: `docs/research/WEBGPU-COMPUTE-LIMITS-AND-NANITE-PLAN-2026-10-19.md`
- **Still missing:** Full nanite-webgpu meshlet cull integration; production camera shared with MapLibre; Chrome-only runtime validation in CI
- **Do not claim:** Hierarchical-Z inside MapLibre, or complete Nanite production renderer

## 2. Transvoxel Terrain Stitching
- **Status:** ADVANCED POC — Lengyel class tables in TS; mesh emission at county scale partial
- Unchanged from prior pass.

## 3. Full C/S State Transitions
- Lifecycle + bandwidth adaptive wired into TilesFetchBridge. Asset coverage partial.

## 4. Coordinate Validation
- Contract + batch harness; system-wide catalog pass still required.

## 5. Occlusion Validation
- Context-loss + unit tests; multi-device profiles still missing.

---

**WebGPU limit rule:** Design to `maxStorageBufferBindingSize ≥ 128MiB`, workgroup product ≤ 256, prefer `@workgroup_size(64)` or 8×8. No portable `atomic<u64>` — Nanite software raster stays 32-bit packed until WGSL 64-bit atomics ship widely.
