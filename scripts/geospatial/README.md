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
| `citygml_to_3dtiles.py` | CityGML 3.0 Space/SpaceBoundary → 3D Tiles |
| `point_tube.py` | PointTube semantic geometry utility |
| `hecras_georeference.py` | Georeference HEC-RAS cross-sections |
| `tnm_bulk_download.py` | USGS TNM bulk downloader — see `../flood-forecasting/` |

## Conventions

- Vertical datum: NAVD88 unless a filename says otherwise.
- Regulatory BFE at the anchor site: **369.1 ft NAVD88**
  (FEMA FIS 18129CV000A Table 9 §A). Do not use the retired 375.0 ft
  working target.
- Large rasters stay out of git; see `data/fabrics/` for the chunked
  fabrics and `reassemble.sh` scripts.
- Never fabricate measurements — missing data stays unavailable with
  honest provenance labels (VERIFIED / PROVISIONAL / ESTIMATED).
