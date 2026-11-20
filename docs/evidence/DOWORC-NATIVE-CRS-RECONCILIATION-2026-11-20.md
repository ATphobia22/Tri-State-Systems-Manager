# DoWORC CRS reconciliation: evidence gate

## Authority and scope

Indiana DNR states that DoWORC locates records using UTM coordinates, but does **not** establish one EPSG code for every embedded webmap service or downloaded county GIS layer. DoWORC record-point locations, hydrogeology county shapefiles, map basemaps, and TSM terrain have distinct provenance. See https://www.in.gov/dnr/water/online-research-center/ and https://www.arcgis.com/home/item.html?id=d0b1b480cb77454f92126b297ac42daf.

TSM source inventory: `data/authorities/indiana-dnr/doworc-hydrogeology-source-urls-20261119.json` lists eight county ZIPs for Posey, Gibson, Vanderburgh, and Warrick. This is an acquisition catalog, not a verified native-CRS inventory.

## Run after acquiring the original files

```sh
python -m pip install pyproj
python scripts/geo/acquire_doworc_hydrogeology_sources.py --output /path/to/doworc
python scripts/geo/audit_doworc_native_crs.py --source-root /path/to/doworc --output /path/to/doworc/native-crs-audit.json
```

The audit reports source archive SHA-256, each .shp/.prj pair, PRJ SHA-256, parsed source WKT, candidate EPSG, and units. Missing or unparseable PRJ fails the audit. A successful parse does **not** prove geospatial alignment, vertical datum, or regulatory validity.

## Mandatory reconciliation

1. Validate all 8 source ZIP hashes and inspect **every** contained shapefile, not one EPSG per county.
2. Obtain source-service spatialReference (wkid/latestWkid), layer metadata, units, record dates and record-level UTM zone/hemisphere/datum from Indiana DNR. Map viewer spatial reference is not automatically the native feature-layer CRS.
3. Keep native CRS and the projected EPSG:2966 target distinct; reproject with PROJ/GDAL only after CRS is verified, recording pipeline, PROJ database/version and grid availability. Check axis order, UTM zone, US-survey-foot versus meter conversion, and known control points.
4. Independently verify vertical datum, vertical units, geoid model and any water-elevation reference; **never** infer NAVD88 from horizontal EPSG or a webmap display.
5. Compare transformed sample control points against official county geometry; report residuals and outliers. Verify extent/FIPS county intersection and feature identifiers.
6. Do not promote `SOURCE_ACQUIRED_UNVALIDATED` to engineering/regulatory use until geometry, CRS, vertical provenance and source identities are reviewed. Keep unknowns visible, not silently coerced.

**Current evidence status:** source list verified in repo; no original ZIP inspection or per-layer EPSG values independently verified in this review. The audit code is staged, not executed on original data. DoWORC UTM wording does not prove EPSG:26916 or EPSG:2966. Human authority final.
