# USGS offline gauge reader projection and evidence gate (2026-11-22)

## Research findings and the corresponding implementation

The public USGS OGC Water Data API exposes continuous observations with
monitoring-location, time-series, observation-time, parameter, unit and
approval-status metadata. USGS parameter 00065 is **gage height**, not an
absolute NAVD88 water-surface elevation. An observation that is recent in
time is not automatically quality-approved, hydraulically calibrated, or
eligible to stand in for a water-surface-elevation measurement.

**Implemented in this change:** a small stdlib-only read projection,
services/living-twin/twin/offline_view.py. It consumes only the already
validated, source-receipted local observation bundle. The existing
offline_bundle.verify_bundle performs source replay and SHA-256 verification
before the new reader projects values. No HTTP, localhost, WebView,
Redpanda, PostGIS, Redis or live cloud service is required to *read* it.

The reader:
- exposes all three pilot stations with source states CAPTURED,
  SOURCE_UNAVAILABLE, NO_OBSERVATIONS or NOT_IN_CAPTURE;
- retains each independent USGS time series, its most recent observation
  timestamp, quality, event identity, evidence hash and WGS84 geometry;
- reports RECENT_OBSERVATION, STALE or MISSING_MEASUREMENT per series using
  a documented local recency threshold, default 3600 seconds;
- does not backfill a later no-data/null observation with an older good
  number and does not invent measurements for inaccessible stations;
- rejects incorrect station, parameter, units, source digest or datum, and
  does not allow a timestamp after the verified capture time;
- explicitly declares navd88WseIncluded=false, engineeringUse=NOT_VALIDATED,
  hydraulicSimulationIncluded=false and publicPublication=REVIEW_REQUIRED.

The recency threshold is **a TSM display policy**, not a USGS approval or
hydraulic-certification interval. A RECENT_OBSERVATION does not mean the
physical sensor is currently transmitting or the value has been independently
reviewed. Future real-time source verification is a separate step.

## Reproducible use

From services/living-twin with its locked Python dependencies installed:

    python -m twin.import_usgs /path/to/river-snapshot --preview
    python -m twin.offline_bundle build /path/to/river-snapshot /path/to/new-bundle
    python -m twin.offline_bundle verify /path/to/new-bundle
    python -m twin.offline_view /path/to/new-bundle --stale-after-seconds 3600 > gauge-view.json
    python -m twin.offline_view /path/to/new-bundle --as-of 2025-01-01T13:01:00Z

The CLI writes JSON to stdout so external headless tooling can atomically stage
and publish it alongside other **reviewed** local assets; redirecting stdout
alone is not atomic and should not replace the approved signed artifact.
The sample clock above is a test/replay example, **not live USGS data**.

Tests: pytest -q tests/test_offline_view.py tests/test_offline_bundle.py
Integration: docker compose --profile test run --rm tests
All tests must execute on the exact pull-request head in CI before merge.

## Direct-file Windows integration boundary

A Windows 11 UE5.8 Shipping executable may consume the JSON document as
ordinary local data (not Python, HTTP or a tile service). The native C++
adapter still needs to be written, with:
1. schema-version checks; rejection of unknown or missing authority fields;
2. bounded JSON reading; SHA-256 validation of the surrounding approved
   local manifest; no runtime network access or localhost server;
3. visible missing/stale labels for each gauge and a separate local
   capture-time indicator rather than a fabricated stage;
4. no NAVD88 elevation, flood depth or model residual until an independently
   reviewed station-specific gage-zero transformation is available;
5. an air-gapped clean-host Shipping build/launch test with measured resource
   use and no WebView/Node/localhost dependencies.

The local projection is **not** proof that this native reader exists, nor a
license to ship unverified source data.

## Wider research applied to the digital twin plan

- **Spatial catalog:** OGC STAC is a metadata/discovery standard. Index source
  SHA-256, observation/capture timestamps, geographic extent, declared CRS and
  source authority, but retain original bytes and their complete manifest as
  independent source evidence. Do not treat a pgSTAC item alone as verification.
- **CRS discipline:** PostGIS ST_Transform depends on PROJ transformations and
  input SRIDs. Horizontal geometry must not silently be treated as a NAVD88
  vertical transformation; document the grid, transformation pipeline and
  numerical control-point checks. Keep Indiana, Illinois and Kentucky source
  EPSG/unit fields native until their exact sources are verified.
- **3D buildings:** OGC 3D Tiles separates tileset metadata, spatial hierarchy,
  renderable geometry and feature metadata. Countywide feature counts,
  geometry validity, LOD attribution and real height evidence are separate
  acceptance tests; renderer success does not reconcile an incomplete inventory.
- **Hydraulic comparison:** a time- and station-matched HEC-RAS prediction
  cannot be compared numerically to gage height as NAVD88 WSE without verified
  station-specific datum evidence. Keep O observation, H model and V validation
  evidence separately keyed and versioned.

## Independent authorities checked

- USGS OGC API overview: https://api.waterdata.usgs.gov/docs/ogcapi/
- USGS API migration: https://api.waterdata.usgs.gov/docs/ogcapi/migration/
- USGS parameter 00065: https://nwis.waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/
- OGC STAC standards: https://www.ogc.org/standards/stac/
- PostGIS ST_Transform: https://postgis.net/docs/ST_Transform.html
- OGC 3D Tiles: https://www.ogc.org/standards/3DTiles/
- HEC-RAS documentation: https://www.hec.usace.army.mil/confluence/rasdocs/

## Remaining release gates

The latest checked main, 4c8b66e8dcc42821d34fff3e050d824018cebcd4,
contains an offline observation bundle, but the total application is not
certified. Outstanding independent gates: exact PR-head full CI, connected
PostGIS/Redpanda integration, live-source capture and current observation
verification, effective FEMA/BAFL joins, building identity/3D Tiles inventory
reconciliation, headed public Cesium/MapLibre visual tests, and clean
Windows 11 UE5.8 Shipping launch with network disabled. Never mark any of
these green solely because the read projection's unit tests pass.
