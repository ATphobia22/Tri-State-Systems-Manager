# USGS adapter

Registered source families: 3DEP elevation/ImageServer, National Hydrography/NHD, hydrography features, DEM products, and National Map orthoimagery. Preserve source product, acquisition/vintage, horizontal CRS, vertical datum/units, nodata, resolution, and coverage. Elevation profiles and watershed products require explicit geometry, CRS, and algorithm/version; do not treat hydrography lines as surveyed channel geometry.

## Evidence-bearing source families

- Publications Warehouse: publication discovery only; cite a stable publication identifier and hash the actual source document.
- topoView and US Topo: map catalogs with vintage and scale metadata. These cartographic products are not substitutes for 3DEP elevation rasters.
- 3DEP: retain horizontal CRS, vertical datum, units, nodata, resolution, acquisition vintage and byte-level checksum for every raster used.
- 3DHP and NWIS: retain coverage, station identity, parameter, time window and source-response hash.
- Geologic maps: record map scale, unit/legend, publication vintage and source map. Regional mapping is not site-specific geotechnical evidence.
