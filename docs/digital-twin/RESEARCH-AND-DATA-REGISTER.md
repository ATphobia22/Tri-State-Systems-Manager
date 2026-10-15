# Flood digital twin research and data register

**Research checked:** 2026-10-14  
**Purpose:** Record primary technical references used to design the flood-twin vertical slice. This is a source register and implementation summary, not a certification or a substitute for reading the current upstream documentation.

## Findings that change implementation choices

| Area | Source-backed conclusion | TSM implementation consequence |
|---|---|---|
| Hydraulic modeling | HEC-RAS documents 1D, 2D and coupled workflows, flood mapping and terrain dependencies. | Keep the model package, terrain/bathymetry, boundary conditions, calibration, validation and run outputs as separate hash-linked evidence. |
| Houdini | SideFX describes its Shallow Water Solver as a fast heightfield water/flooding tool and documents resolution/speed stability constraints. | Use for visualization/prototyping and compare against the reviewed solver; do not mark a Houdini render as a validated hydraulic output. |
| Elevation | USGS 3DEP is a product family with product-specific coverage/resolution/metadata, not one universal terrain file. | Select a product for the AOI and preserve source product, CRS, vertical datum, grid resolution, nodata, accuracy and checksum. |
| Gauge data | The USGS Water Data APIs expose continuous values, daily values, monitoring-location and time-series metadata. | Capture site ID, parameter/units, qualifiers, observation timestamps, retrieval timestamp and API request URL. An API response can be provisional or revised. |
| Flood hazard | FEMA NFHL exposes effective flood-hazard mapping and related layers through GIS services; its service is continually updated. | Treat the effective NFHL layer as regulatory reference with service metadata/effective dates, not as a substitute for site-specific modeling. |
| 3D runtime | Cesium for Unreal supports geospatial tiles and documents offline loading constraints and attribution. | Test the exact dataset, plugin and version for offline use; avoid making cloud-hosted access an implicit dependency. |
| Geospatial data contracts | OGC COG and STAC specifications support interoperable raster distribution and catalog metadata. | Prefer tiled, versioned, discoverable source assets and machine-readable metadata; keep original source data and display tiles distinct. |
| Compositing | Natron is an OpenFX-based compositor; EXR/OCIO configuration is a pipeline concern. | Record render working space, EXR channels/bit depth, OCIO config hash, display transform and output encoding. A pretty output is not an engineering artifact. |

## Primary references

These links were scraped/read for their public documentation summaries or retrieved as source pages. Do not assume the full upstream documents are vendored in this repository.

1. **HEC-RAS documentation** — manuals, hydraulic references, application guides and version-specific release notes: https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx
2. **HEC-RAS 2D User's Manual v6.6 (PDF)** — 1D/2D/coupled modeling, terrain and result mapping: https://www.hec.usace.army.mil/software/hec-ras/documentation/HEC-RAS_2D_Users_Manual_v6.6.pdf
3. **USGS Water Data APIs** — API entrypoint and collections for monitoring locations, continuous/daily data and time-series metadata: https://api.waterdata.usgs.gov/
4. **USGS 3DEP** — program/product overview and data access: https://www.usgs.gov/3d-elevation-program
5. **FEMA NFHL GIS Web Services** — effective flood-hazard services and layer metadata: https://hazards.fema.gov/femaportal/wps/portal/NFHLWMS
6. **FEMA NFHL ArcGIS REST service** — https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
7. **Cesium for Unreal reference** — https://cesium.com/learn/cesium-unreal/ref-doc/
8. **Cesium for Unreal FAQ (offline, attribution and data formats)** — https://cesium.com/learn/unreal/unreal-faq/
9. **SideFX Houdini Shallow Water Solver introduction** — https://www.sidefx.com/docs/houdini/heightfields/shallowintro.html
10. **SideFX Houdini heightfields** — https://www.sidefx.com/docs/houdini/heightfields/index.html
11. **BlenderGIS source repository** — https://github.com/domlysz/BlenderGIS
12. **Natron documentation/site** — https://natrongithub.github.io/
13. **OGC Cloud Optimized GeoTIFF** — https://www.ogc.org/standard/cloud-optimized-geotiff/
14. **SpatioTemporal Asset Catalog (STAC)** — https://stacspec.org/
15. **OpenColorIO documentation** — https://opencolorio.org/

## Licensing and storage policy

- This repository contains source links and original TSM-authored summaries; it does not mirror third-party manuals.
- Check the specific dataset's license, terms, attribution, privacy constraints, and redistribution rights before committing data.
- Publicly reachable does not automatically mean redistributable or suitable for operational use.
- Small, stable, legally redistributable fixtures may be checked in. Large elevation rasters, point clouds, HEC-RAS project files, Unreal binary assets, source imagery and EXR sequences should generally be held in content-addressed object storage or release artifacts with a manifest and SHA-256.
- Record source URL, query parameters, retrieval time, HTTP status, ETag/Last-Modified when present, content type, byte length and SHA-256. Preserve the raw response before parsing or transforming it.
- API responses and tiles are snapshots, not timeless facts. Keep a retrieval date and freshness policy.
- Never commit credentials, cookies, signed URLs, API keys, or tokens. Do not write secrets to manifests or logs.

## Unresolved before choosing the pilot AOI

- Which reach and exact AOI can be supported by a defensible baseline, terrain/bathymetry, gauge coverage and calibration data?
- Which 3DEP product and vertical reference are available at the required resolution?
- Which vertical datum transformations and geoid grids are needed, and can they be pinned for air-gapped reproducibility?
- Which HEC-RAS version and solver settings will the modeling team support?
- Which source datasets can be redistributed in an offline bundle?
- Is an Unreal project needed for the initial user value, or does the existing MapLibre/Cesium twin suffice?
- What uncertainty measures and acceptance tolerances will the responsible engineer approve?
