# Geospatial Scripts

Python and TypeScript tooling for TSM's geospatial data pipelines:
building footprints, 3D Tiles, terrain, LOD2 reconstruction, and
tile-fabric assembly.

## Key pipelines

| Script | Purpose |
|--------|---------|
| `acquire-posey-building-footprints.py` | Fetch IGIO building footprints for Posey County |
| `acquire-and-enrich-igio-posey-buildings.py` | Enrich footprints with heights (observed / Purdue NDHM / derived) |
| `build-building-3d-tiles.py` / `build-terrain-3d-tiles.py` | Emit OGC 3D Tiles 1.1 tilesets |
| `build-building-hlod.py` / `build-hlod-tileset.py` | Hierarchical LOD tilesets with inherited error floors |
| `lod2-batch-reconstruct.py` | Batch LOD2 roof reconstruction (TU Delft 3DBAG plane arrangement) |
| `lod2-ai-automation.py` | AI-assisted LOD2: SAT2LOD2/HEAT guides + classical RANSAC fallback (`--mode classical`, pure numpy) |
| `dem_to_transvoxel.py` | DEM → Transvoxel SDF volume (CPU pipeline) |
| `transvoxel_tables.py` | Lengyel transition-cell classification tables |
| `citygml_to_3dtiles.py` | CityGML 3.0 Space/SpaceBoundary → **nonrenderable** `citygml-features.candidate.json` staging; GLB/3D Tiles generation pending |
| `point_tube.py` | PointTube semantic geometry utility |
| `hecras_georeference.py` | Georeference HEC-RAS cross-sections |
| `tnm_bulk_download.py` | USGS TNM bulk downloader — see `../flood-forecasting/` |

## Conventions

- Vertical datum: **required explicit per-source metadata**; do not assume NAVD88 from a filename, state, or repository default. Before 3D Tiles ECEF placement, transform reviewed orthometric NAVD88 using the applicable geoid and horizontal reference epoch to compatible ellipsoidal heights; preserve source CRS and transformation/grid evidence.
- Regulatory BFE at the anchor site: **369.1 ft NAVD88**
  (FEMA FIS 18129CV000A Table 9 §A). Do not use the retired 375.0 ft
  working target.
- Large rasters stay out of git; see `data/fabrics/` for the chunked
  fabrics and `reassemble.sh` scripts.
- Never fabricate measurements — missing data stays unavailable with
  honest provenance labels (VERIFIED / PROVISIONAL / ESTIMATED).

## Projected Posey parcel geometry quality (review-only)

For an actual staged offline parcel data root containing `layer-manifest.json`,
run this headless audit. It verifies the existing source SHA-256 binding, parcel IDs,
county FIPS and **EPSG:2966 projected polygon topology**:

```bash
python scripts/geospatial/audit_offline_parcel_manifest.py \
  --root /path/to/staged/offline-parcels --require-parcels --check-geometry \
  > parcel-topology-review.json
```

The source files are never mutated. A nonzero exit code means the result requires
review. Diagnostic `make_valid` candidates and planar-area differences are **not**
authorized replacement parcel geometries or FEMA flood-zone determinations. The
optional flag is off for legacy calls; the output reports `geometry_quality: NOT_RUN`
when topology was not inspected. CI tests use artificial fixtures only; a real
accepted run must cite the staged source's actual hash and acquisition metadata.
