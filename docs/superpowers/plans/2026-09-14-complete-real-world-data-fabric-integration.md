# Complete Real-World Data Fabric Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and harden the Tri-State Systems Manager real-world hydrologic, geospatial, telemetry, engineering-evidence, observability, and simulation integration on `main` using current authoritative sources and fail-closed engineering boundaries.

**Architecture:** Extend the existing TSM authoritative-data-fabric rather than introducing duplicate Python telemetry gateways or fabricated engineering services. USGS WDFN V1 and official NOAA/NWPS remain authoritative ingestion sources; raw observations retain source datum and provenance; derived WSE, flood products, HEC-RAS results, and engineering calculations remain explicitly derived artifacts. MapLibre is presentation-only, Prometheus/Grafana are observability planes, and HEC-RAS/HDF5 comparisons require real model artifacts and explicit governing criteria.

**Tech Stack:** TypeScript/Node.js, React/MapLibre, Python 3.12, HDF5/h5py, PostgreSQL/PostGIS/TimescaleDB, Prometheus/Grafana, GitHub Actions, official USGS WDFN APIs, NOAA/NWPS APIs, FEMA/Indiana DNR geospatial services.

**Spec:** `docs/superpowers/specs/2026-09-07-authoritative-data-fabric-design.md`

## Global Constraints

- Use official authoritative data sources for regulatory/engineering evidence; third-party mirrors are non-authoritative enrichment only.
- USGS legacy WaterServices is migration-only because USGS is decommissioning it during the 2026-2027 NWISWeb Campaign 3.
- Raw gage height remains in source gage datum; NAVD88 conversion requires validated station/product-specific metadata.
- EPSG:2966 is a horizontal CRS and must never be presented as a vertical datum.
- Do not fabricate WSE, depth, velocity, FoS, no-rise, BFE, forecast, or compliance results.
- No-rise is a computational comparison requiring real base/proposed models and an explicit governing criterion; software does not self-certify regulatory compliance.
- Medical functionality is out of scope for this repository.
- All external ingestion must have timeout, freshness, provenance, content hash, and fail-closed behavior.
- CI must verify contracts and configuration; completion claims require actual GitHub Actions evidence.

---

### Task 1: Authoritative source and station registry audit

**Files:**
- Modify: `tsm-authority-registry-v35.json` and related station metadata files as required
- Modify: `docs/USGS-GAGE-DATUM-CONVERSIONS.md`
- Modify: `docs/NFHL-REST-AND-USGS-WATER-TOOLS.md`
- Test: existing telemetry/data-fabric tests plus new station-contract tests

**Interfaces:**
- Consumes: official USGS station/product metadata and NOAA/NWPS identifiers.
- Produces: canonical station identity, official names, source URI, parameter mappings, datum metadata, and validation status.

- [ ] Verify 03378500, 03322000, and 03322420 identities against official USGS metadata.
- [ ] Preserve 03322420 as `OHIO RIVER AT UNIONTOWN DAM, KY`; model John T. Myers Locks and Dam as related infrastructure only.
- [ ] Correct unsupported or stale datum metadata.
- [ ] Add tests preventing station-name substitution and CRS/vertical-datum conflation.

### Task 2: USGS WDFN V1 migration and telemetry contract hardening

**Files:**
- Modify: `tsm-console/server/ingestion/usgs-nwis.mjs`
- Modify: `tsm-console/server/ingestion/workers.mjs`
- Modify: telemetry contract/schema/test files as required
- Test: USGS adapter contract tests

**Interfaces:**
- Consumes: WDFN V1 continuous/latest-continuous data.
- Produces: canonical telemetry envelopes with observation time, retrieval time, parameter, units, datum, freshness, quality, and provenance.

- [ ] Audit every USGS URL and reject legacy WaterServices dependencies in production ingestion.
- [ ] Preserve V1 date/time semantics and source metadata.
- [ ] Verify 00065 gage height and 00060 discharge handling.
- [ ] Keep observation cadence distinct from UI/WebSocket rendering cadence.
- [ ] Add fail-closed behavior for malformed or empty source responses.

