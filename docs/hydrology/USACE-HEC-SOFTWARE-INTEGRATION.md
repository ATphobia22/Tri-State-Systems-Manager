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

The official pages checked on 2026-10-15 list HEC-HMS 4.14 and HEC-RAS 7.0.1 as current downloads. HEC-RAS documentation pages may still link to older-version manuals. HEC-SSP 2.3 and HEC-FIA 3.4-series materials were observed during earlier research; recheck their current pages before use. These are time-stamped source observations, not evergreen version assertions. Recheck official downloads and release notes when selecting a runner; never silently upgrade a model project between runs.

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

## 7. TSM implementation status (2026-10-15)

### Implemented in the coupled-workflow branch

- The original v1 manifest schema and example are preserved as compatibility artifacts. The current v2 schema is data/schemas/hec-coupled-run-manifest-v2.schema.json; it pins source commit, AOI/delineation and source-input hashes, HEC model-package hashes, adapter hashes, vendor HEC executable paths/hashes, software-version evidence, exact DSS pathname and selected RAS boundary, conversion, interval/time-zone, outputs and artifact-store policy.
- scripts/hydrology/validate-hec-run-manifest.mjs validates the checked-in JSON Schema 2020-12 keyword subset, fails closed on unsupported schema keywords, and distinguishes structural validation from execution readiness. The v2 DRAFT example must not execute.
- scripts/hydrology/hms-ras-handoff.py uses version-pinned HMS/RAS Commander APIs to read one explicitly named HMS FLOW record, validate units and time continuity, write an explicitly named RAS DSS FLOW record, update a specifically selected RAS .uNN boundary, and retain a hash-rich handoff report. It rejects gaps, duplicates, irregular time steps, unqualified unit conversions, non-finite/negative discharge and ambiguous/nonexistent local timestamps around daylight-saving transitions.
- scripts/hydrology/run-hec-coupled-workflow.mjs verifies the manifest, hashes source projects and actual vendor binaries, creates isolated run copies, executes pinned argv commands without shell interpolation, invokes the handoff adapter, checks the output file/HDF5 signature, and writes stage logs, content-addressed filesystem blobs and a run receipt.
- Regression suites cover manifest validation, runner path/hash guards, DSS pathname/units/timestamp contracts and fail-closed behavior.
- The reusable run contract and operator steps are documented in [HEC-HMS-RAS-REPRODUCIBLE-WORKFLOW.md](HEC-HMS-RAS-REPRODUCIBLE-WORKFLOW.md).

### Interfaces inspected and storage boundary

- packages/hydraulics/python/tsm_hec_ras/runtime.py supports controlled local HEC-RAS 6.x execution on Windows with a real project and produced .p*.hdf artifact; this is not a verified runner for all later HEC-RAS versions.
- backend/engineering/hec_ras_worker.py hashes model-package trees and runs operator-supplied argv without shell interpolation; its receipt deliberately remains unvalidated.
- backend/api/v1/hecras_solver.py inspects real HDF5 outputs and rejects synthetic hydraulic fallbacks.
- tsm-console/server/store/evidence-store.mjs is a file-backed metadata ledger under TSM_EVIDENCE_DIR; database/migrations/052_artifacts.sql defines artifact metadata in PostgreSQL. Neither alone guarantees transaction-safe registration of large binary objects and manifests. The coupled runner therefore uses local filesystem content-addressed blobs and metadata_store=run-manifest-only. A shared object store/database adapter remains a separate integration task requiring security, integrity, idempotency and transaction tests.

### Important execution boundary

The workflow implementation is reproducible orchestration plus a specific source-DSS-to-RAS-boundary adapter; it is not a completed engineering model. The adapter libraries are explicitly pinned, but this repository still has no approved pilot area and no supplied qualified HMS/RAS project. The checked-in v2 manifest is DRAFT with placeholder hashes and must never be used for a model run.

A solver exit code, present HDF5 file, structurally valid hydrograph, or generated receipt does not establish model skill, stable numerical solutions, valid calibration or engineering approval. Completed computations are labeled COMPLETED_UNVALIDATED, and no model execution is claimed in this change.

### Remaining before the first real pilot run

1. A named AOI and purpose must be approved with a traceable reviewer/evidence record.
2. The AOI polygon, independently checked watershed delineation, model-forcing/observation inputs, usage terms, units and CRS/vertical datum must be supplied and hashed.
3. Compatible HEC-HMS and HEC-RAS installations must be made available on a qualified worker, with exact version evidence, vendor binary hashes, a model package inventory and tested stage adapters.
4. Confirm the exact HEC-HMS FLOW pathname, time zone, interval/units and the correct RAS receiving boundary/location; review the generated handoff receipt against the staged .uNN file.
5. Run the v2 readiness gate, unit tests and model-specific checks on the selected worker, then execute only with an approved manifest.
6. Review HEC-HMS warnings, hydrologic volume/continuity, HEC-RAS computational diagnostics, mass balance and output time/spatial coverage.
7. Independently calibrate and validate using appropriately qualified separate observation sets; assess uncertainty/sensitivity; obtain qualified engineering review for the stated use.
8. Integrate run metadata into a shared evidence/object-store service only after its concurrency, retention, permissions, integrity and idempotency semantics are tested.
9. Prove deployment/service health separately from repository CI and model execution.

