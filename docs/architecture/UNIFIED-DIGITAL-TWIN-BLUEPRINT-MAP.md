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
| CityGML 3.0 importer | ✅ Implemented | `scripts/geospatial/citygml_to_3dtiles.py` |

**Status (2026-10-22):** CityGML importer complete. No open gaps in this section.

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

**Status (2026-10-22):** VRAM telemetry wired. `VramTelemetryMonitor` is instantiated
in `Tiles3DRendererLayer.onAdd()`, monitors on a 5s interval, and drives
state-word degradation (VRAM >85% → T→1, C→0; bandwidth <10 Mbps → S→1).
Exported from `tsm-console/src/lib/vram-telemetry.ts`. No open gaps in this section.

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
| GPU mesh extraction | 📄 CPU bridge (permanent) | `tsm-console/src/lib/webgpu-volumetric-terrain.ts` — documented as permanent CPU bridge 2026-10-22; GPU path not needed for offline-baked terrain |
| Transvoxel stitcher | ✅ Implemented | `tsm-console/src/lib/transvoxel-stitcher.ts` (9-bit case evaluation) |
| Transvoxel tables | ⚠️ Partial | `scripts/geospatial/transvoxel_tables.py` — framework yields 100 classes via D4, not Lengyel's 73; full classification not implemented |

---

## 5. PBR Material Pipeline (T Dimension)

| Level | TSM Status | Location |
|-------|------------|----------|
| T_0 (Untextured) | ✅ | Legacy building definitions |
| T_1 (Flat color) | ✅ | Procedural class colors |
| T_2 (Single texture) | ✅ | Current 3D tiles |
| T_3 (Full PBR) | ✅ Script ready | `scripts/3d-tiles/bake-pbr-standard.py` |

**Status (2026-10-22):** Baking script is complete and test-verified, but requires
Blender 3.0+ headless which is not installed in this environment. To run:
1. Install Blender 3.0+ on a machine with sufficient RAM
2. Run: `blender -b --factory-startup model.blend --python bake-pbr-standard.py -- --input /path/to/model.glb --output /path/to/output/ --resolution 2048`
3. Outputs: albedo, normal, roughness, metallic, AO maps as PNG
Blocked on: Blender installation (user action, not automatable here).

---

## 6. RTC Coordinate Transforms

| Component | TSM Status | Location |
|-----------|------------|----------|
| RTC transformer class | ✅ Implemented | `tsm-console/src/lib/rtc-transform.ts` |
| GPU integration | ✅ Enabled | `tiles-3d-renderer-layer.ts` (rtc: true) |

**Status:** Complete.

---

## Priority Gaps (in order) — Updated 2026-10-22

1. **CityGML 3.0 importer** — ✅ COMPLETE (`scripts/geospatial/citygml_to_3dtiles.py`)
2. **VRAM telemetry** — ✅ COMPLETE (wired into `Tiles3DRendererLayer`, 2026-10-19)
3. **WebGPU mesh extraction** — ✅ RESOLVED as permanent CPU bridge (documented 2026-10-22; GPU path not needed for offline-baked terrain)
4. **PBR baking run** — ⏳ BLOCKED on Blender installation (user action; script ready and test-verified)
5. **Transvoxel tables** — ⚠️ PARTIAL (framework yields 100 classes via D4; full Lengyel 73-class classification not implemented; tracked in NOT-COMPLETE registry item #2)
