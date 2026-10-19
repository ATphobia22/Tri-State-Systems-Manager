# Real-Time Data Operations

> **Current policy (2026-10-18): user-triggered read-only snapshots enabled; automatic polling prohibited.** `/api/hydrologic/community` and `/api/hydrologic/live` use server-side NOAA NWPS / modern USGS adapters. Community writes, alerts, and ingestion mutation routes remain retired until separately authorized and tested.

**Verified architecture date:** 2026-09-12

## Runtime flow

Authoritative provider → server-side adapter → normalization/contract validation → evidence/cache layer → TSM API → React/MapLibre.

Browser code must not call USGS, NOAA, FEMA, Indiana GIS, or USACE operational endpoints directly when the data is part of the TSM decision-support plane. Live snapshots go through the TSM API only after a user action; no background polling is permitted.

## Hydrologic sources

- **NOAA NWPS:** first live observed-stage attempt for the TSM console; NWS gauge `NHRI3` is the New Harmony Wabash identifier. Forecast and observed products remain separate data classes.
- **USGS Water Data API:** fallback for authoritative instantaneous observations. Runtime uses `latest-continuous`; parameter `00065` is gage height and `00060` is discharge. Raw stage remains `GAGE_DATUM`.
- **Legacy USGS WaterServices IV:** compatibility/evidence path only; it must not be a production dependency. USGS's current schedule says users should migrate before **2026-11-16**, when intentional delay begins (2 seconds per request). Further staged delays/outages are scheduled for 2027-01-11 (10 seconds), 2027-01-25 (30 seconds), a redirect outage around 2027-01-27, 2027-02-01 (60 seconds), a redirect outage around 2027-02-15, and final decommissioning on 2027-02-22. Schedule: https://waterdata.usgs.gov/blog/wdfn-waterservices-degradation/.
- Every observation carries `observedAt`, `retrievedAt`, source identifier, provenance, status, CRS, and vertical datum. USGS provisional observations retain qualifier `P`.

### Station registry corrections (2026-10-18)

- **McAlpine:** the repository's former station ID `03293600` does not resolve in the modern USGS monitoring-location catalog. The corrected identity is **USGS 03293551**. The official page reports WGS84 coordinates `38.2659037628604, -85.7688518284703` and surveyed land-surface altitude `406.68 ft NAVD88` (0.05-ft accuracy). This altitude is not a gage-zero conversion; the checked page did not establish a recent continuous observation, so the runtime must display unavailable if no value is returned: https://waterdata.usgs.gov/monitoring-location/USGS-03293551/.
- **Old Shawneetown:** USGS 03381700's current monitoring-location page reports a continuous gage-height series through 2026-10-16 and a latest provisional value of 18.02 ft for that date. Coordinates are `37.6925, -88.1347222222222` (WGS84; interpolated from a digital map, ±5 arc-seconds). The page lists 30-ft action, 33-ft minor, 43-ft moderate, and 53-ft major stage thresholds. These are gage-height thresholds, not NAVD88 elevations. USGS also shows station/land-surface altitude `309.1 ft NAVD88` (0.01-ft accuracy); do not treat this as a gage-zero offset. Preserve the observation timestamp and freshness when queried: https://waterdata.usgs.gov/monitoring-location/USGS-03381700/.
- Active station coordinates in the static map layer are WGS84 coordinates copied from official USGS monitoring-location metadata. The map layer contains station locations only; it is not an observation layer and does not imply current conditions.

## Spatial source classes

- **FEMA NFHL:** effective/insurance reference; never conflated with Indiana Best Available data.
- **Indiana Best Available Flood Hazard Layer:** planning/construction/Indiana Flood Control Act reference; not an insurance determination source.
- **Indiana Current Parcel Boundaries:** current statewide Data Harvest FeatureServer; spatial geometry queries are preferred over fabricated parcels.
- **Indiana Current Imagery:** authoritative photorealistic surface for the open-world twin; visualization evidence only.
- **USGS TNM/3DEP:** elevation/lidar discovery and coverage; derived EvidenceArtifacts carry SHA-256 provenance.
- **USACE NLD2:** read-only levee evidence; no automatic accreditation determination.

