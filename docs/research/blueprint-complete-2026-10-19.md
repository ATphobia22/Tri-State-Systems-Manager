# Open-World Blueprint — COMPLETE (in-scope) — 2026-10-19

## Closed

| Stage | Artifact |
|-------|----------|
| RTC + CRS | `rtc-transform.ts`, `crs-validation.ts` |
| PBR atlases | `pbr-atlas.ts`, `bake-pbr-atlas.py` |
| 16-bit state-word v1 | `contracts/tsm-state-word-v1.json`, `state-word.ts` |
| Spatial Tri-State ≠ hardware | `spatial-entity-phase.ts` |
| Cesium-form SSE + live cert | `geometric-sse.ts`, `sse_live_cert.py` |
| Tile stream wiring P1.3/P1.4 | `tile-stream-controller.ts` |
| Transvoxel tables + adaptive mesh | `transvoxel_tables.py`, `transvoxel_transition_mesh.py`, Lengyel MIT data |
| CityJSON compiler + 3D Tiles chain | `citygml_compiler.py`, `cityjson_to_3d_tiles.py` |
| Morton / soft-min SDF | `morton_keys.py`, `sdf_softmin.py` |

## Explicit non-goals (still out of scope)
- Full CityGML 3.0 GML XML / 17 modules / ADE in-repo
- CityEngine runtime in CI
- Claiming Euclidean SDF Transvoxel production without DEM integration job

## Authority
All compiled city / CE / procedural meshes: `authorityClass=DERIVED`, non-regulatory.
