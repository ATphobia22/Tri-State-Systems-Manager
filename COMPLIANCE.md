# Compliance & Engineering Governance

## Overview

Tri-State Systems Manager (TSM) uses explicit verification gates to protect integrity, reproducibility, provenance, accessibility, and auditability of spatial, geospatial, infrastructure, and system-management workflows.

This document defines the repository engineering boundary. It is **not** a legal, regulatory, engineering, surveying, floodplain-management, procurement, cybersecurity authorization, records-management certification, or professional engineering certification.

## Government peer-review posture

TSM is structured as an evidence-first engineering and visualization system suitable for technical peer review. The repository deliberately distinguishes:

- authoritative source data;
- transformed/derived data;
- live telemetry;
- model inputs;
- model outputs;
- simulation demonstrations;
- machine analysis;
- proposed actions; and
- human/agency determinations.

No software state may self-promote a simulation or machine inference into a regulatory determination.

### Floodplain and engineering authority boundary

- **FEMA NFHL** is retained as the federal effective/insurance reference plane. It is not merged with Indiana BAFM.
- **Indiana BAFM** is retained as a distinct Indiana Division of Water planning / Flood Control Act context plane. BAFM documentation states that it is not a substitute for FEMA NFHL flood-insurance determinations and that approximate floodways require caution.
- HEC-RAS outputs are model evidence and remain `SIMULATION_DEMO` / `MODEL_OUTPUT` until qualified human review and any required agency process.
- A TSM display is never itself a floodplain permit, Letter of Map Change, insurance determination, engineering certification, or agency approval.

The system must be reviewed against the applicable current FEMA/NFIP requirements, Indiana statutes/rules, local ordinances, project-specific permit conditions, and agency procedures before operational reliance.

## Verification Gates

The production console is expected to pass the repository's applicable automated gates before release:

- **Parse gate:** validates source syntax and parser-level integrity.
- **Type gate:** validates the strict TypeScript contract.
- **Test gate:** executes configured unit/integration/contract suites.
- **Build gate:** produces the production application artifact.
- **Integrity gate:** validates deterministic repository requirements.
- **Dependency reproducibility:** CI installs from the committed lockfile.
- **Dependency provenance:** resolved npm package URLs must use the public npm registry unless an explicitly governed exception is documented.
- **Geospatial source contract:** authoritative endpoints, layer identifiers, CRS/datum metadata, and source authority labels are tested.
- **Evidence contract:** model/data artifacts require provenance, transformation, validation, hash, and human-review metadata.

## Data and Geospatial Integrity

Imported vector, raster, tabular, and derived geospatial data must retain sufficient provenance to establish:

1. source organization and dataset identity;
2. acquisition or publication timestamp when available;
3. coordinate reference system and transformation metadata;
4. source version/revision identifier where available;
5. processing and derivation steps;
6. validation status and known limitations;
7. vertical datum and geodetic transformation where elevation is material; and
8. immutable content hash for retained evidence artifacts where practical.

Production workflows fail closed when required provenance, schema, CRS/datum, integrity, or validation requirements cannot be established.

## Real-time telemetry governance

The live hydrologic path uses NOAA NWPS observed data first and USGS Water Data as fallback. Source identity, observation timestamp, retrieval timestamp, qualifier/status, and discharge availability are preserved. USGS provisional values remain visibly provisional and may be revised by the source agency.

A live observation is not a forecast, regulatory threshold determination, or engineering certification. Runtime refresh is required before an operational display is treated as current.

## Security baseline

- Workflows use least-privilege permissions by default.
- Credentials, tokens, private keys, and cloud secrets must not be committed.
- CI dependency installation uses the authoritative lockfile.
- Security advisories and credential incidents are handled privately rather than through public issues.
- Automated dependency updates require review before production release.
- Government deployments should perform system categorization, risk assessment, control selection/tailoring, assessment, authorization, continuous monitoring, and supply-chain review appropriate to the agency environment. NIST SP 800-53/800-53A/800-53B are reference control frameworks; repository implementation alone does not constitute an agency authorization or ATO.

## Accessibility and records

For federal agency deployments, the deployment owner must determine the applicability of Section 508 and complete the agency's required accessibility evaluation. The repository provides semantic UI and testable labels but does not self-certify Section 508 conformance.

Records retention, disposition, export, legal hold, and official-record designation must be governed by the responsible agency's records-management authority and applicable NARA requirements. Git history and evidence hashes are technical provenance mechanisms, not a substitute for an agency records schedule.

## Change Governance

Changes affecting evidence integrity, security boundaries, geospatial processing, public data presentation, or authoritative determinations require review proportional to impact. Production releases should retain change rationale, source/version information, test evidence, deployment identity, and rollback information.

A branch that is already fully behind `main` and contains no commits ahead of `main` is not to be merged merely for historical consolidation. Its useful changes must first be demonstrated as absent from current `main` before selective recovery.

## Operational acceptance checklist

Before government or engineering operational use, the responsible authority should verify:

- [ ] authoritative source endpoints are reachable and current;
- [ ] live telemetry is freshly retrieved and provenance is visible;
- [ ] NFHL and BAFM are not conflated;
- [ ] terrain source, CRS, vertical datum, and transformation chain are documented;
- [ ] HEC-RAS project inputs and boundary conditions have an identified engineer/model owner;
- [ ] model calibration/validation evidence exists for the intended use;
- [ ] uncertainty and sensitivity are documented;
- [ ] evidence artifacts are hashed and review status is explicit;
- [ ] security, accessibility, records, and procurement requirements have been assessed for the actual deployment environment;
- [ ] required agency permits, approvals, professional certifications, and local ordinances have been separately satisfied; and
- [ ] a human authority accepts operational use.

## Scope and Limitations

This file establishes engineering governance expectations. It does not claim compliance with a specific federal, state, local, contractual, accessibility, environmental, floodplain, records-retention, cybersecurity, or procurement regime unless that regime is separately identified, mapped, and verified against its current authoritative requirements by the responsible authority.
