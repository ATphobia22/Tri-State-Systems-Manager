# Hydrology and hydraulics release contract

**Status:** Implemented software contracts; scientific/operational release remains gated.  
**Updated:** 2026-10-15  
**Authority:** Engineering decision support only; this document is not a model certification, permit determination, or operational flood warning.

## 1. Release decision

TSM hydrology software is not fully released merely because an ingestion endpoint, runoff function, map layer, or build succeeds. A hydrology release requires a named pilot area of interest (AOI), source-complete inputs, datum integrity, reproducible model artifacts, independent validation, and human engineering review. No AOI or hydraulic result may be silently inferred from the repository's regional focus.

Current status is **BLOCKED for production hydraulic conclusions** until all applicable gates below have retained evidence. The NOAA CloudGIS integration merged by PR #267 adds context overlays and source-verification tooling; it does not close the hydraulic-model gates.

A candidate parcel has since been recorded for **13101 Bonebank Road, Mount Vernon, Indiana** using the Indiana Geographic Information Office parcel geometry, one USGS EPQS centroid elevation sample, and point-intersection checks against FEMA NFHL and Indiana DNR flood-hazard layers. This is a **parcel candidate, not an approved hydrologic AOI**: no outlet or contributing watershed is approved, no BFE was returned by the point queries, and no HEC model has been run. See [candidate AOI assessment](aoi/13101-BONEBANK-ROAD-CANDIDATE.md), [source evidence](../../data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json), and the [DRAFT coupled-run manifest](../../data/posey-county/hec/13101-bonebank-road-candidate-run-manifest-v2.json).

## 2. Source-data contract

For every observation, forecast, rainfall product, terrain surface, bathymetry surface, and model output, retain:

- Stable source identifier and exact source URI.
- Retrieval time and source observation/forecast/valid time, including timezone.
- Provider, product/version, quality flags, provisional status, and freshness state.
- Horizontal CRS, vertical datum where applicable, native units, and explicit conversion method/version.
- Coverage/AOI, nodata/sentinel handling, transformation lineage, and SHA-256 when retained.
- License/terms and retention decision.
- Authority class (OBSERVED, FORECAST, DERIVED, MODELLED, SCENARIO, or REGULATORY) and review status.

Unavailable, stale, provisional, invalid, or datum-ambiguous values must remain explicitly qualified. They must not be replaced by synthetic values or silently promoted to authoritative data.

### Source semantics

- NOAA/NWS NWPS observations and forecasts are separate products and must remain separately timestamped and labeled.
- USGS gage measurements remain in the source gage datum until a documented, independently verified conversion is available. Never compare a raw gage-zero value directly with NAVD88 elevations.
- NOAA radar reflectivity (CREF/QCD, dBZ) is not rainfall accumulation and is not a flood-depth product.
- MRMS QPE accumulation windows are estimates with explicit window semantics. A fixed-window, non-time-enabled image service is not a time series and must not be used as hydraulic forcing without a separately validated temporal conversion, coverage/nodata policy, and model input record.
- FEMA effective NFHL, Indiana best-available flood mapping, warnings, observations, forecasts, and modeled inundation remain distinct authority classes.

## 3. Rainfall-runoff model contract

The current SCS Curve Number implementation at tsm-console/src/lib/hydrology-runoff.ts is a lumped event-method primitive. Its documented assumptions include a uniform curve number and rainfall over the watershed, the standard initial abstraction ratio, no channel routing, no baseflow, and no antecedent-moisture adjustment. Its interval discharge is not a routed flood wave.

Before a runoff result can be used in an engineering conclusion, retain:

1. AOI polygon and independently checked watershed area.
2. Provenance and justification for curve number, land-cover, and hydrologic soil group inputs.
3. Rainfall source, interval semantics, units, missing-data policy, and event window.
4. Method/version, complete input hash, output hash, and deterministic run metadata.
5. Volume/mass-balance checks and benchmark vectors.
6. Sensitivity/uncertainty statement and independent reviewer decision.

A numerical hydrograph from this lumped method is screening evidence only unless a qualified reviewer has approved its use for the stated purpose. Routing, baseflow, antecedent conditions, snowmelt, and calibrated watershed response are not implied by the current module.

## 4. Hydraulic model contract

A release-grade hydraulic analysis requires a reproducible model artifact for the explicitly approved AOI. At minimum, retain:

