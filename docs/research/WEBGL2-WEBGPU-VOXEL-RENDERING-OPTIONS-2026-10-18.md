# Browser Voxel / 3D Tiles Rendering Options for TSM
**Research date:** 2026-10-18
**Scope:** browser-based geospatial digital twin; existing MapLibre + Three.js + NASA-AMMOS 3D Tiles Renderer runtime; separate future SDF/voxel terrain pipeline.

## Decision summary

Use the existing 3D Tiles runtime for present building/terrain assets, and tune its native hierarchical traversal, frustum rejection, and screen-space-error (SSE) refinement. Keep the already implemented WebGL2 asynchronous depth-occlusion controller as an optional, fail-open optimization. Add bounded frame-budget adaptation to the same renderer rather than building a parallel scene graph or duplicate culler.

Do **not** claim the current renderer supports GPU compute culling, hierarchical-Z compute, or production Transvoxel streaming. The repository's SDF density contract exists, but the runtime still lacks the production voxel chunk stream and balanced-octree neighbor scheduler needed to connect a voxel-specific renderer safely.

## Options evaluated

| Option | Appropriate role in TSM | Constraints / decision |
|---|---|---|
| NASA-AMMOS 3D Tiles Renderer + MapLibre custom layer | Current primary runtime for GLB/3D Tiles, tile hierarchy, frustum/SSE selection | Keep and tune. It is already connected to tile loading, StateWord metadata, material quality adaptation, and optional WebGL2 occlusion. |
| Worker-based CPU octree culling | Future SDF voxel chunk selection; transferable typed-array bounds and camera frustum snapshots | Do not duplicate current 3D Tiles traversal. Add only alongside a real voxel chunk manifest, validated octree nodes, balanced-neighbor scheduler, and explicit ownership of chunk visibility. |
| Adaptive SSE / front-to-back opaque rendering | Immediate performance tuning for current tile runtime | Adaptive SSE is integrated on branch `feat/integrated-3d-render-budget`. Existing Three.js opaque sorting and renderer traversal remain authoritative; do not globally reorder transparent content. |
| WebGL2 occlusion queries | Optional extra rejection against previously written shared depth | Already implemented with delayed non-blocking result polling, per-frame/query caps, hysteresis, and fail-open behavior. It is not hierarchical-Z and depends on MapLibre layer order and depth-writing occluders. Profile it per device. |
| Transform feedback | Narrow WebGL2 GPU data transform / culling experiments | Not selected as the primary culler: reading generated visibility back to JavaScript can stall, and WebGL2 lacks the compute/indirect-draw workflow of modern GPU-driven renderers. |
| WebGPU compute + indirect rendering | Future backend for GPU culling, prefix-sum compaction, and more scalable voxel visibility | Keep behind a renderer abstraction and feature detection. WebGPU is not universally available; it must not be a hard requirement for current users. Do not put WGSL compute into the current WebGL2 custom layer. |
| Sparse Voxel Octree / SVDAG + streaming | Candidate storage and traversal for very large, mostly static volumetric terrain | Research candidate after voxel chunk contracts, update semantics, compression tradeoffs, and terrain validation are defined. SVDAG sharing is less attractive for frequently changing, heterogeneous hydrology fields. |
| OGC 3D Tiles 1.1 / HLOD | Interchange and hierarchical streaming of mesh assets | Retain for current building and terrain assets. Validate tile bounding volumes, geometric error, content URIs, transforms, and provenance before registration. |
| MapGPU (WebGPU-based mapping library) | Experimental alternative renderer or isolated compatibility spike | Evaluate only in a separate branch/prototype with a feature matrix and performance/accuracy tests. It is a third-party project, not an established drop-in replacement for TSM's current MapLibre/3D Tiles integration. |

## Integrated implementation

The branch changes the actual `Tiles3DRendererLayer` used by TSM:
- New `AdaptiveSseBudget` has validated parameters, clamped SSE limits, low-FPS quality reduction, distinct recovery threshold, and reset behavior.
- The render loop supplies its already-smoothed FPS estimate and writes the budget to the existing `TilesRenderer.errorTarget`.
- This reuses the active tile selection pipeline instead of adding a disconnected voxel demo or a second frustum culler.
- Existing StateWord degradation and the WebGL2 depth-occlusion controller remain independent safeguards; visibility and semantic metadata still fail open when optional optimizations fail.

## Required next stage for real voxel culling

1. Validate each voxel chunk against `docs/3D-TILES-VOXEL-DENSITY-CONTRACT-v1.md`: dimensions, world origin, metric spacing, CRS, vertical datum, SDF convention, nodata, source identity, producer/version, creation time, and density-array SHA-256.
2. Produce a deterministic manifest and node bounds with `level`, `bounds`, `min_density`, `max_density`, and `child_mask`; enforce 2:1 balanced leaves and one-voxel overlap rules.
3. Implement a pure CPU octree traversal first, with conservative frustum classification and deterministic LOD selection. Keep the worker boundary serializable and testable; worker output may request visibility/LOD but must not invent missing terrain.
4. Integrate the scheduler into the actual chunk loader/renderer lifecycle (load, retain, evict, dispose, context loss) only after that lifecycle exists. Use bounded cache budgets and fail-open fallback.
5. Add property tests for nodata exclusion, conservative bounds, neighbor balance, deterministic selection, seam transitions, and CRS/datum metadata preservation.
6. Benchmark representative low-end and high-end devices against current 3D Tiles/HLOD and DEM/TIN baselines before selecting WebGPU compute or SVDAG complexity.

## Sources

- TSM current architecture and release gates: [GPU roadmap blockers](../3D-TILES-GPU-ROADMAP-BLOCKERS-2026-10-18.md).
- TSM voxel input contract: [Voxel-density contract v1](../3D-TILES-VOXEL-DENSITY-CONTRACT-v1.md).
- TSM LOD semantics and fail-closed authority rules: [LOD contract](../../contracts/tsm-lod-contract-v1.json).
- MapLibre custom layer API: https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
- MapLibre graphics modernization roadmap: https://maplibre.org/roadmap/maplibre-gl-js/graphics-modernization/
- WebGPU availability, secure-context, and compute capability overview: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- MapGPU repository (candidate to evaluate, not endorsed as a drop-in): https://github.com/mgurbuz-tr/mapgpu
- Aokana, GPU-driven voxel rendering using SVDAG, LOD, streaming, Hi-Z, and visibility buffers (2025; Unity/native-style GPU-driven pipeline, not a WebGL2 recipe): https://doi.org/10.1145/3728299

## Verification status

**Implementation staged; not yet CI-verified.** No performance claims are made until the unit tests, TypeScript checks, production build, and device benchmarks complete. A green run on a different SHA does not satisfy the release gate.
