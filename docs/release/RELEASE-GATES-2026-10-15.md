# TSM release-gate register

**Updated:** 2026-10-15  
**Scope:** Repository and console release readiness; this is a status register, not an engineering certification.

## Integration status

PR [#267](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/267) was merged to `main` in commit `71979cb99e884f4fff40d58bec98f591f7385576`. This integrates the NOAA/NWS CloudGIS catalog, opt-in warning/radar overlays, bounded GetCapabilities verification, and contract tests. Merge status is not equivalent to a green release: this register does not claim that all post-merge checks or live runtime validations passed.

The hydrology/hydraulics acceptance contract is maintained in [HYDROLOGY-RELEASE-CONTRACT.md](../hydrology/HYDROLOGY-RELEASE-CONTRACT.md).

Candidate-area update: the supplied 13101 Bonebank Road address has a candidate parcel footprint and screening-only terrain/flood-layer observations, but a second legacy centroid approximately 6.4 km away leaves the address-to-parcel association unresolved. The watershed and model area remain **unapproved**. Track it in the [candidate AOI assessment](../hydrology/aoi/13101-BONEBANK-ROAD-CANDIDATE.md) and [DRAFT HEC manifest](../../data/posey-county/hec/13101-bonebank-road-candidate-run-manifest-v2.json); this does not close the AOI/model-validation gate.

## Gates with repository evidence

| Gate | Current evidence | Status |
|---|---|---|
| NOAA/NWS source catalog | Official endpoints and published layer names recorded in `data/sources/noaa-cloudgis-catalog.json` | DOCUMENTED / GETMAP_RUNTIME_PENDING |
| NOAA Twin Canvas overlays | Opt-in WMS warning and MRMS reflectivity layers with attribution | IMPLEMENTED / RUNTIME_HEALTH_PENDING |
| GetCapabilities verifier | HTTPS and host/path allowlist, timeout, bounded response, content-type and layer checks, negative tests | IMPLEMENTED / LIVE RUN NOT CONFIRMED HERE |
| SCS Curve Number runoff | Deterministic lumped event-method implementation, validation, provenance and hand-computed tests | IMPLEMENTED / SCREENING ONLY |
| HMS-to-RAS coupling | Exact DSS FLOW selection, units/time-axis checks, target DSS read-back, boundary selector and receipt hash checks; regression fixtures added | IMPLEMENTED IN FEATURE BRANCH / CI AND REAL-WORKER VERIFICATION PENDING |
| Engineering evidence pipeline | Terrain/bathymetry, datum, calibrated HEC-RAS, scenario, earthwork, environmental and independent QA/QC sequence documented | CONTRACT DOCUMENTED / AOI MODEL EVIDENCE REQUIRED |
| Full JSON Schema 2020-12 validation | Existing twin invariant checks are not a substitute for standards-compliant schema and instance validation | PARTIAL / RELEASE GATE OPEN |
| Source metadata acquisition | Bounded acquisition and hash/manifest tooling exists | TOOL AVAILABLE / AOI SNAPSHOTS NOT CONFIRMED |
| HEC coupled-run manifest v2 and stage wrappers | Exact run/plan selectors, project/runtime hashes, explicit DSS handoff, stage receipts | IMPLEMENTED / EXECUTION BLOCKED UNTIL APPROVED AOI, MODEL INPUTS AND ENVIRONMENT LOCK | 
| Hash-locked Python environment | Transitive dependency lock plus installed-package fingerprint on Windows x64 worker | OPEN / LOCK NOT GENERATED OR VERIFIED |
| Production backend deployment | No verified target plus live API health evidence established by this register | BLOCKED / NOT CLAIMED |
| Post-merge CI and deployment | Merge commit is known; a complete passing status set and verified deployment URL have not been established in this register | PENDING VERIFICATION |

## Hard release blockers

1. **Approve a pilot area of interest (AOI).** Do not silently select a river reach. The AOI determines data coverage, watershed boundaries, boundary conditions, model extent, and validation targets.
2. **Acquire and qualify source inputs.** Preserve exact source URI, retrieval time, license/terms, source-native ID, checksum when retained, horizontal CRS, vertical datum, units, observation/forecast time, quality/freshness and transformation lineage. Do not infer missing datum metadata.
3. **Validate NOAA WMS services in the release environment.** Fetch and parse GetCapabilities, confirm each configured layer name and CRS, then assert GetMap returns valid image bytes for a Tri-State bounding box. A capabilities response alone does not prove successful image rendering.
4. **Verify coupling and solver runs on an authorized worker.** Passing contract tests are necessary but do not prove the pinned packages, Java/HEC-DSS runtime, DSS round-trip behavior, RAS plan and HDF diagnostics on the actual execution host.
5. **Use full JSON Schema 2020-12 validation.** Validate the schema itself and all instances, including format assertions and negative fixtures. Existing invariant checks are useful but do not satisfy this gate.
6. **Run a real hydraulic model for the approved AOI.** Record solver/version, mesh and terrain/bathymetry inputs, roughness assumptions, boundary conditions, rainfall/flow forcing, convergence, calibration/validation evidence, uncertainty and reproducibility tolerances. A visual water overlay is not model evidence.
7. **Keep hydrologic semantics distinct.** NWPS observations and forecasts, USGS gage measurements, radar reflectivity, MRMS precipitation estimates, FEMA effective products, Indiana best-available flood mapping, and modeled inundation are different evidence classes. Do not use reflectivity as rainfall accumulation or raw gage stage as NAVD88 elevation.
8. **Prove deployment separately.** Verify the deployed frontend URL, API health, authentication, telemetry, database/PostGIS, WebSocket behavior and operational monitoring independently. A green Vite build does not prove those services exist.
9. **Complete qualified human review.** No permit, floodway, life-safety or property-level determination may be promoted from map visualization or unvalidated model output.

## USACE HEC model integration

The integration contract is documented in [USACE-HEC-SOFTWARE-INTEGRATION.md](../hydrology/USACE-HEC-SOFTWARE-INTEGRATION.md). The handoff-read-back rationale is summarized in [HEC coupling validation research](../hydrology/HEC-COUPLING-VALIDATION-RESEARCH-2026-10-15.md). HEC-HMS, HEC-RAS, HEC-SSP and HEC-FIA are candidate engineering tools with distinct roles; TSM does not claim that they are installed, executed or validated for a Tri-State pilot AOI. Model runner, product version, source/input manifest, datum controls, solver diagnostics, independent validation, uncertainty and qualified review must be evidenced before promotion. Official downloads and release notes must be rechecked at implementation time; observed version strings in research are not hard-coded latest-version assertions.

## Release policy

- Keep external context layers off by default; preserve attribution and authority boundaries.
- Never substitute NOAA warning polygons or radar reflectivity for inundation, regulatory flood maps, or calibrated hydraulic output.
- Do not commit live external payloads unless licensing, reproducibility and retention are reviewed.
- Do not provision paid infrastructure without explicit authorization.
- PR #267 is merged. Scientific, runtime and deployment gates remain open until the required evidence is recorded and checks pass.