- Solver and exact version/build; model project and result artifact hashes.
- Approved terrain plus verified bathymetry/topobathymetry where channel hydraulics require it.
- Horizontal and vertical reference systems, geoid/datum transformations, units, mesh/cell geometry, and breaklines.
- Inflow hydrographs, downstream/upstream boundary conditions, structures, roughness values, and source evidence for each assumption.
- Timestep, numerical scheme, convergence/stability diagnostics, mass balance, and failed-cell/error diagnostics.
- Calibration data and independent validation data as distinct evidence.
- Baseline and proposed/scenario model pairing, comparable boundary conditions, and explicitly applicable jurisdictional criterion.
- Sensitivity/uncertainty analysis, reviewer identity/date, and limitations.

A map overlay, flood-warning polygon, terrain visualization, rainfall image, synthetic water surface, or unvalidated solver output is not a substitute for these artifacts. No-rise, floodway, BFE, property-level risk, or permit claims must not be inferred from visualization.

## 5. Datum and historical-value guardrails

- Never assume a universal vertical datum for a DEM or imagery-derived surface.
- Never infer a gage-zero conversion from nearby water levels or visual alignment.
- Previously discussed site elevations and earthwork quantities (including BFE/LAG/FFE, cut/fill, and surcharge figures) remain unverified until supported by current authoritative records and qualified survey/model evidence. They are not global constants or accepted model inputs.
- A sealed survey and applicable agency records retain their proper authority; LiDAR accuracy class does not supersede a site-specific survey certificate.

## 6. Fail-closed acceptance gates

| Gate | Required evidence | Failure state |
|---|---|---|
| AOI | Named, bounded, approved pilot area and watershed delineation | AOI_NOT_APPROVED |
| Source qualification | Complete metadata, checksums where retained, quality/freshness and terms | SOURCE_UNQUALIFIED |
| Datum | Explicit CRS, vertical datum and validated transformation or documented non-comparability | DATUM_UNVERIFIED |
| Rainfall/runoff | Reproducible input/output manifest, benchmark and mass-balance checks | RUNOFF_NOT_VALIDATED |
| Hydraulic model | Real solver artifact, boundaries, diagnostics and paired baseline/scenario | HYDRAULIC_MODEL_MISSING |
| Calibration/validation | Independent observations, stated tolerances and reviewer evidence | MODEL_NOT_VALIDATED |
| Uncertainty | Sensitivity/uncertainty record appropriate to decision | UNCERTAINTY_UNASSESSED |
| Regulatory applicability | Current source-backed rule and jurisdiction/applicability resolution | RULE_NOT_QUALIFIED |
| Human review | Qualified reviewer and recorded disposition | REVIEW_REQUIRED |
| Deployment | Exact commit checks, deployed route/API health and operational telemetry | DEPLOYMENT_UNVERIFIED |

A downstream gate cannot be marked passed while a required upstream gate is blocked. Each status transition must cite an evidence artifact; a checkbox or code path alone is insufficient.

## 7. Completion checklist

- [x] Existing SCS Curve Number primitive documents equations, units, limitations, validation and provenance.
- [x] Existing engineering evidence pipeline defines terrain/bathymetry, datum, calibrated HEC-RAS, scenario, earthwork and independent QA/QC boundaries.
- [x] NOAA CloudGIS context catalog and opt-in map overlays are merged; service-runtime verification is explicitly pending.
- [ ] Approve a specific pilot AOI and watershed delineation.
- [ ] Acquire and qualify all AOI-specific rainfall, gage, terrain, bathymetry, structure and boundary-condition inputs.
- [ ] Resolve all required vertical datum conversions with authoritative evidence.
- [ ] Execute and retain a reproducible, real hydraulic model and diagnostics.
- [ ] Complete calibration, independent validation, sensitivity and uncertainty analysis.
- [ ] Complete qualified engineering/regulatory review and production deployment verification.

## Official technical references

- [NOAA/NWS CloudGIS services](https://www.weather.gov/gis/cloudgiswebservices)
- [NWS radar FAQ](https://www.weather.gov/radarfaq)
- [NOAA MRMS QPE tutorial](https://www.weather.gov/gis/mrms_data_quick_tutorial)
- [Indiana DNR hydrology and hydraulics resources](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links)
- [USGS Water Data](https://waterdata.usgs.gov/)
- [USDA NRCS TR-55](https://www.nrcs.usda.gov/resources/guides-and-instructions/urban-hydrology-for-small-watersheds-tr-55)
