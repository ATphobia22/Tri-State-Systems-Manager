# Home-Site AOI Completion Checklist — 13101 Bonebank Road

**Assessment date:** 2026-10-15  
**Site ID:** `posey-13101-bonebank-road`  
**Status:** CANDIDATE / NOT APPROVED  
**Purpose:** Operational checklist for converting the existing candidate parcel evidence into a survey-reconciled site AOI, a separately delineated hydrologic catchment, and (only if justified) a hydraulic model domain.

> **Do not mark the AOI approved merely because this checklist is complete or a public map shows Zone AE.** This document tracks evidence requirements; it is not a survey, FEMA determination, permit, or engineering certification.

## Current candidate record

- Address: 13101 Bonebank Road, Mount Vernon, IN 47620, Posey County.
- Candidate parcel ID: `65-19-08-100-008.001-010`; IGIO object ID `335325`.
- Source parcel layer: [IGIO Parcel Boundaries of Indiana 2025](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0).
- Candidate parcel geometry: `data/posey-county/aoi/13101-bonebank-road-parcel.geojson`.
- Polygon-derived area: approximately 9,895.75 m² / 2.4453 acres; **not surveyed acreage and not drainage area**.
- IGIO parcel centroid: `(-88.00535128, 37.84579909)`, EPSG:4326; live IGIO query returned the exact candidate parcel ID and situs address.
- Conflicting legacy point: `(-88.0007, 37.9035)`, approximately **3.99 miles / 6.42 km** away. It is rejected as the working point for this address's AOI; its provenance remains unverified.
- USGS EPQS: the prior `361.998 ft NAVD88` value is not currently accepted. A live connector refresh returned unit-labelled values inconsistent with the request, so the values are quarantined pending raw-response verification.
- Flood mapping: live Indiana CSLF point query intersects polygon `cslf_id=3785` (`pre_zone=AE`, `new_zone=AE`, source `STUDY10`). Prior FEMA NFHL point result recorded Zone AE/SFHA with `STATIC_BFE=-9999`; `-9999` is a no-data sentinel, not a BFE. The state polygon query returned no BFE observation.
- Catchment: not delineated; no verified outlet.
- HEC-HMS / HEC-RAS: `BLOCKED_NOT_RUN`.

## Gate register

