# Hydrology source truth and conversion contracts

**Status:** implementation requirements and authoritative source references. This document does not assert that feeds are connected or healthy.

## Source-of-truth policy

Every source must have exactly one runtime state: `active`, `retired`, `unavailable`, or `discovery-only`. Runtime state is separate from a capability being configured, a source being listed in a catalog, and a product being published.

For every fetch, preserve: provider and endpoint, source identifier, acquisition time (UTC), provider observation/issue time, units, parameter code, quality/approval flags when supplied, geographic coverage, CRS, vertical datum (or explicit not-applicable policy), HTTP/cache status, and provenance URL. Never replace missing, stale, or failed readings with fabricated values. A cached value must remain visibly cached and retain its original timestamp.

## Authoritative source references

| Purpose | Primary reference | Integration contract |
|---|---|---|
| River observations and streamflow time series | [USGS Water Data APIs](https://api.waterdata.usgs.gov/docs/) and [continuous values](https://api.waterdata.usgs.gov/) | Discover monitoring locations and parameter metadata; preserve site/parameter IDs, timestamp, units, and qualifiers. Treat instantaneous and daily summaries as different products. |
| Official river forecasts, observed/forecast stage and flow | [NOAA National Water Prediction Service API](https://api.water.noaa.gov/nwps/v1/docs/) | Treat forecast products as forecasts, observations as observations; retain gauge/reach ID, issue/valid times, forecast horizon, and product identity. |
| Experimental hydrologic ensemble forecasts | [NWPS HEFS API information](https://api.water.noaa.gov/about/api) | Mark experimental; do not treat as a supported 24/7 service or as interchangeable with official forecasts. |
| Bare-earth elevation and terrain | [USGS 3DEP](https://www.usgs.gov/3d-elevation-program-standards-and-specifications) | Read each product's actual CRS and vertical datum from metadata. Do not infer a datum from the source brand alone. |
| Levee infrastructure | [USACE National Levee Database services](https://levees.sec.usace.army.mil/data-services/services/) | Preserve feature-service identity, source timestamp, attributes, and service layer IDs. Presence of a levee feature is not a certification of protection or performance. |
| Effective regulatory flood hazard | [FEMA Map Service Center](https://msc.fema.gov/portal/home) | Preserve effective date, panel/product ID, and authoritative FEMA provenance. Do not blend with state best-available mapping into a single authority class. |

## Coordinate, datum, and unit rules

1. Store coordinates with explicit CRS identifiers; never silently reinterpret longitude/latitude as projected coordinates.
2. Store elevations with an explicit vertical datum and units. USGS 3DEP products commonly use NAVD88 in the conterminous US, but other datums occur; inspect each product's metadata.
3. Convert feet/metres only when the input unit is known. Use exact factors (international foot = 0.3048 m; metre = 3.280839895013123 ft) and retain original value/unit plus converted value/unit.
4. Do not apply a constant offset to transform vertical datums. Use an authoritative geodetic transformation workflow and record model/version, grids, epoch where applicable, and uncertainty.
5. Treat discharge (e.g. ft³/s versus m³/s), stage, elevation, depth, precipitation accumulation, and precipitation rate as distinct quantities. Never convert between them without an explicit dimensional operation.
6. Keep no-data distinct from zero; reject non-finite values; preserve provider quality flags and timestamps.
7. If the required datum, units, transformation grid, or AOI coverage is unknown, mark the derived product `blocked` or `unverified` rather than publish a misleading result.

## Activation and health checks

A source may be marked `active` only after all of these are true:
- Endpoint and documented access method are known.
- A bounded integration test succeeds against the real endpoint or a recorded deterministic fixture.
- Schema, units, timestamps, quality fields, and error handling are validated.
- Geographic coverage includes the requested AOI.
- Rate limits, timeouts, retries, cache age, and stale-data behavior are explicit.
- Data lineage and provider attribution survive into API responses, maps, tiles, and exported reports.

Health should be represented separately as `healthy`, `degraded`, `stale`, `unavailable`, or `not-checked`. Do not call a source healthy solely because its URL appears in a registry.

## Hydrology feature gates

- **Gauge watch:** display observed stage/discharge with observation time, units, gauge identity, and configurable stage thresholds only when the relevant thresholds are sourced and applicable.
- **Forecast view:** show forecast issuance time, valid time, horizon, and provider; never merge forecast and observation series without type labels.
- **Terrain/drainage analysis:** require AOI coverage, DEM resolution, vertical datum, hydrologic conditioning method, and known limitations. A DEM-derived flow path is an analytical estimate, not surveyed drainage infrastructure.
- **Flood extent/scenario:** label model outputs with model, boundary conditions, calibration/validation status, scenario, run time, resolution, and uncertainty. Do not infer a flood depth from a regulatory polygon alone.
- **Tile publication:** validate manifest schema, asset checksums, source lineage, geometry/CRS, datum policy, no-data behavior, and build receipt before marking an asset published.
- **Public status page:** display last successful check and last data timestamp per source, with clear unavailable/stale states. Avoid a single green badge that hides failures in individual dependencies.

## Release acceptance

1. Source catalog, runtime registry, tile manifest, UI, docs, and tests agree on source state.
2. Tests cover active, retired, unavailable, stale, malformed, unit-unknown, datum-unknown, and out-of-AOI cases.
3. A failed external source check fails the affected capability closed without inventing data; transient network failure is distinguishable from invalid data.
4. CI and deployment checks are tied to the exact commit being reported.
5. All unsupported, experimental, retired, and discovery-only capabilities remain explicitly labelled; no user-facing claim exceeds the evidence.
