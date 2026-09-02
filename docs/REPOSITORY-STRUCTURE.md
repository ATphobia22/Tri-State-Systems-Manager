# TSM Canonical Repository Structure

**Status:** Engineering control document  
**Applies to:** `main` and all derived working branches

## Purpose

This document defines the expected ownership and authority boundaries for the Tri-State Systems Manager repository. It is intended for government engineers, GIS analysts, software engineers, reviewers, and maintainers.

## Top-level boundaries

| Path | Authority / purpose | Change standard |
|---|---|---|
| `.github/workflows/` | CI/CD policy and automated verification | Security-sensitive; preserve fail-closed behavior |
| `backend/` | Server-side Python helpers and government-domain services | Typed, validated, testable |
| `data/` | Source-controlled datasets, registries, schemas, and provenance-controlled artifacts | Preserve provenance; never silently overwrite authoritative data |
| `db/` | Database migrations and persistence definitions | Forward-compatible, reviewed, reversible where practical |
| `docs/` | ADRs, operating procedures, evidence guidance, governance, engineering records | Dated when establishing a historical decision |
| `packages/` | Shared schemas/contracts | Backward compatibility and explicit versioning |
| `scripts/` | Validation, CI gates, ingestion, GIS, and operational automation | Fail closed; no secret material |
| `tools/` | Specialized engineering/data tooling | Must identify input/output contracts |
| `tsm-console/` | Production React/TypeScript console, Node proxy, ingestion, tests | Production code; strict types and security boundaries |

## Authoritative-contract locations

- Site constants: `data/schemas/tsm-site-constants-13101-bonebank.json`
- Data contract: `tsm-data-contract-schema-v1.0.0.json` and/or its versioned canonical schema location when migrated
- Evidence artifact contract: `tsm-evidence-artifact-schema-v1.0.0.json`
- Authority registry: `tsm-authority-registry-v35.json`
- Gage datum conversion: `tsm-console/src/lib/gage-datums.ts`
- FEMA panel SSOT: `tsm-console/src/lib/firm-panel-ssot.ts`
- Jurisdiction rules: `tsm-console/src/lib/jurisdiction-rules.ts`
- Ingestion workers: `tsm-console/server/ingestion/workers.mjs`
- Agentic policy: `docs/ADR-006-Agentic-Autonomy-Ladder-and-Tool-Scope-Policy.md`

## Classification rules

### Production

Code executed by the console, API, ingestion path, or deployment system.

### Authoritative data and contracts

Data or schemas used to establish engineering inputs, provenance, jurisdiction, or evidence semantics. These require explicit source and version information.

### Research / experimental

Quantum, open-world visualization, prototypes, or exploratory model integrations. Experimental code must not become a hidden dependency of a regulatory or governance write path.

### Generated / temporary

Build output, caches, downloaded intermediates, screenshots, logs, and other reproducible artifacts. These may be removed when they are not an evidence artifact or required source-controlled input.

### Ambiguous / historical

Material whose authority or purpose cannot be established from the repository alone. Do not delete it until references and supersession status are established.

## Repository cleanup rule

A path is removable only when at least one of the following is demonstrated:

1. It is generated and reproducible and is not an evidence artifact.
2. It is an unused temporary artifact with no operational or documentation references.
3. It is an exact duplicate whose authoritative replacement is documented.
4. It is superseded by a newer contract and the supersession relationship is recorded.

Deletion decisions are recorded in `docs/REPOSITORY-CLEANUP-LEDGER.md`.
