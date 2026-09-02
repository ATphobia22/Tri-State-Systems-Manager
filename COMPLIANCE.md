# Compliance & Engineering Governance

## Overview

Tri-State Systems Manager (TSM) uses explicit verification gates to protect the integrity, reproducibility, provenance, accessibility, and auditability of spatial, geospatial, infrastructure, and system-management workflows.

This document defines the repository-level engineering boundary. It does not itself constitute legal, regulatory, engineering, surveying, floodplain-management, procurement, or other professional certification.

## Verification Gates

The production console is expected to pass the repository's applicable automated gates before release:

- **Parse gate:** validates source syntax and parser-level integrity.
- **Type gate:** validates the strict TypeScript contract.
- **Test gate:** executes the configured unit/integration test suites.
- **Build gate:** produces the production application artifact.
- **Integrity gate:** validates repository-specific deterministic integrity requirements.
- **Dependency reproducibility:** CI installs from the committed lockfile and checks lockfile reproducibility.
- **Dependency provenance:** resolved npm package URLs must use the public npm registry unless an explicitly governed exception is documented.

## Data and Geospatial Integrity

Imported vector, raster, tabular, and derived geospatial data must retain sufficient provenance to establish:

1. source organization and dataset identity;
2. acquisition or publication timestamp when available;
3. coordinate reference system and transformation metadata where applicable;
4. source version or revision identifier where available;
5. processing and derivation steps;
6. validation status and known limitations.

Production workflows must fail closed when required provenance, schema, coordinate-system, integrity, or validation requirements cannot be established.

## Evidence and Public-Interest Boundary

The Evidence Ledger and associated governance controls are authoritative system records within the TSM architecture. Automated analysis, AI assistance, visualization, or inference must not silently overwrite authoritative evidence or human determinations.

Where a workflow requires a human authority, the system must preserve that authority boundary and clearly distinguish:

- source evidence;
- machine-derived analysis;
- model inference;
- proposed action;
- human decision;
- public presentation.

## Security Baseline

- Repository workflows use least-privilege permissions by default.
- Credentials, tokens, private keys, and cloud secrets must not be committed.
- CI dependency installation should use the authoritative lockfile.
- Security advisories and credential incidents must be handled privately rather than through public issues.
- Automated dependency updates should be reviewed before production release.

## Change Governance

Changes affecting evidence integrity, security boundaries, geospatial processing, public data presentation, or authoritative determinations require review proportional to their impact.

A branch that is already fully behind `main` and contains no commits ahead of `main` is not to be merged merely for historical consolidation. Its useful changes must first be demonstrated as absent from current `main` before any selective recovery is attempted.

## Scope and Limitations

This file establishes engineering governance expectations for the repository. It does not claim compliance with a specific federal, state, local, contractual, accessibility, environmental, floodplain, records-retention, cybersecurity, or procurement regime unless that regime is separately identified, mapped, and verified against its current authoritative requirements.
