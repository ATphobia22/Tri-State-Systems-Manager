# Tri-State Systems Manager — Authoritative Real-Time Data Fabric Design

**Date:** 2026-09-07  
**Status:** Approved in conversation; written-spec review required before implementation planning  
**Scope:** Replace production mocks/placeholders and stale authoritative-data assumptions with verified real-world, source-provenanced, live/historical/forecast data services.

## 1. Objective

Make real-world authoritative data the production source of truth for TSM. The application must not fabricate operational observations, floodplain geometry, elevation products, levee records, parcel/PLSS context, or forecasts. Where an authoritative provider offers live data, TSM will retrieve it through a controlled backend ingestion/API layer and expose freshness and source status to the user.

Static repository data is permitted only when it is one of the following:

1. an authoritative historical/evidence snapshot retained for reproducibility;
2. a versioned engineering constant or derived value with explicit provenance/formula;
3. a deterministic test fixture clearly isolated from production runtime; or
4. metadata needed to discover/query an authoritative service.

A demo/test fixture must never be silently presented as current operational data.

## 2. Governing Principles

1. **Authoritative source first.** Prefer the originating federal/state agency or its official service over third-party mirrors.
2. **Real-time means live retrieval, not committed snapshots.** Live observations are retrieved at runtime or on a documented ingestion cadence; snapshots are evidence artifacts, not substitutes.
3. **Provenance is mandatory.** Every observation/dataset record carries source, source identifier, retrieval time, source observation/publication time when available, endpoint/product, units, CRS, vertical datum, quality/status, and transformation history.
4. **Observed, forecast, simulated, and derived data remain distinct.** They cannot be merged into one undifferentiated value stream.
5. **No silent datum conversion.** Gage height remains in its source datum unless a validated station/product-specific relationship permits conversion to NAVD88.
6. **No silent regulatory interpretation.** FEMA/IDNR/USACE data informs engineering and governance views but does not constitute an automatic permit, LOMA/LOMR/CLOMR, No-Rise, FARA, or other regulatory determination.
7. **Fail closed on uncertainty.** Missing source metadata, failed validation, stale data, or contradictory datum information must produce an explicit unavailable/degraded state rather than a fabricated fallback.
8. **Backend mediation.** React/MapLibre must not directly own provider credentials, uncontrolled polling, source retries, or regulatory source interpretation.
9. **Idempotent ingestion.** Repeated retrieval of the same source record must not create duplicate evidence records.
10. **Source health is visible.** The UI/API reports freshness, last successful retrieval, source status, and degraded conditions.
11. **Rate-limit aware.** Providers' service limits are respected with bounded retries, exponential backoff, caching, conditional requests where supported, and request coalescing.
12. **No proprietary dependency in the core path.** Public federal/state services remain the primary source fabric.

## 3. Authoritative Source Registry

### Federal

- **USGS National Map / TNM:** elevation, lidar/3DEP, hydrography and related National Map products; use TNM Access and official download/service mechanisms for discovery and acquisition.
- **USGS Water Services / NWIS:** live and historical stream observations, including parameter `00065` gage height and `00060` discharge.
- **NOAA National Water Prediction Service (NWPS):** observed and forecast stage/flow products, gauge metadata, ratings, reaches, and monitoring products.
- **FEMA NFHL REST:** effective flood hazard zones, BFEs, FIRM panels, LOMAs/LOMRs, cross sections, levees, gages, high-water marks, reaches, and study metadata where published by the service.
- **USACE National Levee Database:** levee-related public spatial data and service endpoints.

### Indiana

- **Indiana DNR Best Available Floodplain Layer:** state floodplain reference data, including Zone A-quality studies and elevation points where available.
- **Indiana Floodplain Information Portal (INFIP):** FEMA/DNR floodplain and BFE reference and FARA/eFARA workflow information.
- **Indiana GIS / IndianaMap:** official state GIS services, including PLSS and other authoritative statewide layers.

Third-party tools such as `wangsen992/usgs-lidar-download` and Lidarvisor may inform implementation techniques or discovery workflows, but they are not authoritative sources and cannot become TSM's source of truth.

## 4. Data-Fabric Architecture

