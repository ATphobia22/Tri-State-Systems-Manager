# Building GLB subset inventory

**Authority:** DERIVED only (`engineeringUse=false`, `regulatoryUse=false`).

| Layer | Count | Path |
|-------|------:|------|
| GeoJSON features (`height_m`, `achievedLod`) | **22,815** | `tsm-console/public/3d-tiles/buildings-3d.json` |
| LOD2 roof planes (RANSAC) | **7,453** | properties on GeoJSON features |
| LOD1 resilient remainder | **15,362** | no fabricated roof geometry |
| Mesh GLBs (LOD1 prisms / meshes) | **~4,121** | `tsm-console/public/3d-tiles/buildings/<sourceObjectId>.glb` |
| IGIO CI acquire target | **23,082** | `acquire-and-enrich-igio-posey-buildings.py --expected-count` |

## Selection rule (GLB vs GeoJSON)

- **GeoJSON** is the complete screening set for MapLibre fill-extrusion / console (`height_m` preferred).
- **GLB tiles** are generated only for features with valid geometry + ground elevation samples suitable for prism extrusion; filenames equal `sourceObjectId`.
- Not every GeoJSON feature has a GLB. Do not assume 1:1.
- `tileset.json` root content currently references `buildings-3d.json` for the published 3D Tiles 1.1 screening payload; individual GLBs support mesh viewers / offline packages.

## Console wiring

`tsm-console/src/lib/buildingsService.ts` → `normalizeBuildingHeight()` prefers `height_m` before `height` / floor heuristics.