### Task 3: Vertical datum conversion remediation

**Files:**
- Modify: `tsm-console/server/ingestion/workers.mjs`
- Modify: `tsm-console/src/lib/gage-datums.ts`
- Modify: station registry files
- Test: datum conversion tests

**Interfaces:**
- Consumes: source-product gage height plus validated station-specific published zero relationship.
- Produces: explicit `wse_navd88_ft` only when validation metadata exists.

- [ ] Remove unsupported hard-coded zeros from ingestion where authoritative product-matched metadata is absent or stale.
- [ ] Preserve raw `GAGE_DATUM` values regardless of conversion availability.
- [ ] Attach conversion source, version/date, station identity, and validation status to derived WSE.
- [ ] Add regression tests for no-conversion and valid-conversion paths.

### Task 4: NOAA/NWPS observation and forecast separation

**Files:**
- Modify: `tsm-console/server/ingestion/noaa-nwps.mjs`
- Modify: `tsm-console/server/ingestion/workers.mjs`
- Test: NWPS observed/forecast contract tests

**Interfaces:**
- Consumes: official NWPS observation and forecast products.
- Produces: distinct observation and forecast records with source classification and freshness.

- [ ] Validate current NWPS API paths.
- [ ] Ensure forecast records cannot be mistaken for observations.
- [ ] Preserve forecast issuance/valid times where exposed.
- [ ] Add tests for product-type separation.

### Task 5: WebSocket and Prometheus integration

**Files:**
- Modify: existing telemetry WebSocket router/endpoint/gateway only as required
- Modify: `tsm-console/server/telemetry/prometheus-exporter.mjs`
- Modify: `tsm-console/server/telemetry-server.mjs`
- Modify: Prometheus configuration/rules
- Test: telemetry WebSocket and exposition tests

**Interfaces:**
- Consumes: canonical telemetry envelopes.
- Produces: bounded WebSocket frames and Prometheus metrics.

- [ ] Do not add a duplicate Python `websockets` gateway.
- [ ] Add typed station telemetry frames for 03378500, 03322000, and 03322420.
- [ ] Ensure bounded queues/backpressure and disconnect cleanup.
- [ ] Expose stage/discharge/freshness/provenance metrics without presenting derived values as observations.
- [ ] Validate Prometheus configuration and metric syntax.

### Task 6: HEC-RAS HDF5 real-result extraction

**Files:**
- Modify: `backend/engineering/hecras_hdf5.py`
- Modify: `backend/api/v1/hecras_solver.py`
- Add/modify: HDF5 extraction tests

**Interfaces:**
- Consumes: real HEC-RAS `.p##.hdf` result files.
- Produces: discovered WSE/depth/velocity/time-series dataset metadata and slices.

- [ ] Retain dynamic HDF5 dataset discovery.
- [ ] Add separate WSE, depth, velocity, and timestamp extraction contracts where available.
- [ ] Reject fabricated fallback outputs.
- [ ] Preserve model file hashes and dataset paths in evidence.

### Task 7: Engineering evidence and no-rise validation

**Files:**
- Modify: `backend/engineering/no_rise.py`
- Modify: `backend/engineering/bishop.py` as needed
- Modify: `backend/evidence/bfe_provenance.py`
- Modify: methods/evidence documentation
- Test: engineering primitive and evidence tests

**Interfaces:**
- Consumes: real model outputs and validated engineering inputs.
- Produces: reproducible engineering evidence artifacts, never unsupported regulatory certifications.

- [ ] Require explicit governing no-rise criterion.
- [ ] Compare real base/proposed models at common time/mesh semantics.
- [ ] Ensure BFE provenance captures authority, layer/feature/panel identity, effective date, datum/CRS, retrieval, and hash.
- [ ] Make numeric validation use finite-value checks.
- [ ] Keep Bishop FoS calculations deterministic and provenance-bearing; never inject constants as results.

### Task 8: FEMA NFHL and Indiana DNR/INFIP geospatial fabric

