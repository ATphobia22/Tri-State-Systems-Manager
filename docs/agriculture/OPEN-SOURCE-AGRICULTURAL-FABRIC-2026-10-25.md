# Agricultural Scientific Fabric — Open Source Adoption (2026-10-25)

**Status:** foundation integrated by PR; external engines and authoritative agricultural datasets remain **uninstalled/unacquired**. Never describe a planning manifest or numeric check as a validated field or watershed prediction.

## What this change actually implements

1. `@tsm/agriculture`: typed agricultural engine inventory; horizontal CRS and explicit vertical-reference semantics; daily weather continuity/finite-value validation; a deterministic model-plan digest; a closed-bucket conservation check labelled numerical only.
2. Offline USDA NRCS Soil Data Access `FORMAT=JSON+COLUMNNAME` importer for explicitly named component/horizon columns. It verifies complete raw snapshot bytes against the existing Government Data Fabric's SHA-256 evidence manifest, distinguishes different map units **and** components, sorts horizons by depth, rejects missing values, duplicate horizon IDs, conflicting ranges, invalid textures and physically impossible available-water fractions, and labels outputs `DERIVED_UNCALIBRATED`. **No live service queries or soil-property interpolation occur.**
3. Catalog entries for USDA Soil Data Access POST service, gNATSGO, NASS Quick Stats and NASA POWER daily climatology. Catalog registration is not evidence of local holdings, API access, or product accuracy.
4. TypeScript tests in `tests/contracts/agriculture-evidence.test.ts`; `npm run test:agriculture` is part of `npm run verify:uacf`.

## Upstream candidates and deployment decisions

