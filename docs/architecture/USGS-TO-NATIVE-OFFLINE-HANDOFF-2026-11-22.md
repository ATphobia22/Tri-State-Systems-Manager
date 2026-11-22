# Verified Ohio-Wabash observation to offline handoff (2026-11-22)

Implementation: services/living-twin. This closes a specific headless
data-path gate; it is not a claim that the entire digital twin is complete.

## Pipeline and deployment separation

USGS modern OGC continuous API -> headless river_twin_snapshot.py capture
-> UTC window, source URL, station status, raw GeoJSON and SHA-256
-> twin.import_usgs full-capture preflight
-> option A: Confluent-wire Kafka/Redpanda -> PostGIS event + audit/outbox
   -> CQRS projection/rebuild -> temporal read APIs -> Atlas/Cesium (online).
-> option B: twin.offline_bundle build -> bundle.json + events.ndjson
   + source/manifest.json + source/station GeoJSON (local, no network).

Option A uses the existing connected architecture. Option B is the
deterministic data handoff for a *future* UE5.8 direct file reader; neither
the native executable nor licensed offline terrain package is certified
by the existence of this export.

## Invariants

CAPTURED rows must all match the station, parameter 00065, units ft,
bounded request UTC window, series identity, a complete one-page source,
valid WGS84 point or null, and source bytes validated against SHA-256.
An invalid row rejects the *whole* snapshot before any publish. Duplicated
series/time is an error. Explicit NO_OBSERVATIONS and SOURCE_UNAVAILABLE
produce zero values, not fabricated stages. Numeric USGS no-data sentinels
are stored as null. USGS approval status is never equated with reviewed
vertical datum. Gage-height observations are not NAVD88 WSE.

The local bundle preserves original source files and deterministic matrix-O
events. It is marked REVIEW_REQUIRED for public publication; its hashes
are not independent digital signatures. It contains no simulated results
or HEC-RAS model certification. Independent validation must reconcile the
actual station datum, spatial identity, timestamp, model revision and
uncertainty before any model-versus-observed residual is reported.

## Commands (from services/living-twin)

    python -m twin.import_usgs /path/to/river-snapshot --preview
    python -m twin.import_usgs /path/to/river-snapshot
    python -m twin.offline_bundle build /path/to/river-snapshot /path/to/new-local-bundle
    python -m twin.offline_bundle verify /path/to/new-local-bundle

## Independent release acceptance

1. Python capture, input contracts, offline hash and replay tests pass.
2. PostGIS+Kafka+read API Compose integration passes on the exact branch SHA.
3. Real USGS response/observation timestamp and source availability verified.
4. HEC-RAS model evidence and same-datum comparison approved independently.
5. Headed public map tiles, terrain and regulatory overlays actually render.
6. Clean Windows 11 UE5.8 Shipping executable consumes local approved data
   with network disabled, no localhost, Node, WebView or background server.
7. Failures are visible, not silently replaced by synthetic observations.

References:
https://api.waterdata.usgs.gov/docs/ogcapi/
https://api.waterdata.usgs.gov/docs/ogcapi/migration/
https://github.com/stac-utils/pgstac
https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/6.6/viewing-2d-or-1d-2d-output-using-hec-ras-mapper/2d-output-file-hdf5-binary-file
