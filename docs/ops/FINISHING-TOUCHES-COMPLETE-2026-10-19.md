# Finishing Touches — COMPLETE (2026-10-19)

## Sealed on main

| Item | Evidence |
|------|----------|
| Tile stream controller + runtime | `tile-stream-controller.ts`, `tile-stream-runtime.ts`, wired in `ThreeDTilesLayer` |
| Geospatial barrel | `tsm-console/src/geospatial/index.ts` |
| Stream unit tests | `tile-stream-controller.test.mjs` |
| Transvoxel Lengyel tables + adaptive mesh | `transvoxel_tables.py`, `transvoxel_transition_mesh.py` |
| Synthetic DEM Stage 1–2 CI | `dem_to_transvoxel_selftest.py` |
| CityJSON → 3D Tiles | `cityjson_to_3d_tiles.py` |
| SSE live cert | `sse_live_cert.py` |
| Ops CI | `geospatial-blueprint-ops.yml` (success on main) |
| Pages deploy concurrency | single `github-pages` lane |

## Explicit local-only (not CI-hosted)

- Full Posey DEM cook via `dem_to_transvoxel.py` requires `DEM_PATH` + rasterio/skimage/trimesh on a machine with the Indiana DEM GeoTIFF.
- CityEngine offline authoring remains optional.

## Authority

DERIVED for all compiled/procedural meshes. Regulatory elevations remain NAVD88 evidence plane only.
