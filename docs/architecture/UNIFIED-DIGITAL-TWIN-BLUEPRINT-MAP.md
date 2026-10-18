# Unified 3D Digital Twin — Blueprint Implementation Map

**Source:** Architectural Blueprint for Constructing, Combining, and Streaming a Unified 3D Open World Digital Twin (user-provided 2026-10-18)

This document maps each blueprint section to existing TSM repository components and identifies gaps.

---

## 1. Spatial Foundations (CityGML 3.0 + Mapping Planes)

| Blueprint Requirement | TSM Status | Location |
|----------------------|------------|----------|
| CityGML 3.0 Space/SpaceBoundary model | 📄 Documented | `docs/3D-TILES-CITYGML-PIPELINE.md` |
| Multi-plane spatial organization | ✅ Implemented | 8 Trust Planes (L1–L8) |
| OGC 3D Tiles 1.1 (glTF 2.0, implicit octree) | ✅ Implemented | `scripts/geospatial/build-*-3d-tiles.py` |

**Gap:** CityGML 3.0 XML/JSON parser — documented as concept, no import pipeline exists.

---

## 2. 5D Orthogonal State Decoupling (F = B × D × C × T × S)

| Dimension | Bits | TSM Status | Location |
|-----------|------|------------|----------|
| B (Boundary Proxy) | 0–1 | ✅ Implemented | `tsm-console/src/lib/state-word-codec.ts` |
| D (Geometric Detail) | 2–4 | ✅ Implemented | `tsm-console/src/lib/state-word-codec.ts` |
| C (Component Complexity) | 5–7 | ✅ Implemented | `tsm-console/src/lib/state-word-codec.ts` |
| T (Texture Appearance) | 8–10 | ✅ Implemented | `tsm-console/src/lib/state-word-codec.ts` |
| S (Semantic Depth) | 11–13 | ✅ Implemented | `tsm-console/src/lib/state-word-codec.ts` |
| M (Manager State) | 14–15 | ✅ Implemented | Tri-State lifecycle (UNLOADED/DORMANT/ACTIVE) |

**Note:** The blueprint uses a slightly different bit layout than TSM's canonical codec. TSM's layout (B:14, D:12, C:9, T:6, S:3) is authoritative for this repo.

**Gap:** VRAM telemetry hooks for automatic degradation — architecture documented, not wired to real GPU memory APIs.

---

## 3. Tri-State Lifecycle Manager

| State | TSM Status | Location |
|-------|------------|----------|
| UNLOADED (00) | ✅ Implemented | 3D tiles implicit octree |
| DORMANT (01) | ✅ Implemented | System RAM BVH + spatial proxy |
| ACTIVE (10) | ✅ Implemented | WebGPU VRAM + glTF payload |

**Status:** Fully aligned with blueprint. SSE-based refinement in `tiles-3d-renderer-layer.ts`.

---

## 4. WebGPU Volumetric Terrain

| Component | TSM Status | Location |
|-----------|------------|----------|
| SDF volume representation | ✅ Implemented (CPU) | `scripts/geospatial/dem_to_transvoxel.py` |
| Frustum culling shader | ✅ Implemented | `tsm-console/src/lib/shaders/culling.wgsl` |
| Dual Contouring extraction | ✅ Implemented (CPU) | `scripts/geospatial/dem_to_transvoxel.py` |
| GPU mesh extraction | 📄 Architecture only | `tsm-console/src/lib/webgpu-volumetric-terrain.ts` (stub) |
| Transvoxel stitching | ❌ Deliberately not ported | Documented in NOT-COMPLETE registry |

---

## 5. PBR Material Pipeline (T Dimension)

| Level | TSM Status | Location |
|-------|------------|----------|
| T_0 (Untextured) | ✅ | Legacy building definitions |
| T_1 (Flat color) | ✅ | Procedural class colors |
| T_2 (Single texture) | ✅ | Current 3D tiles |
| T_3 (Full PBR) | ✅ Script ready | `scripts/3d-tiles/bake-pbr-standard.py` |

**Gap:** The baking script requires Blender headless — not yet run on production assets.

---

## 6. RTC Coordinate Transforms

| Component | TSM Status | Location |
|-----------|------------|----------|
| RTC transformer class | ✅ Implemented | `tsm-console/src/lib/rtc-transform.ts` |
| GPU integration | ✅ Enabled | `tiles-3d-renderer-layer.ts` (rtc: true) |

**Status:** Complete.

---

## Priority Gaps (in order)

1. **CityGML 3.0 importer** — Parse Space/SpaceBoundary into 3D Tiles
2. **VRAM telemetry** — Wire state-word degradation to real GPU memory pressure
3. **WebGPU mesh extraction** — Implement `extractMesh()` or document permanent CPU bridge
4. **PBR baking run** — Execute `bake-pbr-standard.py` on production building assets
5. **Transvoxel tables** — Decide: port or permanently defer (currently deferred)
