# Posey FEMA-effective polygon evidence capture (2026-11-16)

**Status: implementation under review, not a FEMA submission or approval.** An official NFHL record is evidence of a *mapped designation*, not proof a home is misclassified.

## Verified FEMA inputs

Official service: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer

- FIRM Panels (layer **3**, S_FIRM_Pan): a live query on November 16, 2026 for DFIRM_ID = 18129C returned **35** panels. An attribute query returned the same 35 IDs as the pinned September 30 panel registry and effective date **November 5, 2014**. [Live count](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/3/query?where=DFIRM_ID%3D%2718129C%27&returnCountOnly=true&f=json).
- Flood Hazard Zones (layer **28**, S_Fld_Haz_Ar): a live query for the same DFIRM_ID returned **123** polygon features. [Live count](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?where=DFIRM_ID%3D%2718129C%27&returnCountOnly=true&f=json).
- Actual sampled GeoJSON attributes include FIRM_PAN, EFF_DATE, OBJECTID, FLD_ZONE, ZONE_SUBTY, SFHA_TF and STATIC_BFE. A null datum or sentinel STATIC_BFE = -9999 must **not** be converted into a regulatory flood elevation.
- LOMAs live in layer **34** and LOMRs in layer **1**, corrected in PR #621 on main; these are map changes, not flood-zone polygons. Parcel-specific historical amendments must be reviewed separately.

This document is an inventory report, **not evidence that downloaded full source polygon geometry or a live parcel assessment has already completed**.

## New headless reproduction path

The software captures official FEMA GeoJSON geometries using an exact DFIRM_ID filter, queries source object IDs and the independent source count, verifies all source OBJECTIDs and county IDs, bounds each download, and writes per-chunk SHA-256 receipts. It rejects missing/duplicate features, unexpected CRS or schema, truncated chunks, and edited files. Retrieval and rendering remain separate.

Acquire:

    python tools/geospatial_exchange/posey_nfhl_effective_geometry.py acquire \
      --out /tmp/posey-nfhl-20261116 --page-size 10

Verify independently without the network:

    python tools/geospatial_exchange/posey_nfhl_effective_geometry.py verify \
      --snapshot /tmp/posey-nfhl-20261116

Screen Posey parcel areas against the verified NFHL snapshot:

    python -m pip install shapely==2.0.6 numpy==2.1.3
    python tools/geospatial_exchange/posey_nfhl_effective_geometry.py screen \
      --snapshot /tmp/posey-nfhl-20261116 \
      --parcels data/posey-county/parcels/posey-parcels-2025.geojson \
      --registry data/posey-county/offline/2026-09-30/fema-effective-firm-panels-18129C.json \
      --out /tmp/posey-fema-screening.json

A parcel only receives positive/negative FEMA-SFHA **area-overlap** status if the complete panel and flood-zone polygon inventory covers its geometry. Missing boundaries, invalid geometry, missing source IDs, unknown zone flags or disagreements with the previous 35-panel inventory produce explicit REVIEW/INCOMPLETE results. Boundary contact alone is not positive-area overlap. The parcel report never invents BFE, LAG, legal grade, fill history, survey accuracy, or an NFIP regulatory result.

The new workflow saves source geometries, their manifests, and the parcel report as a separately downloadable **Actions artifact** after a successful live job. No such artifact should be claimed until checked against the actual workflow run, source checksums and complete list of 35 panels/123 current hazard records.

## What evidence can demonstrate a possibly erroneous FEMA classification?

For each property, retain exact parcel and building-footprint identity, the controlling FEMA effective panel/version and any LOMCs, the structure/SFHA overlap geometry, zone/floodway, valid local BFE source, surveyed or eligible LiDAR-based ground elevations (not roof heights), horizontal/vertical datum, independent survey accuracy or applicable LiDAR quality evidence, and an identifiable owner-authorized FEMA application route. A DNR BAFL/FEMA NFHL difference by itself is **not** proof of an error.

FEMA's [November 2024 MT-1 Technical Guidance, Section 5](https://www.fema.gov/sites/default/files/documents/fema_guidance_mt-1_technical_guidance_nov_2024.pdf) allows certain LOMA requests using publicly accessible government LiDAR at USGS Quality Level 3 or better. FEMA's published procedure deducts **2 feet** from the lowest appropriate LiDAR point for LAG/LLE; for contours, it deducts the greater of half the contour interval or **1 foot**. Do not apply the 2-foot deduction to a parcel-centroid DEM, publish an automatically adjusted regulatory LAG, or assume LiDAR is allowed for a request involving fill, a regulated floodway, conditional requests, Zones AO/AR/A99, and other excluded categories. FEMA considers existing certified elevations and can require new certified measurements.

## Subsurface evidence is context, not FEMA elevation proof

TSM already has a Posey subsurface context join. Authoritative sources:

- [Indiana DNR Water Well Search Help](https://www.in.gov/dnr/water/ground-water-wells/water-well-record-database/database-search-help/) explains that **UTM Only is not field verification**. Estimated as well as verified records may have UTM coordinates; historical DNR database UTM coordinates use NAD27, Zone 16. Use the recorded location-method field, not coordinate presence, and preserve transformation provenance.
- [DNR source well locations](https://gisdata.in.gov/server/rest/services/Hosted/WaterWells_DNR_Water_IN_1/FeatureServer/0) provide source ID, measured-versus-estimated location context and header depths. Lithology intervals, if separately obtained from official wells.txt and litho.txt exports, join by well refno. Do not manufacture intervals.
- [USDA NRCS SSURGO](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo) map-unit polygons do not constitute a geotechnical boring or guaranteed site-specific Ksat/USCS.
- [IDEM Institutional Controls](https://www.in.gov/idem/cleanups/investigation-and-cleanup-programs/institutional-controls/) require reviewing the underlying legal instrument; absence from an incomplete snapshot is not proof a site is uncontaminated.

Official DNR bulk well-text exports may have per-record fees. The public twin should provide free metadata links and downloads where permitted, without promising unrestricted zero-cost full lithology files.

## Acceptance gates

1. Actual downloaded official FEMA polygons, count and OBJECTID inventory verified with recorded SHA-256.
2. Old 35-panel registry reconciled to current FEMA panels, or source drift marked REVIEW.
3. Every parcel result explicitly distinguishes FEMA mapped SFHA overlap from incomplete source coverage.
4. LOMA eligibility, map misclassification, hazard exclusion and elevation certification remain **undetermined** unless separate defensible site and agency evidence is reviewed.
5. Actions live job and hosted artifact independently verified; no binary publication claims based only on code tests.
6. Native parcel UI integration, headed render and offline startup require their own release evidence; this tool does not close those gates.
