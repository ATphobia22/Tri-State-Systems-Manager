# Tri-State Systems Manager Repository Remediation Design

**Date:** 2026-09-02  
**Status:** Approved for implementation  
**Scope:** Repository-wide engineering, governance, security, documentation, and configuration remediation

## Objective

Normalize the Tri-State Systems Manager repository into a government-engineering-grade codebase without weakening existing fail-closed controls or changing the system's governing authority model.

## Design Principles

1. **Human authority remains final.** TSM is decision support, not a permitting or regulatory authority.
2. **Evidence before inference.** External observations retain source, timestamp, units, CRS/datum, provenance, and uncertainty metadata.
3. **Fail closed.** Missing or contradictory authority metadata must prevent unsafe regulatory interpretation.
4. **One source of truth per contract.** Site constants, gage datum conversions, jurisdiction rules, schemas, and workflow policies have identifiable authoritative locations.
5. **No silent geodetic transforms.** Raw gage height is never treated as NAVD88 without an explicit, product-matched datum conversion.
6. **Least privilege.** Browser code receives no proprietary identity or provider secrets; workflows receive only the permissions they require.
7. **Reproducibility.** Local, CI, and production builds must resolve the same locked dependency graph and run the same validation gates.
8. **Traceable change.** Structural cleanup must be evidence-based: files are not removed solely because they look unused.
9. **Experimental isolation.** AI/agentic and quantum research capabilities cannot silently enter regulatory or governance write paths.
10. **Government-readable operations.** Documentation must state authority, provenance, operating procedure, validation, limitations, incident response, and escalation paths in language usable by engineers, analysts, administrators, and auditors.

## Remediation Areas

### 1. Repository normalization

- Establish a documented canonical repository map.
- Separate production application code, authoritative data/contracts, operational tooling, research/experimental material, and governance documentation.
- Preserve potentially authoritative material until reference analysis establishes that it is obsolete, duplicated, or superseded.
- Record cleanup decisions rather than silently deleting ambiguous material.

### 2. CI/CD and workflow hardening

- Preserve the current fail-closed validation gates.
- Keep workflow permissions least-privilege.
- Add explicit execution time limits where useful.
- Keep production deployment dependent on successful validation/build output.
- Avoid convenience changes that weaken commit binding, security-boundary, geospatial, artifact, or quantum-isolation gates.

### 3. Application and build configuration

- Keep Node.js 22 as the supported runtime floor.
- Preserve the exact `maplibre-gl` 6.6.0 pin that repaired prior dependency resolution drift.
- Keep npm lockfile and package metadata synchronized.
- Make canonical development, validation, and production commands discoverable from government operator documentation.
- Treat bundle-size findings as performance work items rather than correctness failures.

### 4. Evidence, hydrology, and geospatial integrity

- Centralize datum-aware gage conversion behavior.
- Require explicit source datum and target vertical datum metadata for derived water-surface elevations.
- Preserve CRS and datum labels through ingestion, storage, computation, and presentation.
- Distinguish observations, calculations, simulations, evidence artifacts, and regulatory determinations.

### 5. AI/agent and quantum governance

- Maintain ADR-006 S1 default/no agency behavior.
- Require prescribed tools and a human gate for S2 capabilities.
- Keep S3 deferred.
- Maintain a hard boundary between experimental quantum workflows and regulatory/governance paths.
- Label model-generated material as advisory and preserve provenance.

### 6. Documentation

Replace the project README with a government-engineering operator/developer document covering:

- purpose, scope, users, and authority;
- architecture and trust boundaries;
- authoritative data sources;
- geodetic/hydrologic conventions;
- regulatory limitations;
- repository structure;
- installation and operations;
- configuration and secrets handling;
- CI/CD and verification;
- incident/troubleshooting procedures;
- evidence and change management;
- security and AI governance;
- limitations and professional-review requirements.

## Non-Goals

- Do not convert TSM into an autonomous regulatory system.
- Do not auto-file FEMA or state regulatory instruments.
- Do not replace licensed professional engineering review.
- Do not weaken existing CI gates solely to make a workflow green.
- Do not delete authoritative or potentially authoritative datasets without traceable evidence.
- Do not introduce a proprietary AI provider dependency into the core runtime.

## Acceptance Criteria

- `README.md` is a complete government-engineering entry point.
- Repository structure and ownership boundaries are documented.
- A dated remediation plan is committed alongside this design.
- CI remains fail-closed and least-privilege.
- Hydrologic/geospatial datum rules remain explicit and machine-checkable.
- AI/quantum boundaries remain explicit.
- No cleanup action removes a file without a documented reference/supersession rationale.
- Final validation includes repository integrity, parse, typecheck, geospatial, build, and test gates.
