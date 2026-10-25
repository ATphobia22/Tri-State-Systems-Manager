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

## 2026-10-25 archived IGIO identity gap: IDs verified, recovery pending

The SHA-256-verified **archived project IGIO-labeled snapshot** contains
**23,082** source identities and the published informational GeoJSON contains
**22,815**. An earlier CI run computed and committed the **exact 267 missing
OBJECTIDs** in
`data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json`.
It found **no additional published OBJECTIDs and no duplicates**.

- Identity coverage by count: **22,815 / 23,082 = 98.8433%**.
- Source snapshot SHA-256: `d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f`.
- Published GeoJSON SHA-256: `27e3cb85de9f8bfcfc51c50488786e79d59bf3ec976855f4644fe98cea394a53`.
- Evidence: [CI run 40211424871](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40211424871).
- **Source lineage and vintage are not independently certified** by this
  archive-vs-publication diff; do not describe it as survey verification.

To reproduce the exact pinned identity set difference, use the
`Posey Archived IGIO Building Identity Evidence` GitHub Actions workflow,
which fetches and checks the frozen release asset SHA-256 before running
`scripts/geospatial/verify_archived_posey_delta.py`. The generated
`posey-archived-objectid-remediation` artifact contains each missing
`sourceObjectId` with `rootCause: UNDETERMINED`, explicitly unverified
height, datum and LOD evidence, and no invented coordinates or geometry.

**Still incomplete:** determine the individual exclusion reason for all 267
from original feature/raster processing logs; acquire defensible heights,
source geometry and vertical-datum evidence; regenerate 3D tiles; pass
`validate_building_acceptance_chain.py`, glTF, 3D Tiles, topology and HLOD
validation. Do not call the 22,815 GeoJSON a complete GLB tileset.

The public visualization remains `DERIVED / INFORMATIONAL_ONLY` with
`engineeringUse=false` and `regulatoryUse=false`. Count/OBJECTID equality
would not prove heights, NAVD88, rendering quality or regulatory suitability.