| Tier | Repository | License / deployment boundary | TSM role | Current integration status |
|---|---|---|---|---|
| P0 | [swat-model/swatplus](https://github.com/swat-model/swatplus) | LGPL-2.1; review redistribution and dynamic linking | Watershed hydrology, erosion, nutrients | Registered candidate; no SWAT+ executable, model, calibration or validation |
| P0 | [aquacropos/aquacrop](https://github.com/aquacropos/aquacrop) | Apache-2.0 | Crop/water balance and yield simulations | Registered candidate; no AquaCrop-OSPy Python worker run |
| P0 | [ncss-tech/soilDB](https://github.com/ncss-tech/soilDB) | GPL-3.0; isolate R worker | USDA SSURGO/SDA retrieval | R worker not installed; native frozen-SDA response importer available |
| P1 | [kthorp/pyfao56](https://github.com/kthorp/pyfao56) | US Government public domain/CC0 | FAO-56 ET and irrigation | Registered candidate; external library not installed |
| P1 | [ajwdewit/pcse](https://github.com/ajwdewit/pcse) | EUPL-1.1 | WOFOST cross-model benchmark | Registered candidate; no simulation |
| P1 | [DSSAT/dssat-csm-os](https://github.com/DSSAT/dssat-csm-os) | BSD-3-Clause | Fortran crop-system model | Registered candidate; no installation |
| P1 | [farmOS/farmOS](https://github.com/farmOS/farmOS) | GPL-2.0 | Private farm-operation records via JSON:API | No farmOS service/credentials or personal farm datasets |
| P1 | [OpenDroneMap/ODM](https://github.com/OpenDroneMap/ODM) | AGPL-3.0; network obligations need review | UAV DSM/DTM/orthophotos | No processing; verify GCP Z vertical datum before engineering use |
| P1 | [sentinel-hub/eo-learn](https://github.com/sentinel-hub/eo-learn) | MIT | Satellite time-series transformations | No imagery processing |
| P1 | [NASA-LIS/LISF](https://github.com/NASA-LIS/LISF) | Apache-2.0 plus dependencies | HPC land-surface simulation | No installation; benchmark before coupling |
| P2 | [APSIMInitiative/ApsimX](https://github.com/APSIMInitiative/ApsimX) | Custom license | Scientific comparison | Plan creation blocked pending license review |
| P2 | [un-fao/fao-AquaCrop](https://github.com/un-fao/fao-AquaCrop) | Restrictive/all-rights-reserved LICENSE despite publicly visible Python source | Scientific comparison | Plan creation blocked pending explicit permission |

Source registries are **not** automatically installed dependencies. PIN exact source commits, dependency locks, model configurations and binary SHA-256 before executing anything. Do not vendor GPL/AGPL/custom-licensed code or assume that process isolation alone resolves license compliance.

## TSM data flow

```text
USDA SDA / gNATSGO / weather / NASS catalogs
  -> verified & versioned local source bytes (existing Government Data Fabric)
  -> CRS + time + units + fingerprint validation
  -> SoilProfile / DailyAgriculturalWeather (derived, uncalibrated)
  -> AgriculturalExecutionPlan (NOT_EXECUTED; HUMAN_REVIEW_REQUIRED)
  -> separately installed, pinned model runner [not implemented by this increment]
  -> model-specific convergence + scientific/evidence extractors [pending]
  -> observation-based calibration, independent evaluation and human review [pending]
  -> public or private twin overlays as appropriately authorized
```

### Contracts and scientific integrity

- USDA soil-horizon depths are measured **below ground surface** and are not NAVD88, NGVD29 or ellipsoidal elevations.
- True water-table, surface and GCP Z elevations require independently verified CRS, vertical datum, model and units. Unsupported transformations are rejected; a declared transform is not itself a transformed numeric value.
- A precipitation or ET depth needs a temporal interval and spatial support. Preserve input dates and soil/map-unit identity; do not allocate county averages to private fields as if observed.
- `assessClosedBucketWaterBalance` applies only when all flux terms are present for a **closed bucket** and explicitly cannot establish real-world accuracy.
- Model-output status stays `HUMAN_REVIEW_REQUIRED` until runtime tests, observation/reference comparisons, calibration, uncertainty estimation and governance approval are complete.
- Freeze remote data before running offline. No implicit NASA POWER, USDA, EO or other API requests; no artificial test profiles may enter real projects.
- Private farm boundaries, operations and yield data must not flow to public layers, anonymous analytics or model logs. farmOS is not an authoritative government source.

## Remaining acceptance gates (not accomplished by this PR)

- [ ] Test signed/verified government SDA snapshots captured from the real endpoint, including query and schema version.
- [ ] Add a bounded, read-only SDA POST adapter and/or separately licensed soilDB R worker; preserve query, source response and exact byte checksum.
- [ ] Install pinned AquaCrop-OSPy and pyfao56 Python workers, build execution and water-budget evidence extractors, and validate against published examples/field observations.
- [ ] Run pinned SWAT+ simulations with a complete input tree and verify period, input closure, hydrologic conservation, selected gage comparisons and parameter calibration; only then expose OpenMI quantities.
- [ ] Integrate PCSE and DSSAT through process-isolated model worker contracts and golden-case tests.
- [ ] Build opt-in read-only farmOS JSON:API and UAV ODM adapters with privacy and geodesy reviews.
- [ ] Add eo-learn optical time-series, ingest audited satellite product IDs/cloud masks; do not assume hosted Sentinel Hub credentials.
- [ ] Evaluate NASA LISF and APSIM/FAO permissions separately. Do not label model results physically validated without independent evidence.
- [ ] Run Windows x64 offline bundling and scientific end-to-end integration tests, license compliance, software supply-chain audit, and main-head CI before promoting features to production.

**Regulatory limit:** This package is a screening/research aid. Wetland determinations, flood insurance decisions, land-treatment designs, crop-yield claims and engineering certification require the applicable agency and qualified human review.

### Primary references

- [NRCS Soil Data Access API](https://sdmdataaccess.sc.egov.usda.gov/WebServiceHelp.aspx) documents the POST endpoint and SDA formats.
- [NRCS gNATSGO](https://www.nrcs.usda.gov/resources/data-and-reports/gridded-national-soil-survey-geographic-database-gnatsgo) describes the blended GeoPackage soil source.
- [NASS Quick Stats](https://data.nass.usda.gov/datasets/) provides county/commodity statistics, not parcel estimates.
- [NASA POWER daily service](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) provides gridded weather and solar inputs, with product/time semantics that must be preserved.
- [SWAT+](https://github.com/swat-model/swatplus) and [pySWATPlus](https://github.com/swat-model/pySWATPlus) describe the upstream engine and workflow interface.
