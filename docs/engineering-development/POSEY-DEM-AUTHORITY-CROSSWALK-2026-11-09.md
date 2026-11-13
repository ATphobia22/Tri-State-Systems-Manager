# Posey DEM authoritative-metadata crosswalk (2026-11-09)

This document distinguishes *source-family* documentation from the **file-specific** evidence needed to approve the Drive-hosted Posey DEM TIFFs for engineering elevation calculations. Do not claim survey/regulatory certification based on the checks below.

## Official source-family references

- [Indiana Spatial Data Portal: 2016–2020 Statewide Elevation Data](https://gis.iu.edu/s/isdp/page/20162020elevation): Indiana QL2 3DEP LiDAR; 2020 collection counties include Posey. General spatial reference section lists EPSG:2965 and EPSG:2966, NAD83, U.S. survey-foot horizontal units, with 2.5-foot DEM resolution.
- [Indiana Spatial Data Portal: Posey County DEM Mosaic](https://gis.iu.edu/s/isdp/item/86422): county=Posey; acquisition=2020; units=Feet; format=IMAGINE. This **county mosaic** is not itself the exact two Drive-hosted COG TIFFs.
- [Indiana Geographic Information Office DEM COG tile footprint metadata](https://www.arcgis.com/sharing/rest/content/items/ff98e3834d464619bd5c8974b0038a13/info/metadata/metadata.xml?format=default&output=html): describes the statewide tile index and Indiana GIO public COG publication.
- [USGS 3DEP datum FAQ](https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model): DEM vertical datum typically NAVD88 but varies by product. **General expectation is not file-specific proof.**

## Verified TIFF-specific observations

| File | SHA-256 | Embedded horizontal CRS | Horizontal pixel step | Vertical-datum metadata |
|---|---|---|---|---|
| `IN2020_26700930_12.tiff` | `1a321bc386e0de8b7cca74ec903fb35ea8fb54e8cdd7e835428210562e173ebb` | EPSG:2968 (NAD83 HARN / Indiana West, ftUS) | 2.5 native coordinate units | not present |
| `IN2020_26850945_12.tiff` | `78f987ad4f93d3680d4500ad0b74542872f83529861b5500863addb61c00d124` | EPSG:2968 (NAD83 HARN / Indiana West, ftUS) | 2.5 native coordinate units | not present |

On November 13, both Drive rasters matched the full SHA-256 of the exact Indiana GIO objects, including the copies in both public Indiana buckets. The raster headers resolve the horizontal CRS to EPSG:2968. Project-level documentation for the West Option states NAVD88, GEOID12B, and U.S. survey foot heights. The published COGs still lack explicit elevation band unit and vertical CRS metadata. Use the source crosswalk when choosing retrieval keys and keep the engineering elevation gate open pending tile-specific vertical documentation.

- [Indiana GIO DEM tile layer](https://gisdata.in.gov/server/rest/services/Hosted/Indiana_DEM_Tile_Footprints/FeatureServer/0)
- [Official tile IN2020_26700930_12](https://gisimageryingov.s3.us-east-2.amazonaws.com/demoptimized/statewide/2020/SPW/2.5ft/IN2020_26700930_12.tif)
- [Official tile IN2020_26850945_12](https://gisimageryingov.s3.us-east-2.amazonaws.com/demoptimized/statewide/2020/SPW/2.5ft/IN2020_26850945_12.tif)
- [USGS West Option delivery report](https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/metadata/IN_Indiana_Statewide_LiDAR_2017_B17/IN_Statewide_Opt2_B6_2017/reports/IN_Statewide_Lidar_Lidar_Report_West_AOI.pdf)
- [West Option and Posey grid crosswalk](../../data/evidence/indiana-west-lidar-posey-source.json)

## Release hold / required next evidence

1. Obtain authoritative COG conversion or tile-specific metadata that names both published keys and establishes vertical units, datum, and geoid.
2. Confirm whether these COGs were reprojected/repacked relative to the Indiana Spatial Data Portal's county mosaic; reconcile EPSG:2968 versus EPSG:2966.
3. Record an approved, reproducible horizontal frame transformation with software/grid versions when translating to project EPSG:2966. **Never** apply a guessed horizontal transform to fill gaps.
4. Preserve the source DEM raw values and block engineering BFE/WSE/FFE comparisons until geodetic and vertical metadata are verified.
5. Re-run the [Posey DEM integrity gate](../../scripts/geospatial/verify_posey_dem_gate.py) with local files, the original download receipt, and output JSON. Do not publish raw private source files.

## Evidence

The [Drive verification receipts](https://drive.google.com/drive/folders/1QvSnec14KQOcdz3-GpFx7dmmf_2YTAZf) cover inspection of the source rasters and datasets. Windows UE5.8 Shipping and clean offline startup require separate packaged-application evidence.
