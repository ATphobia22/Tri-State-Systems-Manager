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
custom-layer path (`tiles-3d-renderer-layer.ts`) gets frustum culling from
three.js itself — which already culls per-object on the CPU/GPU via its
internal pipeline. A hand-rolled compute pass would duplicate what the
renderer already does.

**Unblock condition:** MapLibre ships a stable WebGPU renderer, or the
project moves terrain rendering fully into the three.js custom layer where
three.js controls the pipeline.

## 2. Transvoxel Stitching (WebGPU Compute Pipeline)

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

- **Texture atlas consolidation:** `scripts/3d-tiles/pack-atlas.py` —
  headless Blender script that imports multiple GLBs, smart-UV-unwraps,
  bakes a unified diffuse atlas, assigns one shared PBR material, and
  exports a packed GLB. Syntax-verified.
- **PBR baking:** `scripts/3d-tiles/bake-pbr.py` (already committed).
- **State-word decoders:** `decodeStateWord` + `STATE_WORD_GLSL_DECODE`
  in `tiles-3d-renderer-layer.ts` (already committed).
- **State degradation:** `state-word-scheduler.ts` (already committed).
- **RTC:** handled inside 3d-tiles-renderer's TilesRenderer
  (already committed).
