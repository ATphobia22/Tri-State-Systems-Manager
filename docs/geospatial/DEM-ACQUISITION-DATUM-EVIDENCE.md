# Offline DEM acquisition and datum evidence (2026-11-12)

These scripts support bounded terrain acquisition and provenance; they do **not** certify survey elevations.

## Source

Indiana 2016–2020 hydro-flattened bare-earth DEM ImageServer:
https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer

For a complete Posey County acquisition, derive a bounding rectangle from an **authoritative county boundary**, reproject that boundary to EPSG:3857, and use its minx/miny/maxx/maxy in the following command. Bounding rectangles include pixels outside the county; clip against the validated county polygon after acquisition. For IL/KY use authoritative USGS 3DEP or respective state datasets, not the Indiana-only service.

```bash
python -m pip install requests rasterio pyproj numpy
python scripts/geospatial/acquire_indiana_dem_tiles.py \
  --bbox-3857 XMIN YMIN XMAX YMAX \
  --resolution-m 1 --out TSMData/terrain/indiana/posey
```

The script limits tile count, disk transfer and tile dimensions, resumes existing files, hashes TIFFs, and emits `acquisition-manifest.json`. Before relying on the result, inspect the service's original pixel size and source vertical metadata; the ImageServer may resample data to the requested output grid.

```bash
python scripts/geospatial/transform_dem_with_evidence.py \
  TSMData/terrain/indiana/posey/dem_0000_0000.tif \
  --target-crs EPSG:2966 --source-vertical-datum NAVD88 \
  --source-vertical-units m --target-vertical-units m \
  --output TSMData/terrain/posey/terrain_epsg2966.tif \
  --evidence TSMData/terrain/posey/transform-evidence.json
```

The datum and units arguments are **operator assertions**, not proof. Verify original producer metadata, CRS, vertical reference, unit conversion and control points independently. EPSG:2966 is horizontal; NAVD88 and geoid models are separate vertical considerations. Do not treat GEOID12B and GEOID18 as interchangeable, and do not infer a vertical shift from a horizontal reprojection. No HEC-RAS/regulatory decision may be based on unverified outputs.

## Release gates

1. Full source tile coverage and hashes: **pending actual download and spatial coverage check**.
2. Source vertical metadata and control-point comparison: **not evidenced**.
3. 3D building count, heights and mesh validation: **not evidenced by these scripts**.
4. UE5.8 Shipping Windows build, installer and headed network-disabled startup: **require authorized Windows runner and real logs**.

The scripts should run on the authorized runner or an internet-connected data workstation. GitHub Actions is suitable for bounded test AOIs, not an unreviewed multi-GB download committed to git.