**Files:**
- Modify: geospatial source registry/components
- Modify: `tsm-console/src/lib/geospatial-tile-sources.ts`
- Modify: Open World map layers/components
- Add/modify: geospatial contract tests

**Interfaces:**
- Consumes: official FEMA and Indiana DNR/INFIP services.
- Produces: explicit effective-vs-best-available floodplain layers and metadata.

- [ ] Verify official service endpoints before registering them.
- [ ] Distinguish FEMA effective mapping from Indiana Best Available mapping.
- [ ] Preserve source/effective-date/provenance metadata.
- [ ] Correct MapLibre WMS/XYZ tile URL templates and CRS semantics.
- [ ] Keep flood depth overlays separate from `raster-dem` terrain elevation unless the encoding is genuinely terrain-compatible.

### Task 9: PostGIS and spatial integrity

**Files:**
- Modify/add: database spatial schema/migrations
- Test: spatial schema/geometry tests

**Interfaces:**
- Consumes: authoritative floodway/floodplain geometries with declared CRS.
- Produces: indexed spatial layers with validated SRIDs and provenance.

- [ ] Use PL/pgSQL for database triggers.
- [ ] Validate geometry type/SRID and transform only through explicit, audited operations.
- [ ] Keep horizontal CRS and vertical datum metadata separate.
- [ ] Add GIST indexes and geometry validity checks.

### Task 10: Security and alerting

**Files:**
- Modify: Alertmanager/Caddy configuration
- Modify/add: alert receiver integration
- Modify: CI security validation
- Test: authentication/configuration tests

**Interfaces:**
- Consumes: Alertmanager webhook payloads.
- Produces: authenticated, auditable internal alert events.

- [ ] Remove all literal secret placeholders that could be interpreted as production credentials.
- [ ] Use environment/secret-store references.
- [ ] Validate Alertmanager and reverse-proxy configuration.
- [ ] Keep internal metrics loopback/protected as appropriate.

### Task 11: Retention, backup, and data lifecycle

**Files:**
- Modify/add: database retention policy documentation and maintenance jobs
- Modify: deployment/backup configuration if present
- Test: retention dry-run/invariant tests

**Interfaces:**
- Consumes: telemetry/evidence storage classes.
- Produces: auditable retention and backup behavior.

- [ ] Do not blindly delete all telemetry after 90 days.
- [ ] Separate raw observations, forecasts, engineering evidence, audit logs, and derived caches.
- [ ] Add dry-run and protected-evidence behavior.
- [ ] Document restore verification requirements.

### Task 12: CI/CD, build, and end-to-end verification

**Files:**
- Modify: `.github/workflows/ci.yml` and relevant workflows
- Modify: Docker/build files only after dependency/build verification
- Modify: verification record

**Interfaces:**
- Consumes: all subsystem tests and configuration validators.
- Produces: reproducible CI evidence and verified `main` state.

- [ ] Validate Node, Python, database/schema, telemetry, HDF5, geospatial, and security tests.
- [ ] Add C++ gRPC compilation only if the repository contains a real proto/service contract and all generated sources build successfully.
- [ ] Pin external CI container images where practical.
- [ ] Verify GitHub Actions completion, not merely workflow dispatch.
- [ ] Record final commit and CI results in `docs/superpowers/verification/`.

---

## Completion Criteria

- [ ] No production ingestion path depends on USGS WaterServices.
- [ ] 03378500, 03322000, and 03322420 have verified canonical identities.
- [ ] No unsupported datum conversion remains in the authoritative path.
- [ ] Observations, forecasts, simulations, and engineering results are type-separated.
- [ ] HEC-RAS outputs are real-artifact driven and fail closed.
- [ ] No-rise analysis is comparative and criterion-driven, not self-certifying.
- [ ] FEMA and Indiana DNR layers are source-correct and provenance-bearing.
- [ ] WebSocket and Prometheus telemetry are bounded and validated.
- [ ] No embedded credentials exist.
- [ ] Retention does not destroy protected engineering evidence.
- [ ] CI completes successfully on the final `main` commit.
- [ ] Final verification documentation records actual evidence and remaining environmental limitations.
