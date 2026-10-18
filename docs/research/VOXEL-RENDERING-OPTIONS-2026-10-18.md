# Browser Voxel / Geospatial Rendering Options — 2026-10-18

## Decision
Use a staged, capability-gated architecture for TSM rather than treating one GPU technique as a universal solution.
1. **Current WebGL2 / MapLibre path:** hierarchical CPU-side frustum rejection before screen-space-error LOD selection; bounded tile/resource residency; front-to-back opaque draws where the host renderer controls ordering; retain asynchronous WebGL2 occlusion queries as an optional optimization.
2. **Large octrees:** supply a precomputed adjacency map. The scheduler must not perform quadratic all-pairs adjacency construction above its safety limit.
3. **Future WebGPU path:** compute culling, hierarchical-Z, compaction/visibility buffers, and indirect drawing belong behind a separate renderer interface with browser/device feature checks.
4. **Terrain generation:** keep SDF/voxel terrain and Transvoxel separate from existing DEM/3D Tiles until density contracts, neighbor scheduling, transition validation, provenance, and datum checks are integrated.
5. **Fallback:** unsupported GPU features, unavailable frustum metadata, context loss, or failed query support must preserve visible content rather than hide it.

## Alternatives evaluated
| Option | Strength | Constraint for TSM | Decision |
|---|---|---|---|
| CPU hierarchical frustum culling + SSE LOD | Broad browser support; deterministic and testable | Large-tree preprocessing and main-thread stalls need explicit controls | WebGL2-compatible baseline; worker offload remains an integration task |
| WebGL2 asynchronous occlusion queries | Available in the current custom-layer context; can reuse prior depth | Delayed results; requires reliable occluders and layer order; no OpenGL conditional-rendering API | Retain bounded query manager and profile devices |
| Transform feedback | GPU-side vertex processing | General visibility-list production and reuse can add passes/synchronization | Not the default culler |
| Hierarchical-Z / GPU compute | Efficient visibility compaction in compute-capable APIs | WebGL2 has no compute dispatch; requires WebGPU backend and integration | Optional future WebGPU workstream |
| Sparse voxel octree / SVDAG | Compressible static volumetric data and long view distances | Requires real density data, streaming/edit semantics and GPU traversal; not equivalent to mesh 3D Tiles | Research/prototype after contract and benchmarks |
| OGC 3D Tiles + HLOD | Existing hierarchy for buildings and terrain meshes | Not a volumetric density field | Continue for current building/terrain assets |
| MapGPU | Candidate WebGPU-first geospatial stack with vector/raster tiles, terrain and 3D Tiles | Separate maturity, compatibility, provenance and migration assessment | Isolated evaluation only; no automatic replacement |

## Research references
- MapLibre CustomLayerInterface: https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/ — custom layers share MapLibre's WebGL context; 3D layers share depth and must handle context lifecycle.
- MDN WebGL2: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext — asynchronous query objects, instanced draws and 3D textures, but no compute-shader dispatch.
- MDN WebGPU: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API — general GPU computation and modern rendering; browser availability is not universal.
- OGC 3D Tiles: https://github.com/CesiumGS/3d-tiles/tree/main/specification — hierarchical streaming standard for geospatial 3D content, not TSM's voxel-density schema.
- Aokana (2025), A GPU-Driven Voxel Rendering Framework for Open World Games: https://www.alphaxiv.org/abs/2505.02017 — SVDAG storage, streaming, LOD, Hi-Z and visibility buffers; its game-engine results must not be transferred to browsers without benchmarking.
- MapGPU: https://github.com/mgurbuz-tr/mapgpu — candidate WebGPU geospatial rendering stack for controlled compatibility/performance evaluation.

## Implementation status and non-claims
- The LOD scheduler supports an optional six-plane conservative AABB/frustum test. This is not proof that the live MapLibre 3D Tiles runtime passes its camera frustum to the Transvoxel scheduler.
- Large-tree automatic adjacency construction fails with an actionable error rather than silently entering an O(n²) build; callers must supply a precomputed adjacency map.
- This does **not** implement GPU compute culling, hierarchical-Z, indirect draws, an SVDAG runtime, or production worker orchestration.
- Do not claim a target frame rate or production support for millions of voxels until representative browser/device benchmarks exist.

## Acceptance gates
- Unit tests: plane validation, conservative boundary handling, no false culling on plane contact, off-screen resident eviction, LOD transition/balance regression, and large-tree adjacency guard.
- Integration: live MapLibre camera-to-frustum conversion and scheduler invocation must be demonstrated before claiming runtime frustum culling.
- Performance: benchmark 10k/100k/1M node metadata, adjacency preprocessing, per-frame traversal, resident-set churn, draw calls, CPU/GPU frame time and memory on desktop and constrained/mobile hardware.
- Geospatial: verify CRS, vertical datum, coordinate epoch where applicable, nodata behavior and source provenance before deriving voxel geometry.
- Release: all relevant tests and CI gates must pass on the exact candidate commit; queued or skipped jobs are not passes.
