# Regional AOI source validation notes

**Status:** research notes only; the candidate AOI remains unapproved and no modeling is authorized.

## Source-grounded findings

- **USGS hydrography transition:** USGS states that in 2024 it shifted from maintaining the National Hydrography Dataset (NHD), Watershed Boundary Dataset (WBD), and NHDPlus High Resolution to producing 3D Hydrography Program (3DHP) products. Legacy products remain available as reference downloads/services but are no longer maintained or updated. The registry therefore lists 3DHP as the preferred current discovery path and marks legacy WBD/NHD as reference-only.
  - https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products
  - https://www.usgs.gov/national-hydrography/watershed-boundary-dataset
- **Watershed units do not follow administrative borders:** USGS describes hydrologic units as drainage areas delineated from topographic, hydrologic, and landscape characteristics without regard to administrative or political boundaries. State intersection claims must be computed from versioned state boundary overlays; the GeoJSON property list is not evidence.
  - https://www.usgs.gov/national-hydrography/watershed-boundary-dataset
- **Elevation discovery:** USGS The National Map provides access to 3DEP elevation data and 3DHP/hydrography products through download tools, web services, and viewers. A landing page alone does not establish that a particular AOI has 1 m coverage, QL2 classification, a stated RMSE, zero missing pixels, or NAVD88 vertical datum.
  - https://www.usgs.gov/tools/download-data-maps-national-map
  - https://www.usgs.gov/3d-elevation-program
- **FEMA NFHL:** FEMA describes the National Flood Hazard Layer as a database of current effective flood hazard data and provides GIS services and downloads. It is a reference layer and does not establish that terrain, outlet conditions, or a proposed hydraulic model are valid.
  - https://www.fema.gov/flood-maps/national-flood-hazard-layer
- **USGS water APIs:** USGS Water APIs provide hydrologic data services. Gauge identity, active status, measurement timestamps, units, location, and vertical/reference datum still require live, site-specific checks; a well-formed eight-digit ID or a JSON boolean is not proof of active telemetry.
  - https://api.water.usgs.gov/
  - https://waterdata.usgs.gov/

## Not verified by this research

- Whether candidate HUC-8 `05120113` is the correct hydrologic unit for the supplied polygon.
- Whether the candidate polygon intersects all three states.
- Actual 3DEP tile coverage, point density, quality level, vertical datum, RMSE, voids, or processing history.
- Any adapter endpoint's operational availability, terms of use, data freshness, or SHA-256 registry match.
- Gauge `03378500` live transmission, datum suitability, or relationship to the proposed outlet.
- A physical culvert/headwall survey, engineer seal, or approval scope hash.

## Runtime contract

The gate evaluator is a defensive metadata and structure check. Evidence must be independently fetched and hashed from exact bytes by a trusted ingestion path. A caller-supplied `verified: true` value is not a cryptographic attestation. Passing validation returns `READY_FOR_REVIEW`, never permission to launch HEC-HMS or HEC-RAS. The separate execution service must re-fetch or verify artifacts, compare their hashes, validate geometry overlays and datum consistency, and enforce scope-bound human authorization.

## Candidate AOI

`data/posey-county/aoi/lower-wabash-ohio-core-candidate.geojson` is explicitly marked `CANDIDATE_UNVERIFIED`. Its coordinates and candidate HUC are copied from the supplied proposal, not independently validated. Treat them as a starting hypothesis only.


## ERDC/CHL TR-22-4 — regional confluence reference

The supplied report, *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation* (February 2022), describes a two-dimensional **Adaptive Hydraulics (AdH)** model for the Wabash–Ohio confluence and sediment transport. It is a regional engineering reference, not a HEC-RAS project or a local parcel model.

The report states that the study used NAD83 / UTM Zone 15 North in metres and an “Ohio River” vertical datum; at J. T. Myers Lock and Dam it reports a relationship of NGVD29 −0.35 ft. That conversion is location-specific and must not be applied elsewhere without authoritative datum control. The report also describes a Phase 2 domain extended downstream to Smithland Locks and Dam and a materially detailed bathymetric/mesh model. These study-specific data and geometry are not interchangeable with a 3DEP bare-earth DEM or a residential catchment.

**Boundary-condition method described in the report:** USGS gage 03381700 measures combined Wabash + Ohio flow near Old Shawneetown. The Wabash contribution is the sum of gages 03378500 (Wabash River at New Harmony), 03378550 (Big Creek near Wadesville), and 03381500 (Little Wabash near Carmi). The report derives the J. T. Myers inflow by subtracting the summed Wabash flow from the combined 03381700 flow.

Engineering consequences:
- A single-gauge Wabash boundary CSV is not a reconstruction of this report's regional inflow hydrograph.
- Boundary derivation requires time-aligned observations, explicit units, gap/quality checks, gauge metadata, and review of subtraction residuals; asynchronous daily values must not be silently combined.
- The current `tsm_runtime.boundary_flow_validator` is a generic single-gauge structural screen. It does not implement this four-gauge aggregation method and does not establish that the gauge is live or physically representative.
- The report's AdH mesh, bathymetry, sediment parameters, and boundary conditions must not be copied into HEC-RAS or treated as current inputs without source acquisition, format conversion, datum reconciliation, and independent verification.
- This reference does not validate the candidate Posey County AOI, its HUC assignment, local outlet, flood depth, BFE, design discharge, or permit status.

**Source:** user-supplied file `ERDC-CHL-TR-22-4.pdf`, especially the report abstract and Section 2.3 discussion of Phase 1 mesh/flow data (printed page 9), plus the Phase 2 model-domain discussion. The user-supplied attachment informs this note but is not committed to the repository; source acquisition, exact input hashes, current observations, and model replication remain separate tasks.
