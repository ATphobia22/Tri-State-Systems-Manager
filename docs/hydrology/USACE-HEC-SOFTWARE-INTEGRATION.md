# USACE HEC software integration plan

**Updated:** 2026-10-15  
**Scope:** Tri-State Systems Manager (TSM) hydrology, hydraulics, flood-impact and statistical-analysis integration.  
**Decision:** Integrate HEC products as versioned, externally executed engineering tools with auditable inputs/outputs. A download, installed executable, successful process exit, or rendered map is not a validated flood model.

## 1. Official sources reviewed

The USACE Hydrologic Engineering Center makes selected software available to the public without charge, subject to its software terms and conditions. HEC states that it does not provide user assistance/support to non-Corps users under the published download policy. Review current terms, release notes, known issues and platform requirements before each pinned deployment.

| Product | Intended role in TSM | Official source |
|---|---|---|
| HEC-HMS | Watershed precipitation-runoff modeling and explicitly qualified inflow hydrographs | [Product/downloads](https://www.hec.usace.army.mil/software/hec-hms/downloads.aspx), [documentation](https://www.hec.usace.army.mil/software/hec-hms/documentation.aspx) |
| HEC-RAS | 1D/2D river hydraulics and inundation computation from a complete, configured model | [Product](https://www.hec.usace.army.mil/software/hec-ras/), [downloads](https://www.hec.usace.army.mil/software/hec-ras/download.aspx), [documentation](https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx), [release notes](https://www.hec.usace.army.mil/confluence/rasdocs/rasrn) |
| HEC-SSP | Statistical analysis of hydrologic data, including justified frequency-analysis workflows | [Product](https://www.hec.usace.army.mil/software/hec-ssp/), [documentation](https://www.hec.usace.army.mil/software/hec-ssp/documentation.aspx) |
| HEC-FIA | Consequence and flood-impact analysis for a defined event and supported inputs | [Product](https://www.hec.usace.army.mil/software/hec-fia/), [downloads](https://www.hec.usace.army.mil/software/hec-fia/downloads.aspx) |
| HEC software catalog and terms | Product discovery and software-use constraints | [HEC Software](https://www.hec.usace.army.mil/software/) |

The official pages reviewed surfaced HEC-HMS 4.14 download materials, HEC-RAS 6.6 manuals, HEC-SSP 2.3 documentation, and HEC-FIA 3.4-series materials. These are source-observed versions, not an evergreen declaration of the latest release. Recheck official download and release-note pages when selecting a runner; never silently upgrade a model project between runs.

## 2. Target architecture

Keep the browser/API tier independent of numerical solvers:

1. **Source acquisition and qualification:** collect NOAA/NWS precipitation products, USGS observations, authoritative terrain, bathymetry/topobathymetry, structures and watershed geometry. Preserve native semantics and provenance.
2. **Canonical model manifest:** validate a versioned manifest describing AOI, units, CRS and vertical datum, input hashes, time intervals/time zones, model purpose, assumptions, source licenses, transformations and validation requirements.
3. **HEC-HMS execution when justified:** use a pinned and legally usable installation to generate watershed response. Keep observed rainfall, forecast rainfall and synthetic/design storms in separate runs and authority classes.
4. **Hydrograph handoff:** use documented supported HEC formats, then validate timestamps, time zone, interval, flow units, reach/location, gaps and mass/volume balance before HEC-RAS consumes the hydrograph. Never infer compatibility from a filename.
5. **HEC-RAS execution:** run a fully specified baseline/scenario project with approved terrain and verified bathymetry where required, datum control, structures, roughness, boundary conditions, mesh/cross-sections, solver settings and numerical diagnostics.
6. **Result verification:** independently check completion, expected outputs, finite values, spatial coverage, mass balance, convergence/stability diagnostics, and run-to-run reproducibility within declared tolerances. A zero exit code alone is insufficient.
7. **Independent calibration/validation:** compare model outputs against held-out, appropriately timed observations and/or documented flood extents. Retain data, metrics, tolerances, failures and reviewer disposition; do not reuse calibration observations as independent validation evidence.
8. **Impact/statistical workflows:** use HEC-SSP only for justified statistical analyses with defensible stationarity, record-length and uncertainty assumptions; use HEC-FIA only with valid supported consequence inputs and a defined event.
9. **Publishing:** publish qualified derived products only after all required gates pass. Keep raw observations, forecasts, statistical estimates, regulatory mapping and modeled scenarios distinguishable in APIs, storage, legends and exports.

Run HEC software in a controlled worker/runner environment appropriate to the specific release and licensing/platform constraints. Do not assume a hosted Linux web process can run a Windows-only package, or that a HEC project file is a stable public API. Verify each product's current supported platform and automation capabilities from official documentation. Keep large binary project artifacts out of Git where practical; retain approved artifacts in controlled object storage with immutable hashes and access controls.

## 3. Canonical run manifest and evidence

Every run must record at least:

- Unique run ID, UTC start/end, initiating actor, purpose, environment and source-control commit.
- Product name, exact version/build, platform, configuration and executable/package hash where permitted.
- AOI geometry hash, watershed delineation method, CRS, vertical datum and transformation records.
- Each input's source ID/URI, retrieval time, source-valid time, native units, quality flags, missing-data policy, terms/license and SHA-256 where retained.
- Explicit distinction among observed, forecast, design-storm, derived, modelled, scenario and regulatory data.
- Project/configuration hash, boundary conditions, parameters, roughness, mesh/cross-section details, timestep and numerical settings.
- Output artifact hashes, diagnostics, warnings, convergence and mass-balance results.
- Calibration set and independent validation set IDs, metrics, tolerances, uncertainty/sensitivity analysis and known limitations.
- Reviewer identity, review date, disposition and evidence links.

Manifests must be schema-validated, deterministic where practical, immutable after approval, and tied to precise input/output artifacts. Never place credentials or private keys in a manifest.

## 4. Required scientific guardrails

- **No invented local model:** regional focus does not determine a pilot AOI, watershed boundary, roughness, flow boundary, vertical datum or calibration target.
- **No implicit datum conversions:** USGS gage stage is referenced to its station datum unless verified metadata establishes a transformation. Do not compare it directly with NAVD88 elevation.
- **No radar semantic confusion:** dBZ reflectivity is not precipitation accumulation or water depth. MRMS QPE windows require exact product/window, valid-time and nodata interpretation before use as forcing.
- **No fabricated bathymetry:** DEM/LiDAR does not establish a submerged channel bed. Acquire authoritative bathymetry/topobathymetry or document why it is unnecessary for the stated reach and decision.
- **No regulatory inference from simulation:** a HEC-RAS map is not automatically FEMA effective mapping, an adopted BFE, a floodway determination, a no-rise certification or a permit.
- **No unqualified single score:** report calibration and validation measures suitable for water-surface/flow time series and observed flood extent; disclose spatial/temporal mismatch, sensitivity and uncertainty.
- **No promotion of failed runs:** failed, incomplete, unstable, stale or unreviewed results must remain blocked and visibly qualified.

## 5. Fail-closed release gates

| Gate | Evidence required | Failure status |
|---|---|---|
| AOI and purpose | Approved geometry, delineation and decision/use statement | AOI_NOT_APPROVED |
| Inputs | Complete source manifest, coverage and quality/freshness qualification | SOURCE_UNQUALIFIED |
| Datum and units | Verified CRS, vertical reference, units and transformations | DATUM_UNVERIFIED |
| Runner reproducibility | Pinned version/build, project/config hash and captured environment | RUNNER_UNPINNED |
| Hydrology | Qualified precipitation/parameters, hydrograph checks and volume balance | HYDROLOGY_NOT_VALIDATED |
| Hydraulics | Real HEC-RAS project/results, boundaries, terrain/bathymetry and diagnostics | HYDRAULIC_MODEL_MISSING |
| Calibration and independent validation | Held-out evidence, fit metrics, declared tolerances and reviewer decision | MODEL_NOT_VALIDATED |
| Uncertainty | Sensitivity, uncertainty and limitations appropriate to use | UNCERTAINTY_UNASSESSED |
| Impact/statistical analysis | Method applicability, source evidence and uncertainty | ANALYSIS_NOT_QUALIFIED |
| Human review | Qualified engineering review and recorded disposition | REVIEW_REQUIRED |
| Deployment | Passing commit checks plus verified service health and telemetry | DEPLOYMENT_UNVERIFIED |

No downstream status may pass while an upstream required gate is blocked. Documentation of a gate is not evidence that the gate has passed.

## 6. Research references for validation design

- USACE HEC-RAS documentation and reference manuals include user, hydraulic, 2D and mapper documentation, release notes, training materials and validation/verification references: [HEC-RAS documentation](https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx).
- [Evaluation of Performance Measures for Qualifying Flood Models with Satellite Observations](https://arxiv.org/abs/2408.00571) discusses selecting performance measures for comparing modeled flood extent with satellite-observed events. It is a research lead, not a replacement for project-specific agency requirements.
- [Metamodel-based methodology for uncertainty propagation and global sensitivity analysis of tailings dam-breach flows](https://arxiv.org/abs/2607.19296) is a research lead on uncertainty/sensitivity propagation; its application domain differs from routine riverine flood modeling and must not be generalized without review.
- Product manuals, current release notes, model-specific validation/verification references and applicable agency/jurisdiction criteria remain the primary operational documentation.

## 7. Implementation status in TSM

This document defines the integration and acceptance contract. It does **not** claim HEC-HMS or HEC-RAS has been installed, executed, automated, or validated against a selected Tri-State AOI. No HEC project, live hydraulic result, or validated forecast is asserted by this documentation change.

Next implementation sequence:

1. Choose and approve a pilot AOI and intended use.
2. Inspect existing runner, manifest, schema and artifact-store interfaces before adding duplicate abstractions.
3. Implement the canonical manifest schema and validators; add positive and negative fixtures.
4. Build isolated runner adapters only for officially supported, verifiable interfaces and a pinned target environment.
5. Create a controlled, licensed, documented benchmark project; test ingestion/export round trips and deterministic evidence capture.
6. Validate against independent observations, quantify uncertainty and obtain qualified review.
7. Wire status to real CI/runtime evidence and refuse production promotion until all applicable gates pass.
