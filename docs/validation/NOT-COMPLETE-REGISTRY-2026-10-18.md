# NOT COMPLETE — Technical Gaps Registry (updated 2026-10-19 finish)

## 1. Hierarchical-Z and GPU Compute Culling
- **Status:** PARTIAL — plane B smoke complete; production meshlets not inlined
- **Built:**
  - WebGL occlusion queries; CPU depth pyramid
  - WebGPU device + limits; GPU depth pyramid compute
  - MapLibre → WebGPU camera bridge
  - Nanite plane runtime smoke + **NanitePlanePanel** on MapTwinView (`VITE_TSM_WEBGPU_NANITE`)
- **Still missing:** meshlet cull from nanite-webgpu; live depth from real scene; CI Chrome WebGPU job
- **Do not claim:** H-Z inside MapLibre or full Nanite production

## 2. Transvoxel Terrain Stitching
- Lengyel class tables in TS; county-scale mesh emission still partial

## 3. Full C/S State Transitions
- Lifecycle + bandwidth in TilesFetchBridge; full AOI assets partial

## 4. Coordinate Validation
- Contract + batch harness; full catalog coverage report not committed

## 5. Occlusion Validation
- Unit/context-loss; multi-device profiles outstanding

**WebGPU rule:** portable 128 MiB storage binding; workgroup ≤ 256 invocations; no portable `atomic<u64>` for visibility buffer yet.
