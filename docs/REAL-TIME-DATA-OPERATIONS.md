# Real-Time Data Operations

## Runtime flow

Authoritative provider → server-side adapter → normalization/contract validation → cache/evidence layer → TSM API → React/MapLibre.

Browser code must not call USGS, NOAA, FEMA, Indiana GIS, or USACE operational endpoints directly when the data is part of the TSM decision-support plane.

## Hydrologic sources

- **USGS NWIS IV:** parameter `00065` is gage height and `00060` is discharge. Raw stage remains `GAGE_DATUM`.
- **NOAA NWPS:** observed and forecast stage/flow products are distinct data classes and must not be merged.
- Every observation carries `observedAt` and `retrievedAt`.

## Freshness

The cache is TTL-based. A source that exceeds its configured freshness threshold is reported as stale/degraded rather than replaced with a fabricated reading. Provider outage is surfaced as `unavailable`.

## Failure handling

Transport requests use timeouts, bounded response sizes, limited retries, exponential backoff, and fail-closed validation. A malformed or provenance-free provider response is rejected.

## Provenance minimum

`sourceId`, `sourceUri`, `observedAt`, `retrievedAt`, `status`, `dataClass`, `unit`, `crs`, `verticalDatum`, and a provider provenance object are mandatory.

## Regulatory boundary

Live observations are decision-support evidence, not regulatory determinations. FEMA NFHL, Indiana DNR/INFIP/Best Available Floodplain, local ordinances, and engineering/survey documents retain their respective authority. TSM does not issue LOMA, CLOMR, LOMR, No-Rise, FARA, or floodplain permits.

## Operator recovery

1. Check `/api/data-sources/health`.
2. Identify the failed provider and last successful retrieval.
3. Verify provider status and schema before retrying ingestion.
4. Never insert a guessed reading to restore UI continuity.
5. Record any manual evidence with explicit source, acquisition time, validation status, and human review.
