# TSM Data-Plane Integration Contract

**Status:** Production integration contract  
**Date:** 2026-10-01

This document defines how the external authoritative/public datasets are transformed into TSM artifacts across the 15 runtime planes.

## Required chain

`source → acquisition → source validation → provenance capture → SHA-256 → derived artifact → artifact validation → publication → integrity verification → runtime consumption`

A failed mandatory validation is fail-closed. Retrieval time is never substituted for product vintage.

## Source authorities

- **FEMA:** effective NFHL/FIRM/FIS products. FEMA distinguishes current effective flood-hazard data from preliminary/pending/draft products.
- **Indiana DNR:** Best Available Floodplain Mapping and INFIP. These remain a separate state authority class from FEMA NFHL.
- **USGS:** water observations and 3DEP elevation/LiDAR/EPT.
- **NOAA:** National Water Model and related forecast inputs.
- **USACE:** National Levee Database and HEC-RAS modeling documentation/runtime lineage.
- **Indiana GIO:** parcels, current imagery, elevation/imagery acquisition program metadata.

## Artifact classes

Every acquired source or derivative must produce, where applicable:

1. manifest/index
2. SHA-256 checksum
3. schema metadata
4. provenance record
5. browser-optimized derivative
6. vector/raster derivative
7. runtime configuration
8. API binding
9. layer catalog entry
10. validation receipt
11. artifact reference
12. missing-source status
13. reproducible-build metadata

## Browser policy

GitHub Pages receives only browser-safe manifests, indexes, styles, lightweight derived assets, and runtime configuration. Large raw LiDAR, statewide imagery, and other multi-gigabyte source products remain external/offline artifacts and are referenced by immutable metadata.

## Spatial correctness

- Preserve the native horizontal CRS.
- Store vertical datum independently.
- Never perform CRS conversion by arithmetic shortcuts.
- County/AOI clipping must be geometry-based.
- EPT coverage references must be labeled as coverage references, not exact county extracts.
- Derived rasters/vectors must retain lineage to their source artifact IDs.

## Authority correctness

No TSM model result, evidence packet, ledger record, or screening output becomes a FEMA, Indiana DNR, USACE, or other agency determination merely because it is stored or displayed by TSM.

## Current source bindings

- FEMA NFHL: `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`
- FEMA MSC: `https://msc.fema.gov/portal/home`
- Indiana DNR BAFL: `https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Water_PROD/FeatureServer`
- USACE NLD: `https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer`
- USGS Water Data OGC API: `https://api.waterdata.usgs.gov/ogcapi/v1/`
- USGS 3DEP index: `https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer`
- USGS 3DEP AWS EPT catalog: `https://usgs-lidar-stac.s3-us-west-2.amazonaws.com/ept/catalog.json`
- HEC-RAS documentation: `https://www.hec.usace.army.mil/confluence/rasdocs`
- NOAA National Water Model: `https://water.noaa.gov/about/nwm`

## Missing-source state

A source that cannot be acquired, validated, or mapped is represented explicitly as `MISSING`, `INVALID`, or `PENDING`. The runtime must not fabricate a replacement dataset or silently downgrade authority.

The 448/457 offline-bundle figure therefore remains a reconciliation target until the actual bundle inventory is available.
