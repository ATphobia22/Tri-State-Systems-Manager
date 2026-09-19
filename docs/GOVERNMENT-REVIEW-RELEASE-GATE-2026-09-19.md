# TSM Government Peer-Review Release Gate — 2026-09-19

## Status

**Engineering release candidate; not agency certification or authorization.**

This document records the repository controls added for pre-agency review. A green repository CI result means the checked-in software contracts passed automated validation; it does not establish professional engineering certification, regulatory approval, Authority to Operate, permit approval, FEMA acceptance, or deployment of external infrastructure.

## Controls completed in this release candidate

- Privacy-reduced PostGIS engineering topology registry in EPSG:2966.
- Geometry validity, positive-area, provenance-hash, review-status, and GiST-index contracts.
- Parcel identity is represented only by an engineering reference token; direct cadastral identity is outside the engineering schema.
- Zone/parcel intersection metrics are restricted to verified engineering geometry.
- Existing bounded HTTP retry, timeout, source-health, and circuit-breaker mechanisms now emit hydrology Prometheus telemetry.
- Hydrology response outcomes distinguish success, source-unavailable, timeout, and circuit-open conditions.
- Circuit state telemetry explicitly clears prior states during transitions.
- Prometheus runtime configuration and hydrology alert rules are checked with pinned `promtool`.
- Missing hydrology telemetry is itself an alert condition.
- Existing evidence signing, LOMA packet signing, terrain fail-closed runtime contract, FEMA evidence contracts, geospatial gates, and supply-chain gates remain in the canonical CI path.

## Deliberate non-claims

The repository does **not** claim:

- that a parcel reference token is anonymous merely because it is hashed;
- that parcel geometry is inherently non-identifying;
- that an engineering zone/parcel intersection proves cut/fill balance, compensatory storage, no-rise, or regulatory compliance;
- that a Prometheus alert proves an engineering or regulatory condition;
- that a missing terrain endpoint is acceptable for operational terrain use;
- that external Keycloak, API, Databricks, PostgreSQL, Prometheus, Alertmanager, Martin, or object-storage infrastructure is deployed merely because configuration exists.

## Agency review trace

Reviewers should be able to trace:

`authoritative source → retrieval → provenance/hash → normalization → validation → model/evidence artifact → visualization/alert → human review`

Automated outputs remain decision support. Human and agency authority remain the final acceptance boundary.

## External acceptance gates still required

Before operational government use, the deployment authority must independently verify the actual target environment and, where applicable:

1. professional engineering/survey review and seal requirements;
2. current FEMA/Indiana DNR/local floodplain source acceptance;
3. project-specific USACE/agency review;
4. environmental and permitting determinations;
5. security assessment/authorization and identity configuration;
6. accessibility/Section 508 applicability and testing;
7. records-management requirements;
8. production terrain/tile endpoint deployment and health;
9. production API/Keycloak bindings;
10. database/PostGIS deployment and backup/restore testing; and
11. operational monitoring/Alertmanager notification delivery.

These are intentionally not represented as software-complete when the external evidence has not been verified.
