# Posey County release: scientific evidence, building identity and regulatory authority

**Status:** engineering evidence workflow in development. **No site-specific regulatory approval established.**
**Region:** Posey County, Indiana, plus tri-state TNM/NFHL overlap. This document is not
a flood hazard determination, survey, permit, engineering seal, or LOMC.

## 1. Source identity and the 267-feature difference

- Official 2016–2020 Indiana LiDAR-derived footprints: [IGIO FeatureServer/0](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0), ArcGIS item `384f2d5041a14c34bd9e807c568784da`.
- Official metadata: https://www.arcgis.com/sharing/rest/content/items/384f2d5041a14c34bd9e807c568784da/info/metadata/metadata.xml?format=default&output=html
- Archived project-release source: `igio-posey-20261006/posey-buildings-igio-23082.geojson`, 23,082 features, SHA-256 `d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f`.
- Published 3D screening subset: 22,815 features, SHA-256 `27e3cb85de9f8bfcfc51c50488786e79d59bf3ec976855f4644fe98cea394a53`.
- Exact missing 267 archived IDs are in `data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json`.
- `scripts/geospatial/recover_posey_missing_building_candidates.py` queries exactly those IDs from the current official feature service. A successful query recovers **2D candidate polygons**; it does not recover approved heights, survey coordinates, LOD2/3/4 meshes, or regulatory status.
- CI workflow `posey-official-building-candidates.yml` hashes and uploads the retrieved candidates. Full 3D acceptance requires inspected geometry, LiDAR year, height method, source-vintage matching, topology, transformations and tile validator proof.
- The IGIO's own source metadata states these footprints are reference-only and **not** legal documents or surveys.

## 2. Scientific solver coupling acceptance

- `backend/solver_evidence_adapters.py` reads HEC-RAS HDF/log and MODFLOW 6 listing/head/budget/report artifacts; its SWMM function reads actual status report continuity sections and binary-output presence.
- `backend/hydrologic_coupling_acceptance.py` requires **three named solvers**, an explicit solver version, versioned inputs and outputs with SHA-256, CRS and NAVD88 datum, timestep and units, convergence evidence, bounded mass-balance percent error, benchmark time series and RMSE tolerance, and exchange quantity checks. Its unit tests use synthetic fixtures, **not** actual calibration or a run of all three numerical solvers.
- Configured test tolerances are project policy. Do not treat any arbitrary threshold as a USACE, USGS or EPA general acceptance standard.
- USACE HEC-RAS 2D volume accounting guidance: https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/6.4/running-a-model-with-2d-flow-areas/computation-progress-numerical-stability-and-volume-accounting
- USGS MODFLOW 6 listing budget and discrepancy: https://water.usgs.gov/nrp/gwsoftware/ModelMuse/Help/modflow_6_example_running_the_.html
- EPA SWMM official manuals/software: https://www.epa.gov/water-research/storm-water-management-model-swmm

**Actual calibrated coupling remains gated:** verified project-specific boundary conditions,
gauges, cross-sections/channel bathymetry, groundwater heads/conductivities, SWMM
catchment/network definition, observation intervals, model exchange mappings,
water-balance/recharge/flux direction, solver reproducibility and independent QA.

## 3. Regulatory release cannot be self-approved

**FEMA:** Review the effective FIRM/FIS and any intervening LOMC. Formal LOMA, LOMR-F,
CLOMR or LOMR processes require the appropriate FEMA submission and resulting agency-issued
letter, as applicable to the parcel/project. General FEMA MT-1 guidance:
https://www.fema.gov/sites/default/files/documents/fema_guidance_mt-1_technical_guidance_nov_2024.pdf

**Indiana DNR:** The Indiana Floodplain Information Portal (INFIP) and its Floodplain Analysis
and Regulatory Assessment (FARA) apply to certain local permits and FEMA LOMA cases
in Zone A, as well as specific unmapped or flood-prone sites. A FARA report is not
the same as construction authorization or a FEMA map change:
https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/

Indiana approved methodology / H&H model guidance:
https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/general-guidelines-for-the-hydrologic-hydraulic-assessment/

Indiana construction-in-floodway permitting and other state authorizations:
https://www.in.gov/dnr/water/regulatory-permit-programs/

**Local authority:** Verify the relevant community floodplain administrator,
local ordinance and actual local permit after applicable state/federal review.
Do not generalize Posey rules to Kentucky or Illinois parcels.

## 4. Evidence ledger fields required for a release claim

The TSM approval package must retain, at minimum:
`parcel_or_legal_description`, `authority`, `decision_kind`,
`agency_case_number`, `official_decision_document_sha256`, `decision_issue_date`,
`effective_date`, `jurisdiction`, `horizontal_crs`, `vertical_datum`,
`surveyor_or_engineer_provenance`, `source_ids`, `reviewer_identity`,
`reviewer_scope`, and `independent_verification_evidence`.

Absent an authenticated determination from the actual agency, record the status
`NOT_EVIDENCED` and do not publish an assertion of regulatory approval.
An artifact digest establishes integrity, **not** agency authenticity.
