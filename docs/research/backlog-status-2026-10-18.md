# Open-world blueprint backlog status (2026-10-18)

| Item | Status | Artifact |
|------|--------|----------|
| Freeze 16-bit layout v1 | **DONE** | `contracts/tsm-state-word-v1.json` |
| Optional M-bits layout | DRAFT only | `contracts/tsm-state-word-v2-draft.json` |
| Spatial Tri-State ≠ hardware | **DONE** | `spatial-entity-phase.ts` |
| Cesium-form SSE (CPU+GPU) | **DONE** (formula) | `geometric-sse.ts`, `lod_sse_select.wgsl` |
| Soft-min volumetric blend | **DONE** | `sdf_softmin.py` |
| Morton implicit keys | **DONE** | `morton_keys.py`, `morton.ts` |
| Implicit tileset builder | **EXISTS** | `build-implicit-tileset.py` |
| CityGML 3.0 / CityJSON compiler | **DONE** (Core+Building subset) | `citygml_compiler.py` |
| Transvoxel transition cells | **SCAFFOLD only** | `transvoxel_transition_scaffold.py` |
| Live Cesium SSE A/B on Posey tileset | **OPEN** | `sse_cesium_ab.py` algebraic only |
| Full GML XML / 17-module ADE | **OUT OF SCOPE** | use citygml-tools + 3DCityDB |
