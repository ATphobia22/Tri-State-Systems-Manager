# Real-Time Data Operations

**Verified architecture date:** 2026-09-12

## Runtime flow

Authoritative provider → server-side adapter → normalization/contract validation → evidence/cache layer → TSM API → React/MapLibre.

Browser code must not call USGS, NOAA, FEMA, Indiana GIS, or USACE operational endpoints directly when the data is part of the TSM decision-support plane.

## Hydrologic sources

- **NOAA NWPS:** first live observed-stage attempt for the TSM console; NWS gauge `NHRI3` is the New Harmony Wabash identifier. Forecast and observed products remain separate data classes.
- **USGS Water Data API:** fallback for authoritative instantaneous observations. Runtime uses `latest-continuous`; parameter `00065` is gage height and `00060` is discharge. Raw stage remains `GAGE_DATUM`.
- **Legacy USGS WaterServices IV:** compatibility/evidence path only. USGS states the WaterServices family is scheduled for decommissioning in early 2027; it is not the runtime dependency.
- Every observation carries `observedAt`, `retrievedAt`, source identifier, provenance, status, CRS, and vertical datum. USGS provisional observations retain qualifier `P`.

## Spatial source classes

- **FEMA NFHL:** effective/insurance reference; never conflated with Indiana Best Available data.
- **Indiana Best Available Flood Hazard Layer:** planning/construction/Indiana Flood Control Act reference; not an insurance determination source.
- **Indiana Current Parcel Boundaries:** current statewide Data Harvest FeatureServer; spatial geometry queries are preferred over synthetic/mock parcels.
- **USGS TNM/3DEP:** elevation/lidar discovery and coverage; derived EvidenceArtifacts carry SHA-256 provenance.
- **USACE NLD2:** read-only levee evidence; no automatic accreditation determination.

## Freshness

A source that exceeds its configured freshness threshold is reported as stale/degraded rather than replaced with a fabricated reading. Provider outage is surfaced as `unavailable`. Observed and retrieval timestamps are never collapsed.

## Failure handling

Transport requests use timeouts, bounded response sizes, limited retries, exponential backoff, circuit protection, and fail-closed validation. A malformed or provenance-free provider response is rejected.

## Provenance minimum

`sourceId`, `sourceUri`, `observedAt`, `retrievedAt`, `status`, `dataClass`, `unit`, `crs`, `verticalDatum`, and a provider provenance object are mandatory.

## Regulatory boundary

Live observations are decision-support evidence, not regulatory determinations. FEMA effective products, Indiana DNR Best Available/FARA processes, local ordinances, and engineering/survey documents retain their respective authority. TSM does not issue LOMA, CLOMR, LOMR, No-Rise, FARA, or floodplain permits.

## Operator recovery

1. Check `/api/data-sources/health`.
2. Identify the failed provider and last successful retrieval.
3. Verify provider status and schema before retrying ingestion.
4. Never insert a guessed reading to restore UI continuity.
5. Record any manual evidence with explicit source, acquisition time, validation status, and human review.