| Gate | Required evidence / action | Evidence artifact | Exit criterion | State |
|---|---|---|---|---|
| G0 — Site identity | Live IGIO parcel service matches the user-designated address and candidate parcel ID. Confirm the actual house/structure footprint separately against current imagery, county structure data, or survey evidence. | `data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json` | Address/parcel match verified; structure footprint independently identified | PARTIALLY RESOLVED |
| G1 — Horizontal boundary | Compare IGIO geometry with county assessor/GIS and deed/survey/plat if available. Validate parcel identifier and corner locations; preserve source date and SHA-256. | Boundary comparison note; source files and hashes | Discrepancies documented; legal boundary reviewed by qualified surveyor where needed | OPEN |
| G2 — Coordinate conflict | Use the live exact-address IGIO record as the working GIS reference; retain legacy point `(-88.0007, 37.9035)` as rejected for this candidate AOI, while recording its unknown provenance. Confirm the structure point separately. | `data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json` | Parcel/address reference selected; legacy point not reused; actual structure location separately verified | RESOLVED FOR WORKING PARCEL REFERENCE; STRUCTURE POINT OPEN |
| G3 — Site topography | TNM Access API found a 1-meter Indiana Statewide LiDAR DEM tile covering the candidate parcel bbox. Download and hash the GeoTIFF; verify metadata, voids, vertical datum, seams, local artifacts, and coverage. Then inspect parcel and nearby flow paths, not just a centroid. Obtain survey/spot grades for design-grade decisions. | [Live query evidence](../../data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json); [USGS product metadata](https://www.sciencebase.gov/catalog/item/60e6aebcd34e2a7685d0271b) | Raster asset downloaded and hashed; quality and vertical datum verified; suitable for screening scale | PARTIALLY RESOLVED — CATALOG MATCH ONLY |
| G4 — Regulatory flood data | Live state-layer point intersection is Zone AE (`cslf_id=3785`, source `STUDY10`); now obtain effective FEMA FIRM panel/LOMC and review the full parcel and actual structure footprint in FEMA MSC and Indiana INFIP. Generate/save FARA if applicable. | Live query snapshot plus effective map/FARA and GIS extracts with timestamps | Effective panel/date, floodway status, parcel/structure overlay, and any usable BFE/datum checked; missing/sentinel values remain null | PARTIALLY RESOLVED |
| G5 — Drainage outlet | Identify the specific receiving ditch/stream/culvert/outfall and the point where contributing runoff should be measured. Confirm the outlet using terrain, hydrography, aerial imagery, and field evidence. | Outlet point with coordinates, rationale, photo/field notes if available | Outlet location and purpose reviewed and approved | OPEN |
| G6 — Catchment delineation | Use suitable conditioned DEM plus current hydrography and culvert/burn-in evidence; delineate to approved outlet. Cross-check against USGS StreamStats / current SS-Delineate workflow where applicable and inspect boundaries for flat terrain, road embankments, tile drainage, and artificial conveyances. | Catchment polygon, processing script/config, DEM/hydrography lineage, QC map | Closed polygon, CRS, area, outlet, method, input hashes, and independent visual/quantitative QC retained | BLOCKED BY G0–G5 |
| G7 — Hydrologic inputs | Select design storms / precipitation depths from NOAA Atlas 14 with duration, frequency/AEP, temporal distribution, losses, transform, baseflow, imperviousness, soils, land cover, and routing justified for the catchment. Document any local/state coordinated flow data. | Input manifest and assumptions ledger | Each model input is sourced, versioned, unit-checked, and reviewed | BLOCKED |
| G8 — Hydraulic inputs (if needed) | Define the question first. Acquire cross-sections/terrain, channel bathymetry, structures, roughness, downstream boundary, flow regime, and datum-consistent BFE/observations. Determine whether an existing DNR/FEMA/USACE study is applicable before building a new model. | RAS geometry/plan, source inventory, datum audit, calibration/validation plan | Complete domain and boundary conditions independently reviewed | BLOCKED |
| G9 — Model execution | Run HMS/RAS only after inputs and the modeled question are approved. Pin solver version, config, seeds/parameters, input hashes, run logs, warnings, and outputs. | Reproducible run bundle | No unresolved critical warnings; results pass independent checks | NOT AUTHORIZED |
| G10 — Review and approval | Qualified hydrologist/engineer reviews assumptions, calibration/validation, sensitivity, uncertainty, and intended use. Property/legal boundary review remains separate from engineering approval. | Signed review record and limitations | Explicit named approval and date; approved scope recorded | NOT APPROVED |

## Latest live evidence

- Snapshot: [live query evidence JSON](../../data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json).
- Verified: exact IGIO parcel/address match; live Indiana CSLF Zone AE point intersection.
- Corrected: legacy point rejected for this address's candidate AOI; EPQS numeric outputs quarantined because the research connector returned inconsistent units.
- Not completed: survey boundary check, structure footprint, DEM asset download/hash/QA, effective FEMA panel/BFE/FARA, drainage outlet, catchment, model inputs, and professional review.

## Terrain product found (not yet acquired)

The USGS TNM Access API returned a candidate 1-meter tile, **USGS 1 Meter 16 x41y419 IN_Indiana_Statewide_LiDAR_2017_B17**, whose published bounding box covers the candidate parcel. USGS ScienceBase metadata reports a bare-earth DEM, 1 m nominal resolution, elevations in meters referenced to NAVD88, and source acquisition dates 2017-03-03 through 2020-04-11. The raster itself has not been downloaded or inspected; the DEM gate remains partially open. USGS notes that 1-meter DEM tiles may not be seamless across collection-project boundaries.

## Authoritative source inventory

1. **Parcel boundary:** [IGIO 2025 Parcel Boundaries FeatureServer](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0). Use as a candidate GIS parcel source, not as a legal survey.
2. **Elevation:** [USGS 3DEP / The National Map](https://www.usgs.gov/3d-elevation-program) and [Elevation Point Query Service](https://epqs.nationalmap.gov/v1/json). EPQS is an interpolated point result and is not survey-grade.
3. **Hydrography:** [USGS 3D Hydrography Program data access](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products). USGS states it shifted in 2024 from maintaining legacy NHD/WBD/NHDPlus HR to 3DHP products; legacy products remain available but are no longer updated/maintained. Record which vintage/product is used.
4. **Catchment screening:** [Indiana StreamStats](https://www.usgs.gov/streamstats/indiana-streamstats) and [StreamStats application](https://streamstats.usgs.gov/ss/). Review the equation applicability and error documentation before treating estimated flows as design values. The legacy services documentation announces migration toward SS-Delineate / SS-Hydro; verify the current endpoint before coding an integration.
5. **Federal regulatory flood mapping:** [FEMA Map Service Center](https://msc.fema.gov/portal/home) and [FEMA NFHL MapServer](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer).
6. **Indiana regulatory screening:** [Indiana Floodplain Information Portal (INFIP)](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/) and [Indiana Best Available Floodplain Mapping](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping). Indiana DNR says a Floodplain Analysis and Regulatory Assessment (FARA) is required for local floodplain permitting and FEMA LOMA applications in A zones, and for certain regulatory determinations including upstream drainage areas greater than 1 square mile, unmapped areas, or known flood-prone areas. Confirm the applicable situation with DNR/local floodplain administrator.
7. **Precipitation frequency:** [NOAA Atlas 14 Precipitation Frequency Data Server](https://hdsc.nws.noaa.gov/pfds/).
8. **Hydrologic model:** [USACE HEC-HMS](https://www.hec.usace.army.mil/software/hec-hms/).
9. **Hydraulic model:** [USACE HEC-RAS](https://www.hec.usace.army.mil/software/hec-ras/).
10. **Regional confluence context:** [ERDC/CHL TR-22-4](https://erdc-library.erdc.dren.mil/handle/11681/43441), *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation* (2022). This is regional methodological context, not a transferable parcel model. Preserve the report's stated vertical datum (Ohio River Datum) unless a documented conversion is performed.

## Required data-quality rules

- Keep the parcel polygon, structure footprint, local drainage catchment, and hydraulic/inundation model domain as four distinct geometries with explicit roles.
- Store horizontal CRS, vertical datum, units, native resolution, acquisition/effective date, retrieval timestamp, source URL, processing steps, no-data interpretation, quality flags, and SHA-256 for retained files.
- Never convert `-9999` or another sentinel into a numeric elevation/depth. Normalize it to null and preserve the raw value separately.
- Do not combine NAVD88, Ohio River Datum, NGVD29, ellipsoidal heights, or local construction datums without a cited conversion method and uncertainty.
- Do not infer a BFE, flood depth, velocity, annual flood probability at the structure, drainage area, or design discharge from a parcel-centroid point query.
- Do not use the parcel area as the catchment area.
- A map-service response or model run is evidence of processing, not evidence that the inputs or result are fit for the intended decision.
- If public sources conflict, retain both observations with timestamps and open a resolution task; never overwrite one source with an unsupported guess.

## Immediate next actions

1. Obtain/confirm the parcel and site reference, and resolve the 6.42 km coordinate discrepancy.
2. Download and inspect the best available 3DEP DEM and metadata for the actual parcel/outlet area; generate a terrain coverage/quality map.
3. Review the full parcel and structure footprint against effective FEMA and Indiana DNR flood layers; obtain/save INFIP FARA if applicable.
4. Identify and verify the runoff outlet; only then delineate the catchment and QA its boundary.
5. Build a versioned source/assumption manifest; evaluate whether a regulatory or existing model already answers the question.
6. Keep HEC-HMS/RAS blocked until the engineering question, inputs, datum, and review path are approved.

## Decision

**The candidate parcel evidence is useful and traceable, but the home-site AOI is not yet complete for hydrologic modeling.** The unresolved site-coordinate conflict and unverified drainage outlet are hard blockers. No design conclusion is authorized by this checklist.
