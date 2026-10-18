# Browser Voxel / Geospatial Rendering Options — 2026-10-18

## Decision

Use a staged, capability-gated architecture for TSM rather than treating one GPU technique as a universal solution.

1. **Current WebGL2 / MapLibre path:** hierarchical CPU-side frustum rejection before screen-space-error LOD selection; bounded tile/resource residency; front-to-back opaque draws where the host renderer controls ordering; keep existing asynchronous WebGL2 occlusion queries as an optional optimization.
2. **Large octrees:** supply a precomputed adjacency map. The LOD scheduler must not perform quadratic all-pairs adjacency construction above its configured safety limit.
3. **Future WebGPU path:** implement compute culling, hierarchical-Z, compaction/visibility buffers, and indirect drawing only behind a separate renderer interface and browser/device feature checks.
4. **Terrain generation:** keep SDF/voxel terrain and Transvoxel meshing separate from the existing DEM/3D Tiles path until the density contract, neighbor scheduler, transition validation, provenance, and datum checks are all integrated.
5. **Fallback:** unsupported GPU features, unavailable frustum metadata, context loss, or failed query support must preserve visible content rather than hide it.

## Alternatives evaluated

| Option | Strength | Constraint for TSM | Decision |
|---|---|---|---|
| CPU hierarchical frustum culling + SSE LOD | Broad browser support; deterministic; straightforward correctness tests | Must avoid quadratic neighbor preprocessing and main-thread stalls for very large trees | Implement as the WebGL2-compatible baseline; worker offload remains an integration task |
| WebGL2 asynchronous occlusion queries | Available in the current custom-layer context; can reuse depth already written by earlier layers | Results are delayed; useful only with reliable occluder depth and layer order; no OpenGL conditional-rendering API | Retain current bounded query manager; profile real devices |
| Transform feedback | Can run vertex processing on GPU | Readback/feedback-to-draw flow is awkward for general visibility lists and can add synchronization or extra passes | Do not make it the default culler |
| Hierarchical-Z / GPU compute | Scales visibility work and supports compact visibility lists in compute-capable APIs | WebGL2 does not provide compute shaders; requires a WebGPU renderer/backend, device support, and integration | Future optional WebGPU workstream |
| Sparse voxel octree / SVDAG with streaming | Strong fit for compressible static volumetric data and large view distances | Requires a real density/content model, streaming, edit/update semantics, and GPU traversal; not equivalent to mesh 3D Tiles | Research/prototype only after the data contract and benchmarks |
| OGC 3D Tiles + HLOD | Existing project assets and tile hierarchy; useful for buildings and terrain meshes | Not a volumetric density field; must not be relabeled as voxel terrain | Continue for current building/terrain assets |
| MapGPU (WebGPU map/globe library) | Candidate alternative for a future WebGPU-first map stack; advertises vector/raster tiles, terrain and 3D Tiles | Separate integration, maturity, compatibility, data-provenance and migration-cost assessment required | Run an isolated evaluation; do not replace MapLibre by assumption |

## Research references

- MapLibre CustomLayerInterface: https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
  - A custom layer draws using MapLibre's WebGL context and camera. A 3D custom layer shares depth with the map; layer state and context-loss lifecycle must be handled.
- MDN WebGL2: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext
  - Includes asynchronous query objects, instanced draws, 3D textures, and sync APIs, but no compute-shader dispatch.
- MDN WebGPU: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
  - Provides GPU computation and modern rendering capabilities, but browser availability is not universal; use feature detection and a fallback.
- OGC 3D Tiles: https://github.com/CesiumGS/3d-tiles/tree/main/specification
  - The appropriate standard for hierarchical streaming of geospatial 3D content; it does not itself define TSM's voxel-density field.
- Aokana (2025), A GPU-Driven Voxel Rendering Framework for Open World Games: https://www.alphaxiv.org/abs/2505.02017
  - Researches sparse voxel DAG storage, streaming, LOD, Hi-Z occlusion and visibility buffers. Its reported performance is from its research/game-engine implementation and must not be transferred to browser TSM without benchmarking.
- MapGPU: https://github.com/mgurbuz-tr/mapgpu
  - Candidate WebGPU geospatial rendering stack for a controlled compatibility and performance spike.

## Implementation status and non-claims

- The LOD scheduler now supports an optional six-plane conservative AABB/frustum test. It is a CPU selection primitive, not proof that the live MapLibre 3D Tiles runtime has been wired to pass its current frustum.
- Large-tree automatic adjacency construction now fails with an actionable error rather than silently entering an O(n²) build; callers must supply a precomputed adjacency map.
- This does **not** implement GPU compute culling, hierarchical-Z, indirect draws, an SVDAG runtime, or a production worker orchestration layer.
- Do not claim the renderer supports millions of voxels at a target frame rate until representative fixtures and browser/device benchmarks exist.

## Acceptance gates

- Unit tests: frustum plane validation, conservative boundary handling, no false culling on plane contact, correct eviction of previously resident off-screen nodes, LOD transition/balance regression.
- Integration: live MapLibre camera-to-frustum conversion and scheduler invocation must be demonstrated before claiming runtime frustum culling.
- Performance: benchmark 10k/100k/1M node metadata, adjacency preprocessing, per-frame traversal, resident-set churn, draw calls, CPU/GPU frame time, and memory on at least one desktop and one constrained/mobile-class device.
- Geospatial: verify CRS, vertical datum, coordinate epoch where applicable, nodata behavior, and source provenance before deriving voxel geometry.
- Release: all relevant tests and CI gates must pass on the exact candidate commit; queued or skipped jobs are not passes.
