# Posey Authoritative Acquisition Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the Posey offline bundle from packaging unless every required FEMA, USGS, Indiana DNR/GIO, and USACE source artifact is acquired, hash-valid, and spatially constrained to the exact Posey County boundary.

**Architecture:** Acquisition resolves the exact 2025 Posey County polygon from U.S. Census TIGERweb, then uses ArcGIS `esriSpatialRelWithin` for strict spatial extracts. A versioned source-requirement manifest defines mandatory artifacts, while a PowerShell validator checks receipt schema, FIPS/GEOID, files, hashes, authority IDs, feature/byte minimums, and spatial policy before packaging.

**Tech Stack:** PowerShell 7, GitHub Actions Windows 2022, ArcGIS REST, U.S. Census TIGERweb, FEMA NFHL, USGS TNM/Water Services, Indiana ArcGIS Enterprise, USACE NLD.

**Spec:** `data/posey-county/authoritative-source-requirements-v1.json`

## Global Constraints

- Posey County FIPS/GEOID is `18129`.
- Exact county boundary vintage is 2025-01-01.
- Strict spatial extraction uses `esriSpatialRelWithin`.
- Required artifacts must be non-empty and SHA-256 verified.
- Missing required sources fail the workflow; no soft-pass based on total file count.

## Review Focus

- Missing/renamed required artifact IDs must fail.
- Duplicate receipt IDs must fail.
- Bbox-only extraction must not satisfy strict spatial validation.
- Empty required feature sources must fail when a positive minimum is specified.
- Source bytes/hash drift must fail.

### Task 1: Mandatory source contract

- [x] Define `data/posey-county/authoritative-source-requirements-v1.json` with FEMA, USGS, Indiana, and USACE requirements.
- [x] Enumerate each USGS SIR artifact separately.

### Task 2: Strict acquisition

- [x] Replace bbox extraction with exact Census TIGERweb county geometry.
- [x] Use `esriSpatialRelWithin` for spatial source acquisition.
- [x] Record boundary provenance and receipt schema v2.
- [x] Add broader FEMA NFHL layers and Indiana/USACE spatial sources.

### Task 3: Workflow gate

- [x] Add `scripts/posey/verify-offline-authoritative-data.ps1`.
- [x] Replace the old >=10-file check with mandatory-source validation.
- [x] Generate the complete SHA-256 inventory only after validation.

### Task 4: Verification

- [ ] Run the GitHub Actions acquisition workflow on Windows 2022.
- [ ] Inspect failed endpoints and correct any source-specific incompatibilities.
- [ ] Require a successful validation step before treating the ZIP as releasable.
