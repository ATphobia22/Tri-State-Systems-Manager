# Tri-State Systems Manager — Production Architecture Design

**Date:** 2026-08-20  
**Status:** Approved for implementation planning  
**Repository:** `ATphobia22/Tri-State-Systems-Manager`  
**Primary branch:** `main`

## 1. Purpose

Tri-State Systems Manager (TSM) is a public-interest engineering and intelligence platform for the Tri-State River Valley. It combines authoritative environmental and infrastructure observations, scientific computation, regulatory analysis, evidence governance, AI-assisted analysis, community-benefit analysis, and accessible public visualization without allowing visualization or AI output to silently become authoritative evidence or legal determinations.

## 2. Architectural principles

1. Universal public benefit, including disability access, low connectivity, and low technical literacy.
2. Open-source-first and interoperable architecture where technically appropriate.
3. Safety, traceability, provenance, uncertainty, validation, and human oversight for consequential decisions.
4. Indiana requirements are modeled as a primary jurisdictional constraint; federal, Illinois, and Kentucky requirements remain explicit overlays.
5. Scientific data classes are distinct: observation, authoritative dataset, model output, inference, simulation, procedural visualization, AI reconstruction, and user input.
6. Evidence is recorded by construction with source identifiers, acquisition/observation times, transformations, versions, validation status, and cryptographic integrity metadata.
7. Standards-first interoperability: OGC APIs, GeoJSON, COG, OpenMI, OpenUSD, glTF, 3D Tiles/I3S, WebGPU, and established geospatial standards when they provide genuine value.
8. Accessibility is a system requirement across storage, APIs, maps, alerts, visualization, and public interfaces.
9. Performance optimization must preserve numerical and evidentiary correctness.
10. AI remains subordinate to human governance and cannot silently issue legal, engineering, emergency, medical, or public-policy determinations.
11. Critical analyses must be reproducible from recorded inputs, versions, parameters, and provenance.
12. Components must be replaceable without destroying underlying evidence or data lineage.

## 3. Existing repository baseline

The repository already contains a React/TypeScript console, an authority registry, an evidence artifact schema, and server-side policy/ingestion components. The existing README describes four planes and a fail-closed evidence architecture. The current console package uses React 19, React Router 7, MapLibre GL, Three.js, and Vite.

The existing `tsm-authority-registry-v35.json` contains important verified corrections. In particular, USGS 03322000 is modeled as Ohio River at Evansville, Indiana rather than the previously incorrect Uniontown/John T. Myers label; USGS 03378500 is Wabash River at New Harmony; NOAA NWPS is a distinct hydrologic prediction authority; FEMA NFHL and Indiana BAFM/FARA must remain separate authority layers; FY2026 EPA Brownfields competition is historical/closed while FY2027 intelligence is future-facing; and XSoft parcel access remains provisional until independently verified.

## 4. Authority and evidence architecture

The platform SHALL separate three truth domains:

- **Authoritative truth:** source observations, authoritative datasets, regulatory publications, and signed/hashed evidence artifacts.
- **Computational truth:** model outputs, simulations, analytics, forecasts, uncertainty, and derived products.
- **Visual truth:** rendering, procedural geometry, WebGPU effects, and cinematic presentation.

These domains may reference one another through immutable IDs and provenance edges but SHALL NOT silently overwrite one another.

The evidence ledger SHALL be append-oriented and server-controlled. Browser-generated random values SHALL NOT be represented as cryptographic seals. SHA-256 provides integrity verification; it does not itself establish scientific validity, legal admissibility, or FRE 702 compliance.

## 5. Data plane

PostgreSQL/PostGIS SHALL hold normalized metadata, observations, geometries, authority records, rule versions, findings, provenance relationships, audit events, and references to object-storage artifacts. Large raster, PDF, imagery, point-cloud, 3D, and export artifacts SHALL live in versioned S3-compatible object storage. Spatial indexes, explicit CRS metadata, vertical reference metadata, and acquisition epochs are mandatory where applicable.

## 6. Ingestion plane

Authoritative ingestion SHALL run server-side through isolated workers. Initial source families are USGS NWIS, NOAA NWS/NWPS, FEMA GIS/NFHL, Indiana GIO imagery/elevation, Indiana DNR/INFIP, Indiana parcel datasets, grant/funding sources, and explicitly provisional cadastral endpoints.

Every worker SHALL:

- validate transport/content type;
- distinguish HTML/WAF/error payloads from expected machine-readable responses;
- preserve source payloads or deterministic content references where permitted;
- calculate SHA-256 hashes;
- normalize records into typed schemas;
- record acquisition and source timestamps;
- retain source identifiers and endpoint versions;
- record transformation history;
- attach validation status and uncertainty;
- fail closed when authoritative validation cannot be completed;
- fall back only to clearly labeled cached/offline data where policy permits.

