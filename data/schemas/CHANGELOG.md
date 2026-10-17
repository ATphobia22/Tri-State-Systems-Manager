# TSM Data Schemas — CHANGELOG

Migration notes for schema version bumps. Breaking field/enum/constraint changes require a major version bump. Existing versioned contracts are preserved; new validation semantics are introduced under a new major schema identifier.

## hec-coupled-run-manifest-v2.schema.json

### v2.0.0 — initial release (2026-10-15)

- Adds full source commit identity; pinned HEC-HMS and HEC-RAS model package hashes; adapter executable hashes; separately pinned vendor HEC runtime paths and hashes; version evidence; and strict command/output/timeout contracts.
- Adds explicit DSS source record pathname, element and simulation-run identity, target RAS DSS pathname and version, interval/time-zone, source/target units and an enumerated conversion method.
- Adds an explicit 1D/2D/index-selected RAS boundary selector, and a hash-pinned handoff adapter/script with required run-specific placeholders.
- Execution validation now checks the exact handoff script hash and adapter version against the checked-out source, rejects unresolved/placeholder pins and unapproved AOIs, and validates DSS A-F path semantics and unit-conversion compatibility.
- The orchestration runner uses hash-verified source project copies, disjoint isolated run/output roots, no-shell argv execution, stage logs, explicit DSS boundary wiring, HDF5 signature checks, a content-addressed filesystem store and a run receipt.
- Compatibility: breaking major revision. The original v1 schema/example remain retained and unchanged. Existing v1 manifests are not silently upgraded; create a new v2 operator manifest and requalify all inputs, approval records and hashes.
- Governance: the checked-in v2 example remains DRAFT and must fail execution readiness. Successful solver completion is recorded as COMPLETED_UNVALIDATED, never as engineering approval or regulatory acceptance.

## hec-coupled-run-manifest-v1.schema.json

### v1.0.0 — retained legacy contract (2026-10-15)

- Preserved as the original v1 schema and example for compatibility. This contract predates the additional model-binary, source-commit, exact DSS pathname and boundary-selector pins introduced in v2.
- Migration: no existing v1 artifact is rewritten. V2 requires a fresh manifest with an exact source commit, qualified AOI/delineation, project and runtime hashes, explicit transfer mapping, and approval evidence before execution.

## hec-coupled-run-manifest-v2.schema.json

### v2.0.0 — initial release (2026-10-15)

- Adds exact source commit, approved AOI/watershed hashes, qualified source-input provenance, HEC-HMS run name, HEC-RAS plan number, project-package and vendor executable hashes, version evidence, and explicit output contracts.
- Adds an explicit DSS FLOW pathname and transfer adapter, interval/time-zone/unit conversion policy, and selected RAS boundary selector; the runner retains stage receipts and content-addressed artifacts.
- Requires a Windows x64 Python environment lock SHA-256 and installed-distribution fingerprint including VCS commit IDs. The checked-in draft examples deliberately use unassigned/zero pins and must fail execution readiness.
- Compatibility: major schema version. The v1 schema and example below are retained; do not silently upgrade existing manifests. A v2 run requires fresh approval, source evidence, runtime pins and independent scientific validation.
- Governance: solver completion is not model validation, engineering approval or regulatory acceptance. No real coupled HEC run is claimed by the initial implementation.


## usace-hydrologic-node.schema.json

### 2026-09-25 — v1.0.0 (new)

- New contract for river-management structure / gage nodes sourced from USACE, USGS, and NWS open data (pool elevations, gate status, observed stage). All numeric fields are nullable: null means "not published by the authority," never an estimate. Includes an unknown gate-status class and an observation-only provenance label. The schema confers no regulatory standing.

## tsm-data-contract-schema-v1.0.0.json

### 2026-09-25 (in place, version unchanged)

- Tightened the canonical SHA-256 format to 64 lowercase hexadecimal characters without a prefix.
- Added an optional evidence_tier field, but the number must not be presented as an authority claim.

## geospatial-tile-fabric.schema.json

### v1.0.0 → v1.1.0

- Adds a required scope field and VERIFIED_SERVICE_METADATA as an enum value for assets verified via live service metadata rather than downloaded source data.
- Backward compatibility: v1.1.0 artifacts are not readable by v1.0.0 validators. V1.0.0 artifacts validate against v1.1.0 only if they supply scope; producers must update schemaVersion.