```text
AUTHORITATIVE FEDERAL / STATE SERVICES
        |
        v
+---------------------------+
| Source Adapters           |
| USGS | NOAA | FEMA | IDNR |
| USACE | Indiana GIS | TNM |
+-------------+-------------+
              |
              v
+---------------------------+
| Retrieval / Resilience    |
| timeout | retry | backoff |
| cache | rate-limit | ETag |
+-------------+-------------+
              |
              v
+---------------------------+
| Normalization + Validation|
| schema | units | CRS      |
| vertical datum | quality  |
+-------------+-------------+
              |
              v
+---------------------------+
| Evidence / Data Governance|
| raw record | normalized   |
| observation | derivation   |
| source artifact | lineage  |
+-------------+-------------+
              |
              +------> PostGIS / object storage / cache
              |
              v
+---------------------------+
| TSM API / query boundary  |
+-------------+-------------+
              |
              v
+---------------------------+
| React / MapLibre / HUD    |
+---------------------------+
```

The source adapter layer owns provider-specific contracts. The normalization layer owns TSM's canonical schema. The governance layer owns provenance and evidence lineage. The API layer owns controlled access and freshness semantics. The UI owns presentation only.

## 5. Canonical Observation Contract

Each live observation shall include, at minimum:

```text
source
source_product
source_identifier
source_endpoint
observed_at
retrieved_at
value
unit
measurement_type
source_datum
vertical_datum (nullable unless explicitly provided)
crs (when spatial)
quality_code/status
freshness_state
raw_payload_hash
adapter_version
transformations[]
```

A derived value additionally requires:

```text
derived_from[]
formula
input_units
output_units
input_datum
output_datum
uncertainty
calculation_version
```

## 6. Hydrology and Datum Rules

USGS/NWS gage height is retained in the source gage datum. TSM must not label a raw `00065` reading as NAVD88.

Where a validated station-specific datum relationship exists, TSM may calculate:

`WSE_NAVD88 = gage_height + gage_zero_NAVD88`

The relationship, station/product identity, units, publication/revision metadata, and validation status must travel with the derived result.

The existing Bonebank engineering constants remain governed by their existing SSOT and must not be overwritten by live gage observations. A live stage may be compared against BFE/FFE/berm values only after the datum and unit relationship is valid.

## 7. Real-Time Semantics

TSM will expose explicit freshness classes:

- `LIVE`: source observation is inside its configured freshness budget.
- `RECENT`: source is available but outside the preferred live window and still within the maximum acceptable operational window.
- `STALE`: last source observation/retrieval exceeds the maximum operational age.
- `DEGRADED`: provider or adapter is failing; last-known data may be displayed only with its age and degraded status.
- `UNAVAILABLE`: no trustworthy current value exists.
- `HISTORICAL`: intentionally queried historical evidence.
- `FORECAST`: model/provider forecast, never presented as observation.
- `SIMULATED`: TSM model output, never presented as observed/forecast source data.

Freshness thresholds are provider/product-specific and must be configuration, not hard-coded assumptions in UI components.

## 8. Dataset and Geospatial Handling

### 3DEP / LiDAR

3DEP discovery must use official National Map services. TSM shall retain product metadata and quality information, including product type, acquisition/collection information where supplied, nominal resolution/pulse-spacing metadata where supplied, horizontal/vertical reference, source date, download URL, checksum/hash, and licensing/usage metadata.

Large LAS/LAZ/DEM assets must not be loaded wholesale into the browser. TSM should discover/index them server-side and serve appropriately tiled/derived products for visualization.

### FEMA NFHL

The current NFHL service is queried by layer/service contract rather than relying on a stale hand-maintained layer count. TSM shall dynamically inspect service metadata and record the retrieved service definition/version timestamp. Queryable layers must be mapped to canonical TSM feature types with source layer IDs preserved.

### Indiana GIS / PLSS

Native service CRS must be preserved in source metadata. Reprojection for display must be explicit and performed by a geospatial library/service rather than silently assuming the source CRS.

### USACE NLD

Levee records retain NLD identifiers and source-service lineage. TSM does not infer structural safety or regulatory status from geometry alone.

## 9. Storage and Caching

The implementation shall support:

- raw provider payload retention where legally and operationally appropriate;
- normalized relational records;
- PostGIS geometry for spatial records;
- object storage for large source artifacts;
- content hashes for evidence identity;
- retrieval timestamps;
- source publication/update timestamps;
- bounded cache TTLs;
- stale-while-revalidate only where the UI clearly labels cached values;
- idempotent upserts keyed by source/product/record identity and observation timestamp;
- retention policies appropriate to the source and evidence class.

