# Community River-Valley Engineering Twin — Design Basis

TSM is a provenance-first community engineering and decision-support system. It combines authoritative observations, geospatial source metadata, derived engineering calculations, visualization and governance controls without allowing a software result to become an agency determination.

## Authority planes

| Plane | Examples | System treatment |
|---|---|---|
| Observation | USGS, NOAA/NWS | Preserve source timestamp, units, datum, quality and provenance |
| Regulatory reference | FEMA NFHL, Indiana DNR/BAFM | Preserve effective/source metadata; never substitute model output |
| Derived engineering | HEC-RAS, no-rise comparisons, Bishop calculations | Reproducible derived evidence with explicit inputs and uncertainty |
| Visualization | MapLibre, Three.js | Presentation only; display parameters never modify engineering source values |
| Governance | PE/PLS, agencies | Human-controlled status transitions |

## River telemetry

The canonical station registry is artifacts/tsm-river-valley-realtime-stations-v1.json. Current claims require live retrieval. Cached observations may be surfaced only with an explicit stale state. Missing units, datum metadata, source identity or freshness must fail closed.

The existing backend/river-network-api.ts is the resiliency primitive. New services should reuse it rather than introducing a second telemetry gateway.

## Regulatory gates

artifacts/tsm-regulatory-gates-v1.json defines review gates. Software may validate evidence, but it must not infer AGENCY_ACCEPTED.

## LOMA evidence boundary

The supplied FEMA correspondence establishes a document-completeness workflow for the applicable LOMA case: recorded deed or subdivision plat, a local tax assessor map with a FIRM-identifiable street intersection, and elevation evidence unless the effective FIRM clearly places the property or structure outside the SFHA. Elevation evidence must be completed and certified by the qualified professional required by the applicable FEMA form or use a qualifying Elevation Certificate where permitted.

TSM may audit completeness, hashes and metadata. It does not sign the elevation form, certify elevations, issue a LOMA, or replace FEMA or agency review.

## Engineering acceptance

The strongest software state is review-ready evidence. It is not a permit, certification, map amendment, floodway determination, levee accreditation or agency acceptance.
