# NOAA / NWS CloudGIS integration contract

**Status:** Directory references reviewed on 2026-10-15. The catalog is documented, but live layer health and qualified WMS layer names have not been validated in the target runtime.

## Official service directories

- [NWS CloudGIS web services](https://www.weather.gov/gis/cloudgiswebservices) documents public-cloud OGC WMS, WFS, and WCS products.
- [NCEP Open Source Geospatial Services Directory](https://opengeo.ncep.noaa.gov/geoserver/www/index.html) publishes WFS/WMS GetCapabilities links. It lists warning/hazard layers and MRMS radar products including CONUS CREF QCD.
- [NWS service change notices](https://www.weather.gov/gis/cloudgiswebservices) should be checked before release because service availability and layer inventories can change.

## Canvas implementation

The Twin Canvas adds opt-in WMS overlays for NWS warnings and MRMS CONUS composite reflectivity. Both start **OFF**, are independently toggled, and are visually attributed to NOAA/NWS. They are operational context only. They do not create flood extents, replace FEMA NFHL/Indiana BAFM, or count as HEC-RAS model evidence.

The source URLs use the official GeoServer service paths identified by the directory. The qualified layer names are provisional until a live GetCapabilities response is parsed and checked in the release environment. If a layer is renamed or unavailable, the overlay must fail visibly and remain non-authoritative; do not silently substitute another layer.

## Release gates

1. Re-query GetCapabilities for each enabled WMS service and assert the requested qualified layer is present.
2. Validate WMS GetMap returns an image/png payload for a test bounding box in the Tri-State region.
3. Record retrieval time, endpoint, layer name, protocol version, CRS, response status, and service metadata hash in the source manifest.
4. Test timeout, HTTP errors, invalid image responses, and service-layer rename behavior.
5. Preserve explicit UI labels and source attribution; overlays are not survey, hydraulic, or regulatory evidence.
6. Keep warning and radar overlays off by default and ensure FEMA NFHL and Indiana BAFM remain separately controlled.

## Provenance and scientific limits

Radar reflectivity is not itself rainfall depth or a flood prediction. Warning polygons are not inundation polygons. WMS is a rendered image interface; where feature-level analysis or durable evidence is required, acquire the appropriate WFS/WCS or authoritative source-native data and preserve source metadata, CRS, timestamp, license/terms, and SHA-256. No live NOAA payload is checked into the repository by this change.
