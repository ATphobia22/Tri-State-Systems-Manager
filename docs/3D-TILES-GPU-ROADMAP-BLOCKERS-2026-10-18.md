# GPU Pipeline Items — Honest Status (2026-10-18)

Two items from the gap analysis cannot be implemented today. This is not
a placeholder — it is a documented blocker with the reason and the
unblock condition.

## 1. GPU-Driven Frustum Culling (Compute Shaders)

**Status:** BLOCKED — no implementation path exists in the current stack.

**Why:** MapLibre GL JS renders with WebGL 2. Custom compute-shader passes
require WebGPU. MapLibre's WebGPU renderer is not yet production-ready
(as of the research cut-off), and there is no open-source library that adds
GPU frustum-culling compute passes to a MapLibre scene. The three.js
custom-layer path (`tiles-3d-renderer-layer.ts`) provides ordinary
CPU-side object frustum culling; that is not a GPU-driven compute pass.
A custom compute path would need an independently owned WebGPU rendering
pipeline, visibility-buffer integration, and device-specific benchmarks.

**Unblock condition:** MapLibre ships a stable WebGPU renderer, or the
project moves terrain rendering fully into the three.js custom layer where
three.js controls the pipeline.

## 2. Depth Occlusion / Hierarchical-Z

**Status:** NOT IMPLEMENTED. Query-based occlusion is technically possible in
WebGL 2, but TSM does not currently own a query lifecycle, temporal result
buffer, visibility hysteresis, or per-object occlusion policy in its
MapLibre/Three.js layer.

**Current behavior:** Three.js `Object3D.frustumCulled` is view-frustum culling,
not occlusion culling. WebGL 2 exposes asynchronous occlusion-query results,
but wiring them into a shared MapLibre context requires avoiding synchronous
GPU stalls and stale visibility decisions. A hierarchical-Z compute path
would require a different renderer capability and is not supplied by this
WebGL 2 path.

**Unblock condition:** Implement a separately reviewed WebGL 2 occlusion-query
pass with non-blocking `QUERY_RESULT_AVAILABLE` polling, conservative fallback
visibility, query reuse/disposal, and device-level performance tests; or adopt
a renderer backend whose occlusion implementation is verified in TSM.

References: [Three.js Object3D frustum-culling contract](https://threejs.org/docs/pages/Object3D.html),
[Three.js Renderer occlusion API](https://threejs.org/docs/pages/Renderer),
[MDN WebGL 2 query results](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/getQueryParameter).

## 3. Transvoxel Stitching (WebGPU Compute Pipeline)

**Status:** BLOCKED — research-scale, no library exists.

**Why:** Per the deep research (mapping-planes-lod-integration-20261018-0426
§5, Honest Gap #2): "WebGPU SDF/Dual Contouring/Transvoxel terrain library
for the browser: does not exist as a reusable library; only research demos
(Will Usher webtoys) and a WebGL thesis engine." Implementing Transvoxel
from scratch is a multi-month R&D project, not an integration task.

**What ships instead:** The HazardSim-style canvas flood layer
(`tsm-console/src/lib/canvas-flood-layer.ts`) — map-aligned grid,
BFS flood-fill respecting terrain, canvas source updated per frame.
Proven technique, local-first, no WebGPU required.

**Unblock condition:** A maintained open-source Transvoxel/WebGPU terrain
library appears, or the project funds dedicated R&D for it.

## What WAS Completed (2026-10-18)

- **Texture atlas consolidation:** `scripts/3d-tiles/pack-atlas.py` imports
  multiple GLBs, globally packs UV islands, and bakes one albedo atlas. It is
  **not yet a lossless PBR atlas pipeline**: its shared material intentionally
  uses roughness=1 and metallic=0, so source normal/roughness/metallic/AO maps
  are not preserved by this operation. The script now keeps source materials
  attached through the albedo bake and fails closed for missing inputs. A
  Blender-host functional run is still required.
- **PBR map baking:** `tsm-console/scripts/3d-tiles/bake-pbr.py` supports
  diffuse/albedo, normal, roughness, AO, emission, and a guarded metallic bake
  for direct Principled BSDF graphs. Complex graphs fail closed. This produces
  individual channel maps; atlas-wide PBR channel packing and exporter round
  trips remain unverified. Syntax checks alone do not establish bake correctness.
- **State-word codec and scheduler primitives:** the PR branch aligns field
  offsets with the published B[15:14], D[13:12], C[11:9], T[8:6], S[5:3],
  R[2:0] layout and rejects reserved patterns. Metadata extraction from
  `EXT_structural_metadata` and real network/GPU scheduling remain separate
  integration work; the current code does not claim they are wired.
- **Local ENU transform verification:** numerical regression tests cover the
  HLOD builder's basis, origin projection, matrix inverse, and round trips.
  This verifies transform math only, not source CRS, vertical datum, or survey
  accuracy. A passing test run is still required.
- **RTC:** `3d-tiles-renderer` applies tile and glTF transforms, but TSM must
  still validate input frame/provenance and must not treat legacy RTC_CENTER
  as a 3D Tiles 1.1 contract.