## 7. Regulatory plane

Regulatory rules SHALL be versioned data/configuration rather than UI conditionals. Each rule evaluation SHALL record jurisdiction, authority, citation, effective/version date, inputs, units, thresholds, rule result, uncertainty, and evidence references. The engine SHALL not infer that a simulated slider value constitutes a permit determination.

Indiana is the primary jurisdiction for the Point Township/Posey County deployment, with federal overlays and explicit Illinois/Kentucky rule sets. FEMA NFHL, Indiana BAFM, FARA/eFARA, and terrain/hydrology supporting evidence SHALL remain distinguishable.

## 8. Scientific/simulation plane

Hydrologic observations and predictions SHALL remain separate. Forecasts SHALL NOT be represented as observed gage measurements. Scientific simulations SHALL carry model version, input evidence IDs, parameters, numerical method, units, CRS/datum, uncertainty, and reproducibility metadata.

Synthetic water meshes, HAZUS-like loss approximations, procedural terrain, and visualization geometry SHALL be classified as derived/simulation products unless independently grounded and validated.

## 9. AI Governance Plane

The AI subsystem SHALL include model registry, model cards, dataset lineage, evaluation results, prompt/configuration versions where relevant, output classification, uncertainty/confidence, human review gates, and audit events. AI output SHALL never mutate authoritative evidence directly.

AI may assist classification, anomaly detection, summarization, discovery, hypothesis generation, prioritization, and visualization. AI may not silently certify compliance, engineering safety, emergency decisions, medical determinations, or policy outcomes.

## 10. Community Benefit and Human Needs Graph

A graph/data model SHALL connect people/community needs, infrastructure, hazards, accessibility barriers, public assets, proposed projects, benefits, costs, funding pathways, and evidence. Sensitive personal information SHALL not be collected merely because it is technically possible. Public-facing aggregate indicators SHALL be separated from restricted operational data.

## 11. API plane

The API layer SHALL provide typed REST/OpenAPI endpoints, standards-aligned geospatial endpoints where appropriate, WebSocket/realtime streams for non-authoritative live state, evidence verification endpoints, rule evaluation endpoints, and public data endpoints. Authentication, authorization, rate limits, validation, audit logging, CORS policy, and content-type enforcement SHALL be centralized.

## 12. Frontend and WebGPU plane

The existing PTDT console SHALL evolve into an evidence-aware client. Direct browser ingestion from authoritative endpoints SHALL be removed or constrained to intentionally public visualization services. The UI SHALL consume typed API resources and display provenance/status labels.

WebGPU SHALL be an optional accelerated rendering path. Public information SHALL remain available without WebGPU. MapLibre remains the geospatial navigation layer; WebGPU/Three.js/OpenUSD/glTF/3D Tiles are used when they materially improve 3D analysis or visualization.

## 13. Accessibility plane

Accessibility SHALL include semantic HTML, keyboard navigation, screen-reader labels, focus management, reduced-motion behavior, text alternatives for maps, accessible tables, downloadable data, printable reports, low-bandwidth mode, non-WebGPU mode, error messaging, and machine-readable public APIs. The public portal SHALL never require the cinematic renderer to access essential information.

## 14. Security and operations

The platform SHALL use least privilege, secret isolation, dependency auditing, signed/reproducible artifacts where practical, structured audit logs, OpenTelemetry-compatible observability, backups, disaster recovery procedures, and explicit retention policies. Public endpoints SHALL be rate-limited and protected against SSRF, path traversal, malicious geospatial payloads, oversized objects, content-type confusion, and untrusted file execution.

## 15. CI/CD and verification

CI SHALL include TypeScript compilation, unit/integration tests, schema validation, database migration tests, geospatial CRS/geometry tests, evidence hash verification, provenance tests, API contract tests, accessibility checks, dependency/security scanning, WebGPU/shader validation where supported, and 3D format round-trip tests where implemented. A production deployment gate SHALL fail closed when required verification stages fail.

## 16. Non-goals

- The browser is not an evidence authority.
- A cryptographic hash is not a legal certification.
- Synthetic visualization is not a survey, engineering certification, or regulatory map.
- AI output is not an autonomous decision authority.
- The platform does not replace licensed engineers, surveyors, attorneys, emergency officials, regulators, physicians, or other legally required decision-makers.

## 17. Acceptance criteria

The implementation is acceptable only when an end-to-end path can ingest an authoritative observation, preserve its source payload/reference, validate and normalize it, persist provenance in PostgreSQL/PostGIS, hash and store the artifact, expose it through a typed API, render it in the frontend with an evidence classification, reproduce the transformation chain, and demonstrate that a failed or unverified source cannot silently become authoritative state.
