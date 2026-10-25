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

## 2026-10-25 authoritative-vs-published identity gate

The difference between the expected **23,082** IGIO source features and the
**22,815** published screening features is a **267-feature cardinality gap**.
It does *not* identify which OBJECTIDs differ or establish that they were
dropped during raster sampling: the source vintage, boundary, and feature
identity sets must first be compared. Likewise, the published GeoJSON feature
count is **not** an assertion that the same number of GLB tiles exist.

Use the deterministic audit in read-only mode:

```bash
python scripts/geospatial/reconcile_published_buildings.py \
  --published tsm-console/public/3d-tiles/buildings-3d.json \
  --expected-count 23082 \
  --output artifacts/posey-buildings-count-audit.json
```

That result reports `missingAuthoritativeObjectIds: null` until the matching
official, vintage-pinned source GeoJSON is available. When the official source
is present, run the strict **identity-only** comparison:

```bash
python scripts/geospatial/reconcile_published_buildings.py \
  --published tsm-console/public/3d-tiles/buildings-3d.json \
  --authoritative /path/to/verified-igio-source.geojson \
  --expected-count 23082 --require-complete \
  --output artifacts/posey-buildings-objectid-audit.json
```

Both inputs are hashed SHA-256 and original values are left unchanged. Even a
successful identity comparison means **count and IDs only**; it does not verify
LiDAR heights, geodetic datum conversion, roof geometry or LOD2 acceptance.
Those require the separate `validate_building_acceptance_chain.py` and mesh
validators. Keep incomplete visualization in the `DERIVED /
INFORMATIONAL_ONLY` tier and never use it for survey or permit determinations.
