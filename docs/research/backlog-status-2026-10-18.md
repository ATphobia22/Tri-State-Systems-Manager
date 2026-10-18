# Open-world blueprint backlog status (2026-10-18)

| Item | Status | Artifact |
|------|--------|----------|
| Freeze 16-bit layout v1 | **DONE** | `contracts/tsm-state-word-v1.json` |
| Optional M-bits layout | DRAFT only | `contracts/tsm-state-word-v2-draft.json` |
| Spatial Tri-State ≠ hardware | **DONE** | `spatial-entity-phase.ts`, `docs/architecture/spatial-vs-hardware-tristate.md` |
| Cesium-form SSE (CPU+GPU) | **DONE** (formula) | `geometric-sse.ts`, `lod_sse_select.wgsl` |
| Soft-min volumetric blend | **DONE** (utility) | `scripts/geospatial/sdf_softmin.py` |
| Morton implicit keys | **DONE** (utility) | `morton_keys.py`, `morton.ts` |
| Implicit tileset builder | **EXISTS** | `scripts/geospatial/build-implicit-tileset.py` |
| True Transvoxel transition cells | **SCAFFOLD only** | `transvoxel_transition_scaffold.py` |
| CityGML 3.0 compiler | **OPEN** | — |
| Production GPU SSE certification vs Cesium | **OPEN** | needs Posey tileset A/B |

Immediate hardening order (1)(2)(3): complete on `main`.