Caching must improve resilience without turning a live product into a hidden snapshot product.

## 10. Failure Handling

Provider failures must never trigger synthetic replacement values. Instead:

1. retry transient failures with bounded exponential backoff;
2. honor provider rate limits;
3. mark the adapter/source health state;
4. expose the last successful observation with age only when policy permits;
5. mark it `DEGRADED`/`STALE` rather than current;
6. emit structured operational diagnostics;
7. preserve the failed retrieval attempt as telemetry/evidence metadata where appropriate.

Schema changes, malformed responses, datum mismatches, or unexpected units are hard validation failures for the affected record.

## 11. Placeholder and Mock Elimination

A repository-wide production-data audit will classify every static operational value as:

1. authoritative live source;
2. authoritative historical evidence;
3. engineering constant/derived value;
4. test fixture;
5. UI placeholder/mock;
6. unsupported/synthetic operational value.

Categories 5 and 6 are removed from production paths. Category 4 remains only in explicit test/demo fixtures and cannot be imported by production adapters or runtime modules.

The CI gate shall detect common mock/synthetic markers in production data paths and fail when new operational placeholders are introduced.

## 12. Security

- No provider secrets in browser bundles.
- Public agency endpoints may be called server-side without secret material where their service design permits.
- Authentication/authorization remains separate from public-source acquisition.
- SSRF protections are required for any future user-configurable source URL.
- External payloads are untrusted input and must be schema-validated before persistence or rendering.
- Request sizes, response sizes, decompression, timeouts, and concurrency are bounded.
- Large geospatial downloads are streamed and checksum-validated rather than loaded into memory indiscriminately.

## 13. Testing and CI

Required automated validation includes:

- source adapter contract tests;
- mocked HTTP responses for deterministic unit tests only;
- schema validation tests;
- timestamp/freshness tests;
- CRS/vertical-datum tests;
- idempotency tests;
- retry/rate-limit tests;
- malformed-source tests;
- production-path mock detection;
- repository integrity;
- parse/typecheck;
- geospatial gates;
- production build;
- existing application tests;
- live source smoke tests where CI policy and provider availability permit, without making the entire build dependent on an external service's uptime unless explicitly classified as an integration gate.

Test fixtures must be labeled and physically separated from production source adapters.

## 14. Observability

Every adapter exposes:

- request count;
- success/failure count;
- latency;
- last successful retrieval;
- last failure;
- source freshness;
- schema-validation failures;
- rate-limit/backoff events;
- record counts;
- ingestion lag.

Health endpoints must distinguish application health from external-source health.

## 15. Regulatory and Professional Boundaries

The data fabric is an evidence and decision-support system. It does not itself establish legal regulatory determinations. FEMA, IDNR, USACE, county, municipal, and licensed-professional review remains authoritative for their respective decisions.

TSM must not auto-file, certify, seal, or represent a derived computation as an official LOMA, LOMR, CLOMR, No-Rise, FARA, permit, or engineering certification.

## 16. Acceptance Criteria

The implementation is complete only when:

1. Production operational data paths no longer depend on fabricated values or UI mocks.
2. USGS, NOAA, FEMA, IDNR, Indiana GIS, USACE, and TNM/3DEP integrations are implemented or explicitly documented as source-discovery/acquisition services appropriate to their product class.
3. Live observations and forecasts are distinguishable at the API and UI layers.
4. Source and retrieval timestamps are visible in machine-readable API responses and appropriate operator views.
5. CRS and vertical-datum metadata survive ingestion and transformation.
6. Provider failures produce explicit degraded/stale/unavailable states rather than synthetic values.
7. Source health is observable.
8. Historical snapshots remain reproducible and are never mislabeled as live.
9. Production-vs-test fixture boundaries are machine-checked.
10. Existing fail-closed CI/security/geospatial/regulatory gates remain intact.
11. Documentation identifies every authoritative source and its operational role.
12. Verification demonstrates the application can run against real provider data without browser-side provider secrets.

## 17. Explicit Non-Goals

- No synthetic operational data in production.
- No automatic regulatory determinations.
- No silent vertical/horizontal datum transformations.
- No browser-direct uncontrolled polling architecture.
- No dependency on third-party mirrors when an official source is available.
- No weakening of CI to accommodate external-source failures.
- No deletion of historical evidence merely because live data now exists.
