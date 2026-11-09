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

These raster hashes match the two-source acquisition receipt. The statewide portal's EPSG:2966 reference **does not override** either TIFF's EPSG:2968 header. The archive's exact vertical unit, NAVD88 realization, geoid model, and origin/tile product lineage remain unverified.

## Release hold / required next evidence

1. Obtain authoritative tile-specific COG metadata or acquisition documentation that matches **both file hashes or original tile object keys**, and states the raster-value vertical units/datum.
2. Confirm whether these COGs were reprojected/repacked relative to the Indiana Spatial Data Portal's county mosaic; reconcile EPSG:2968 versus EPSG:2966.
3. Record an approved, reproducible horizontal frame transformation with software/grid versions when translating to project EPSG:2966. **Never** apply a guessed horizontal transform to fill gaps.
4. Preserve the source DEM raw values and block engineering BFE/WSE/FFE comparisons until geodetic and vertical metadata are verified.
5. Re-run the [Posey DEM integrity gate](../../scripts/geospatial/verify_posey_dem_gate.py) with local files, the original download receipt, and output JSON. Do not publish raw private source files.

## Evidence

[Drive verification receipts](https://drive.google.com/drive/folders/1QvSnec14KQOcdz3-GpFx7dmmf_2YTAZf) contain hashes, raster inspection, and exact building geometry reconciliation. This is an integrity milestone, **not** a successful native Windows UE5.8 release.
