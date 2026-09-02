# External Repository Integration Architecture

## Purpose

TSM integrates external repositories as governed capability sources. The canonical TSM repository owns application behavior, engineering contracts, authoritative geospatial truth, evidence/provenance, and CI policy.

## Source policy

All seven approved external repositories are pinned by immutable commit SHA in `integrations/registry/capabilities.json`. Branch names are documentation-only and never production references.

## CI topology

`ci.yml` is the canonical application pipeline. It performs dependency installation, commit binding, capability/security gates, repository integrity, geospatial contract validation, parsing, typechecking, production build, and the existing test suites.

Specialized workflows are independently dispatchable:

- `infrastructure-ci.yml` — optional infrastructure patterns and shell safety.
- `geospatial-ci.yml` — geospatial/3D contracts and optional licensed CityEngine/Unreal builds.
- `container-ci.yml` — container definition and integration-test topology validation.
- `quantum-ci.yml` — isolated research-only quantum contracts.

The former duplicate `tsm-console-ci.yml` pipeline is removed so the repository has one application CI truth.

## Geospatial authority

External 3D references do not become authoritative data. Generated assets require explicit source CRS, target CRS, vertical datum, toolchain, provenance, and SHA-256 metadata before promotion.

## CityEngine / Unreal

CityEngine and Unreal are treated as licensed offline build capabilities. They require dedicated Windows infrastructure and are never assumed available on normal GitHub-hosted Linux runners.

## Quantum

OpenFermion-Cirq is archived/deprecated. It is retained only as a research/reference source. Quantum outputs are schema-bound, content-addressed, research-only, and prohibited from directly mutating regulatory, public-safety, or evidence truth.

## Security

TSM does not execute arbitrary fetched shell content. Curated scripts are syntax-checked and scanned for remote-pipe execution patterns. Workflows use explicit read-only repository permissions, and specialized infrastructure is isolated from production credentials.
