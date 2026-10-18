# TSM Open-World Backlog — Task List (2026-10-18)

Priority: P0 blocking production claims · P1 near-term · P2 research · P3 external/optional

## P0 — Integrity / do not claim complete

| ID | Task | Acceptance criteria | Owner artifact |
|----|------|---------------------|----------------|
| P0.1 | Keep Transvoxel status honest | CI/docs must show `SCAFFOLD_NOT_TRANSVOXEL_COMPLETE` until case tables land | `transvoxel_transition_scaffold.py` |
| P0.2 | State-word layout v1 only | Reject unknown `tsmStateWordLayoutVersion`; no production v2 encode | `contracts/tsm-state-word-v1.json` |
| P0.3 | Spatial ≠ hardware Tri-State | No packing of UNLOADED/DORMANT/ACTIVE into LOD word | `spatial-entity-phase.ts` |

## P1 — Close remaining technical gaps

| ID | Task | Acceptance criteria | Depends on |
|----|------|---------------------|------------|
| P1.1 | **Live Cesium SSE A/B (Posey)** | Side-by-side refine decisions within agreed px tolerance on published tileset; document deltas | `geometric-sse.ts`, Posey tileset |
| P1.2 | **Transvoxel transition cells** | Lengyel-style transition faces for \|Δlod\|=1; manifold/watertight check on sample DEM octree | scaffold + DEM pipeline |
| P1.3 | Wire `evaluateSpatialPhase` into tile loader | UNLOADED→DORMANT→ACTIVE driven by distance + SSE + frustum | spatial-entity-phase, tiles renderer |
| P1.4 | Wire `evaluateDegradation` into render loop | VRAM/bandwidth samples mutate T/C/S without dropping D shell | state-word.ts |
| P1.5 | CityJSON → 3D Tiles chain | `citygml_compiler` GeoJSON → existing `build-building-3d-tiles` / implicit builder | citygml_compiler.py |
| P1.6 | Expand compiler semantics | Parse `semantics.surfaces` → full SpaceBoundary rings (not type-only stubs) | citygml_compiler.py |

## P2 — CityGML depth (scoped)

| ID | Task | Acceptance criteria |
|----|------|---------------------|
| P2.1 | Multi-LOD geometry pick | Prefer highest available lod ≤ requested; document mapping to D axis |
| P2.2 | CityGML GML pre-step | Documented CLI: `citygml-tools to-cityjson` → TSM compiler (no reimplement GML) |
| P2.3 | CRS reproject to EPSG:2966 | Optional pyproj step post-compile for Indiana West ftUS |
| P2.4 | Validation report | val3dity / citygml-tools validate invoked in CI on fixtures |

## P3 — CityEngine integration (optional commercial)

| ID | Task | Acceptance criteria |
|----|------|---------------------|
| P3.1 | Define interchange path | CityEngine **does not** natively I/O CityGML/CityJSON; use glTF/FileGDB/OBJ bridge |
| P3.2 | Export recipe | CE → glTF (preferred) or FileGDB multipatch → TSM mesh/tiles pipeline |
| P3.3 | Import footprints | TSM GeoJSON/shapefile lots → CE shapes → CGA rules → export glTF |
| P3.4 | PRT/SDK (only if licensed) | Optional headless RPK generation via CityEngine SDK / prt4cmd |
| P3.5 | Authority labeling | All CE-derived meshes `DERIVED`; never regulatory |

## Explicit non-goals

- Full CityGML 3.0 GML XML compiler / all 17 modules / ADE framework in-repo
- Claiming Transvoxel complete without transition-cell tables
- Vendor CityEngine binary or GPL roofer into the monorepo
