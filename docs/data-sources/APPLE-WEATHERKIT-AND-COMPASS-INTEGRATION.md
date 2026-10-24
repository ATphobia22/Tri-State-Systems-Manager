# Apple WeatherKit, Weather Sources, and Compass Waypoints

**Status:** reference registry and integration contract; no external provider is declared operational by this document.

## Weather source registry

The machine-readable reference set is `integrations/weather-provider-reference.json`. It records the 19 providers listed by Apple's Weather support article and keeps Apple WeatherKit separate as an optional adapter candidate.

Apple's attribution list is not a public-API directory. For each provider and each product, TSM must independently verify:

- endpoint/API availability and authentication requirements;
- coverage and product semantics (forecast, observation, alert, radar, air quality);
- rate limits, latency, caching, outage behavior, and data freshness;
- licensing, redistribution, commercial-use terms, and required attribution;
- time zone, units, horizontal CRS, vertical datum, issuance/validity time, quality flags, and source payload hash.

### Product-level provenance

Attach source lineage to each weather product, not merely to the provider. At minimum preserve provider and product IDs, endpoint/dataset, retrieval time, issue and valid times, observation time where applicable, units, CRS/datum where applicable, license and attribution, payload hash, quality flags, and freshness state.

Do not merge distinct authority classes. Weather forecasts and model guidance are not observed river stage; weather alerts are not regulatory flood determinations. Existing direct NOAA/NWS integration remains independent of Apple attribution.

### WeatherKit

WeatherKit is an optional adapter candidate, not a mandatory dependency or a replacement for TSM's direct agency feeds. Before enabling it, verify current developer-account entitlements, terms, rate limits, region coverage, attribution requirements, and the exact response fields used. Keep credentials out of source control and do not claim the integration is live until endpoint-level tests have succeeded.

## Compass and waypoint concepts

The Apple iPhone Compass guide describes heading, coordinates, and elevation display; Apple warns that magnetic or environmental interference affects compass accuracy and says not to rely on the digital compass for precise location, proximity, distance, or direction.

The Apple Watch Compass guide describes saved waypoints, coordinate entry, labels/symbols, distance/direction, and relative elevation. Those are useful UX concepts for a future TSM field-notes workflow. The guides do not establish a public API for TSM to ingest Compass or Watch waypoints directly; the initial workflow should therefore use explicit manual coordinate entry or a supported file import, with source metadata retained.

### TSM implementation contract

- Store waypoint latitude/longitude with an explicit CRS and a recorded timestamp.
- Treat elevation as optional; if present, preserve its unit and vertical datum or explicitly mark the datum unknown.
- Heading must identify true north, magnetic north, or unknown; do not silently convert.
- Record device class, capture method, review status, and optional accuracy/provenance fields.
- Imported waypoints begin as `candidate` or `unverified`; they are context markers, not surveyed control points.
- Never use device compass readings alone to determine a property boundary, flood elevation, hydraulic design input, proximity, or regulatory conclusion.
- A 3D view may borrow the visual affordance of an axis compass (X/Y/Z plus orthographic/perspective view shortcuts), but must separately declare the map CRS, vertical datum, camera mode, and north reference. A screen-space axis widget is not a geospatial datum.

## Authoritative Apple references

- [Feature availability and data sources in the Weather app](https://support.apple.com/en-us/105038)
- [WeatherKit](https://developer.apple.com/weatherkit/)
- [WeatherKit API documentation](https://developer.apple.com/documentation/weatherkit)
- [WeatherKit data-source attribution](https://developer.apple.com/weatherkit/data-source-attribution/)
- [Use the 3D compass in Motion](https://support.apple.com/guide/motion/use-the-3d-compass-motn17c6a3f0/mac)
- [View and add waypoints in Compass on Apple Watch](https://support.apple.com/guide/watch/view-and-add-waypoints-apd4d10b939e/watchos)
- [Use the compass on iPhone](https://support.apple.com/guide/iphone/compass-iph1ac0b663/ios)