## Open-world twin terrain

The browser twin uses Indiana Current Imagery plus real 3DEP/best-available lidar converted to Terrain-RGB and served through a deployment-configured XYZ/PMTiles/Martin tile endpoint consumed by MapLibre `raster-dem`/`setTerrain()`.

`VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` is intentionally empty by default. The application reports terrain as not configured instead of substituting generated elevation. Bulk source imagery/lidar is not committed to Git.

## HEC-RAS 2D contract

Nominal project refinement targets:

- Channel/conveyance: 25–50 ft
- Near berm/structures/LAG: 25–40 ft
- Active floodplain: 50–100 ft
- Overbank/agricultural: 100–200 ft

Terrain should be hydro-enforced, preferably 3DEP 1 m or better. Required breaklines include channel centerline, left/right banks, and berm crest. Sub-grid hydraulic property tables may use higher-resolution terrain under larger computational cells.

Project constants:

- LAG 377.2 ft NAVD88
- BFE 375.0 ft NAVD88
- Berm crest 379.8 ft NAVD88
- FFE 382.5 ft NAVD88
- No-rise tolerance 0.0 ft
- Compensatory storage analysis range 1.2x–1.3x

These are project/model inputs, not universal regulatory thresholds.

## WSE and live telemetry

For USGS `03378500`, the published station-specific gage-zero conversion constant is 352.67 ft NAVD88 (USGS SIR 2016-5119); the monitoring-location altitude of 352.71 ft is retained separately and is not a conversion constant. Stage-to-WSE computation carries the gage datum, target vertical datum, conversion status, source URI, observed timestamp, retrieval timestamp, and provisional qualifier. The supplied 2026-09-12 04:30 CDT snapshot is evidence; operational display requires runtime refresh.

## Flood authority separation

- **FEMA NFHL:** effective/insurance plane.
- **Indiana BAFM:** planning/Flood Control Act plane.
- **HEC-RAS/TSM derived products:** simulation/model plane.

NFHL and BAFM remain separate sources, styles, legends, provenance records, and policy classifications. There is no merged flood-zone authority.

## Evidence and governance

Terrain acquisitions, HEC-RAS geometry, boundary-condition manifests, model outputs, and derived inundation products require SHA-256 EvidenceArtifacts with source, retrieval, CRS, vertical datum, derivation, validation, and transformation metadata. HEC-RAS outputs remain `SIMULATION_DEMO` / `MODEL_OUTPUT` with `human_review_required` governance.

## Freshness

A source that exceeds its configured freshness threshold is reported as stale/degraded rather than replaced with a fabricated reading. Provider outage is surfaced as `unavailable`. Observed and retrieval timestamps are never collapsed.

## Failure handling

Transport requests use timeouts, bounded response sizes, limited retries, exponential backoff, circuit protection, and resilient validation. A malformed or provenance-free provider response is rejected.

## Deployment boundary

GitHub Pages hosts the static browser application only. The Node API and Terrain-RGB tile service are separate runtime services. `VITE_TSM_API_BASE_URL` selects the browser API origin and `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` selects the operational terrain tile origin. Neither endpoint is fabricated by the frontend.

## Regulatory boundary

Live observations are decision-support evidence, not regulatory determinations. FEMA effective products, Indiana DNR Best Available/FARA processes, local ordinances, and engineering/survey documents retain their respective authority. TSM does not issue LOMA, CLOMR, LOMR, No-Rise, FARA, or floodplain permits.

## Operator recovery

1. Check `/api/data-sources/health`.
2. Identify the failed provider and last successful retrieval.
3. Verify provider status and schema before retrying ingestion.
4. Never insert a guessed reading to restore UI continuity.
5. Record any manual evidence with explicit source, acquisition time, validation status, and human review.
