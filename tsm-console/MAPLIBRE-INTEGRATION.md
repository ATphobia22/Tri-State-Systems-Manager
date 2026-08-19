# MapLibre Integration Details

## What is wired

- **Dependency:** `maplibre-gl` in `package.json`
- **Component:** `src/routes/MapLibreMap.tsx`
- **Router:** path `map` → MapLibreMap; path `eoc` → panel EOC view
- **Loader:** `mapTwinLoader` supplies stage + site context

## Runtime behavior

1. On mount, creates `maplibregl.Map` with OSM raster style, pitch 45°, site center.
2. On `load`, adds GeoJSON source `water-mesh` and two `fill-extrusion` layers (water plane, BFE band).
3. Places Marker + Popup (APN, BFE NAVD88).
4. Stage / exaggeration changes call `GeoJSONSource.setData(buildWaterMesh(...))`.
5. Live stage from NOAA/USGS when available; otherwise slider is SIMULATION_DEMO.

## What it is not

- Not HEC-RAS / HEC-HMS results
- Not NFHL polygon overlay (future layer: FEMA NFHL MapServer or BAFM download)
- Not COPC point-cloud rendering (future: load selected S3 COPC tiles for AOI)

## Suggested next layers (authorized separately)

1. FEMA NFHL / BAFM GeoJSON or vector tiles for Posey
2. IGIO Current Imagery ImageServer as raster source
3. Parcel FeatureServer query by APN
4. Terrain hillshade from mosaic/dem for context (derived)

