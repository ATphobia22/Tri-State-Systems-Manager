# Live Data Fabric

TSM uses source-native, fail-closed live government data adapters.

## Verified active sources

- NOAA/NWS NWPS: gauge metadata, observed/forecast stage-flow products and official streamflow products.
- NOAA National Water Model: near-real-time model guidance; experimental APIs remain explicitly experimental.
- USGS 3DEP: authoritative elevation service with source metadata preserved.
- USACE National Levee Database: Feature Service, Map Service, OGC WMS/WFS and JSON API.

The NOAA NWM standard analysis/assimilation configuration cycles hourly and assimilates USGS stream-gauge observations. TSM therefore preserves source/model cadence instead of inventing a universal high-frequency hydraulic clock.

USACE states that NLD data are continuously updated by multiple responsible entities and that data quality can vary. TSM retains source update metadata and does not turn inventory records into engineering certification.

## Runtime contract

Every live record preserves source ID, authority class, exact endpoint, retrieval timestamp, source timestamp when available, native payload, and applicable CRS/units/datum metadata.
Observation, forecast, model guidance and infrastructure inventory remain separate authority classes.

## Fail-closed controls

- source failure -> unavailable/stale state; never fabricate values
- malformed payload -> reject
- missing vertical datum -> UNVERIFIED
- experimental source -> explicit experimental status
- regulatory comparison -> verified jurisdictional rule plus human review