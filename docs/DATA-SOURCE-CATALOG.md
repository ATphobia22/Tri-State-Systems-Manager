# Tri-State Systems Manager — Authoritative Data Source Catalog

**Status:** Production source registry  
**Updated:** 2026-09-30

This catalog defines external sources that may supply hydrologic, regulatory-reference, scientific, or geospatial data to TSM. **Posey County offline operation is snapshot-first:** the newest suitable agency product is acquired, dated, hashed, and frozen. A live service may be used to obtain a snapshot, but the offline runtime does not depend on a live API.


## Posey County offline authoritative acquisition

The source catalog is paired with a reproducible offline acquisition pipeline at scripts/posey/download-offline-authoritative-data.ps1 and .github/workflows/posey-offline-data.yml. It freezes county-scoped FEMA, Indiana DNR/GIO, USGS/NOAA and USACE products with per-file SHA-256 receipts. Authority classes remain separate and retrieval time is never treated as product vintage.

For very large raw products such as 3DEP LAZ and current statewide imagery, the offline package freezes the exact official product/service index and asset endpoints rather than committing multi-gigabyte source data to Git. Raw extraction is materialized and hashed on the acquisition host.

## Posey authoritative vintage manifest

The current Posey source-selection contract is:

`data/posey-county/authoritative-source-vintage-v1.json`

It records the agency, authority class, newest-vintage selection rule, official source URL, product/model lineage, and required SHA-256/provenance fields. This replaces any implicit open/closed data-system assumption with a deterministic **dated authoritative snapshot** model.

### Authority planes

| Authority | Posey default | Use |
|---|---|---|
| FEMA | Effective NFHL/FIRM/FIS product with the newest applicable effective date | Effective flood-hazard / insurance reference |
| USGS | Newest available Posey 3DEP terrain plus USGS New Harmony hydrology/inundation evidence | Scientific terrain/hydrology evidence |
| Indiana DNR | Newest published Posey BAFL/INFIP product | State planning/regulatory context |
| Indiana GIO | Newest published/current imagery, parcel, and elevation-program product | State geospatial framework |
| USACE | Newest per-record National Levee Database data plus pinned HEC-RAS release/model artifacts | Levee evidence and hydraulic computation |

**Important:** “newest available” means newest according to the source's own publication/acquisition/product metadata. Retrieval date alone is never treated as product vintage.

## Federal sources

| Source ID | Authority | Primary endpoint | Data | Class / boundary |
|---|---|---|---|---|
| `USGS-NWIS-IV` | U.S. Geological Survey | `https://waterservices.usgs.gov/nwis/iv/` — **RETIRED 2026-02-22**; current endpoint `https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items` | Historical/instantaneous stage and discharge | Observation snapshot; raw stage remains GAGE_DATUM |
| `USGS-TNM` | U.S. Geological Survey National Map | `https://tnmaccess.nationalmap.gov/` | 3DEP lidar, DEM and related products | Scientific/geospatial acquisition |
| `USGS-3DEP-LIDAREXPLORER` | U.S. Geological Survey | `https://www.usgs.gov/tools/lidarexplorer` | Current lidar/DEM/topobathymetry discovery | Scientific/geospatial acquisition |
| `FEMA-NFHL` | Federal Emergency Management Agency | `https://hazards.fema.gov/arcgis/rest/services/FIRMette/NFHLREST_FIRMette/MapServer` | Effective FIRM panels, zones, BFEs, cross sections, levees and map-change layers | FEMA effective reference |
| `USACE-NLD` | U.S. Army Corps of Engineers | `https://levees.sec.usace.army.mil/data-services/services/` | National Levee Database | Levee evidence |
| `USACE-HEC-RAS` | U.S. Army Corps of Engineers HEC | `https://www.hec.usace.army.mil/software/hec-ras/` | Hydraulic computation/model interoperability | Modeling capability; solver version pinned separately |

## Indiana sources

| Source ID | Authority | Primary endpoint | Data | Class / boundary |
|---|---|---|---|---|
| `IDNR-BAFL` | Indiana DNR Division of Water | Indiana Floodplain Information Portal / BAFL services | State flood hazard, BFE/floodway and elevation references | State planning/regulatory context |
| `IDNR-INFIP` | Indiana DNR | `https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/` | FEMA + state floodplain mapping and FARA reference | State reference service |
| `INDIANA-PARCELS-2025` | Indiana Geographic Information Office / Indiana local governments | `https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0` | 2025 statewide parcel framework | Current cadastral framework |
| `INDIANA-CURRENT-IMAGERY` | Indiana Geographic Information Office | `https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer` | Current statewide orthoimagery | Current imagery snapshot |
| `INDIANA-IMAGERY-LIDAR-PROGRAM` | Indiana Geographic Information Office / Woolpert | `https://www.in.gov/gis/geoinsights/posts/imagery-and-elevation-roadshows-march-2026/` | 2025–2028 imagery and QL1 LiDAR acquisition program | County-specific acquisition/QA metadata required |
| `INDIANA-POSEY-CSLF-2025` | Indiana Geographic Information Office | `https://gisdata.in.gov/server/rest/services/Hosted/Posey_CSLF_Feb2025/FeatureServer` | Posey Changes Since Last FIRM preliminary/pending mapping | Pending regulatory reference; not effective FEMA mapping |


### Verified Posey framework endpoints

The offline acquisition contract uses these verified 2025 Indiana GIO services for Posey County:

- Address Points of Indiana 2025, layer 0: https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2025/FeatureServer/0
- Road Centerlines of Indiana 2025, layer 0: https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2025/FeatureServer/0
- Administrative Boundaries of Indiana 2025, CountyCommissionerPolygon layer 3: https://gisdata.in.gov/server/rest/services/Hosted/Administrative_Boundaries_of_Indiana_2025/FeatureServer/3
- Current Indiana imagery: https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer
- 2025–2028 orthoimagery tier service: https://gisdata.in.gov/server/rest/services/Hosted/Orthoimagery_Tier_Map_2025_2028/FeatureServer

The Indiana service directory and service records document these 2025 framework products and their publication metadata.

## Historical/reference sources

Historical scans, 2017–2020 LiDAR, and older source packages remain useful for change detection and reconciliation, but they are explicitly superseded by newer authoritative products when a newer agency vintage exists.

## Snapshot rules

1. Store source identifier, official URL, product identifier, publication/acquisition date, retrieval timestamp, native CRS, vertical datum, model/software version, and SHA-256.
2. Freeze the selected source package for offline use; never label a frozen snapshot as live.
3. FEMA effective mapping and Indiana BAFL remain separate authority classes.
4. USGS terrain/hydrology products are scientific evidence, not FEMA regulatory determinations.
5. USACE NLD is evidence; each levee record retains its own Data Last Updated and Last Assessment Date.
6. HEC-RAS version is software provenance, not source-data vintage.
7. Historical/user-provided material cannot silently override newer agency products.
8. Missing source metadata is an explicit provenance defect; do not synthesize a vintage, datum, BFE, WSE, depth, or velocity.
