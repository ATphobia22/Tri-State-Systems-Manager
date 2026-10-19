# Home-site AOI automation: implementation contract

**Status:** implementation requirements committed; execution gates remain evidence-dependent.  
**Site record:** `posey-13101-bonebank-road`  
**Last updated:** 2026-10-15

## Product requirement

A user must be able to supply an address and/or site photograph and have TSM orchestrate the evidence collection, geospatial reconciliation, data-quality checks, reproducible artifacts, and next-step report without manually stitching together services. The system must make progress automatically while failing closed whenever a decision requires missing evidence, a licensed determination, or an unverified physical condition.

## Workflow stages

1. **Intake and identity**
   - Persist the original uploaded bytes unchanged; calculate SHA-256 and byte length.
   - Capture user-confirmed principal residence, source/date/provenance if known, and explicit uncertainty.
   - Resolve address candidates against authoritative parcel/address services; record all candidates and reject conflicting coordinates with a reason rather than silently substituting them.
   - Match address point to structure footprint and parcel; report ambiguity if multiple structures exist.
2. **Evidence acquisition**
   - Acquire parcel, current orthophotography where licensed/available, building footprints, DEM/metadata, hydrography, FEMA NFHL/FIRM/FIS, state floodplain/INFIP/FARA, precipitation, gages, and existing models as relevant.
   - Each adapter records URL, query, retrieval timestamp, response status, source/product vintage, CRS, units/datum, raw artifact hash, parsed artifact hash, and provenance.
   - Retry transient errors with bounded exponential backoff; respect service terms/rate limits; cache by normalized request and source version; never convert service errors into empty-data success.
3. **Geometry normalization**
   - Store separate typed geometries for parcel, structure, hydrologic catchment, and hydraulic domain.
   - Validate geometry validity, coordinate ranges, CRS transformations, topology, area units, coverage, and spatial relationships.
   - Produce a review map with parcel, candidate home, nearby structures, flood zones, DEM coverage, and hydrography; preserve source layers separately.
4. **Terrain and hydrography**
   - Download DEM tiles and metadata to content-addressed storage; verify checksums where published, compute local SHA-256, inspect nodata, vertical datum, units, resolution, seams, voids, and coverage.
   - Build a reproducible terrain QA report. No terrain-derived elevations are published as survey-grade.
   - Candidate drainage lines/outlets must be distinguished from verified physical drainage connections.
5. **Flood evidence**
   - Query point, structure, and parcel overlays independently; retrieve effective FIRM panel/FIS and available state products.
   - Normalize no-data sentinels to null while retaining raw values. Never treat -9999 or an unlinked zero as a BFE.
   - Record effective dates, map revisions/LOMC search scope, floodway status, datum, BFE provenance, and coverage fractions where available.
6. **Catchment delineation**
   - Require an explicit outlet/point-of-interest with evidence and reviewer state.
   - Use qualified terrain and hydrography; account for roads, culverts, ditches, levees, floodplain flatness, and artificial drainage.
   - Save polygon, CRS, area, method/version, all input hashes, configuration, logs, and independent QC results.
   - Do not substitute parcel area for catchment area.
7. **Model-readiness gate**
   - Generate a machine-readable manifest with source/assumption lineage, solver version, datums, units, boundary conditions, rainfall/gage inputs, and validation rules.
   - HEC-HMS and HEC-RAS remain `BLOCKED_NOT_RUN` until their independent readiness gates pass and a human approves the question/scope.
   - Preserve solver logs, mass balance/convergence diagnostics, output hashes, and review record for any authorized run.
8. **Report and continuous verification**
   - Generate an evidence-linked report and checklist after each stage.
   - Tests cover schema, geometry, sentinel handling, CRS/unit conversion, duplicate features, stale source metadata, failed downloads, cache integrity, and resilient model gating.
   - CI must run on pull requests and main; status is green only when actual required checks succeed. Missing statuses are unknown, never success.

## Site-specific current state

- Owner confirmed the large brick residence near the center of the uploaded aerial image is their home.
- Uploaded original image size: 609,767 bytes. SHA-256: `b2f7d7ed3bba6a50ab6058c5f78a68fee283a843474f16863382686a797edfda`.
- The exact original image bytes have **not yet been stored in the repository evidence directory**; the hash is recorded in the confirmation JSON.
- Historical building footprint 763173 remains a candidate to reconcile against the image and current imagery; owner confirmation does not validate its polygon geometry.
- Candidate parcel remains unsurveyed; DEM is catalog-matched but not downloaded/QA'd; outlet and catchment remain unverified/not delineated.
- FEMA/Indiana AE evidence is a mapped intersection only; usable BFE/datum and current effective product review remain open.
- No flood model or engineering conclusion is authorized.

## Acceptance criteria

- [ ] Original input artifact is stored byte-for-byte, and repository hash equals the intake hash.
- [ ] Address, parcel, and home footprint are linked with source-backed confidence and explainable ambiguity.
- [ ] All retained datasets have machine-readable provenance and reproducible hashes.
- [ ] DEM passes coverage, CRS, vertical datum, units, nodata, seam, and quality checks.
- [ ] FEMA/state flood outputs preserve raw responses, null sentinels, effective dates, and scope of queries.
- [ ] Outlet is explicitly evidenced and reviewed; catchment polygon is generated and independently checked.
- [ ] A complete manifest and report are generated without fabricated missing values.
- [ ] Unit/integration tests prove that missing DEM, unknown outlet, invalid datum, or failed source calls block modeling.
- [ ] CI status is observed and recorded for the exact main SHA; no status records means unverified.
- [ ] Human approval is separate from automated technical readiness.

## Operational constraints

The system should automate acquisition, parsing, geometry checks, caching, report generation, and repeatable tests. It must not automate away survey authority, FEMA determinations, field verification, modeler judgment, or professional sign-off. The user-facing experience should explain the single highest-value missing item, while continuing all independent tasks that can safely proceed.
