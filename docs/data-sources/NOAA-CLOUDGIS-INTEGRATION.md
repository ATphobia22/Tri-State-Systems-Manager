# NOAA / NWS CloudGIS integration contract

**Status:** Official GetCapabilities responses and expected layer names were checked on 2026-10-15; successful GetMap image rendering in the deployed target runtime remains unverified.

## Official service directories

- [NWS CloudGIS web services](https://www.weather.gov/gis/cloudgiswebservices) documents public-cloud OGC WMS, WFS, and WCS products.
- [NCEP Open Source Geospatial Services Directory](https://opengeo.ncep.noaa.gov/geoserver/www/index.html) publishes WFS/WMS GetCapabilities links. It lists warning/hazard layers and MRMS radar products including CONUS CREF QCD.
- [NWS radar FAQ](https://www.weather.gov/radarfaq) describes product definitions, supported downloads, and failure cases; [Service Change Notices](https://www.weather.gov/notification) should be checked before release because service availability and layer inventories can change.

## Canvas implementation

The Twin Canvas adds opt-in WMS overlays for NWS warnings and MRMS CONUS composite reflectivity. Both start **OFF**, are independently toggled, and are visually attributed to NOAA/NWS. They are operational context only. They do not create flood extents, replace FEMA NFHL/Indiana BAFM, or count as HEC-RAS model evidence. The NWS FAQ identifies CREF.QCD as maximum reflectivity in the radar volume (dBZ), not rainfall accumulation. A blank image can indicate an offline radar; it must never be interpreted as clear weather or absence of risk.

The 2026-10-15 GetCapabilities checks identified the published layer names `warnings`, `hazards`, and `conus_cref_qcd`. These checks establish catalog/capabilities evidence only; they do not establish that GetMap image bytes are valid, the service is healthy from the deployed browser, or the overlay covers a selected AOI. The target-runtime GetMap check remains a release gate. If a layer is renamed or unavailable, the overlay must fail visibly and remain non-authoritative; do not silently substitute another layer.

## Rainfall-aware context, not fake inundation

NOAA documents an MRMS QPE ImageServer at [obs/mrms_qpe](https://mapservices.weather.noaa.gov/raster/rest/services/obs/mrms_qpe/ImageServer) and a [service tutorial](https://www.weather.gov/gis/mrms_data_quick_tutorial). The service description identifies radar-only precipitation mosaics in inches at about 1 km resolution for 1-, 3-, 6-, 12-, 24-, 48-, and 72-hour windows, and says the service is not time-enabled. TSM records this as a **documented candidate, not a live canvas overlay**. Before integration, verify current raster functions, the exact raster selected, timestamps/accumulation windows, nodata handling, coverage, quality metadata, and licensing/retention terms. Keep these distinct from reflectivity and from model boundary conditions. Any forcing used by HEC-RAS must be explicitly transformed and documented, with a separate model run and validation record.

## Release gates

1. Re-query GetCapabilities for each enabled WMS service and assert the requested layer is present.
2. Validate WMS GetMap returns an image/png payload for a test bounding box in the approved Tri-State AOI.
3. Record retrieval time, endpoint, layer name, protocol version, CRS, response status, and service metadata hash in the source manifest.
4. Test timeout, HTTP errors, invalid image responses, and service-layer rename behavior.
5. Preserve explicit UI labels and source attribution; overlays are not survey, hydraulic, or regulatory evidence.
6. Keep warning and radar overlays off by default and ensure FEMA NFHL and Indiana BAFM remain separately controlled.

## Provenance and scientific limits

Radar reflectivity is not itself rainfall depth or a flood prediction. Warning polygons are not inundation polygons. WMS is a rendered image interface; where feature-level analysis or durable evidence is required, acquire the appropriate WFS/WCS or authoritative source-native data and preserve source metadata, CRS, timestamp, license/terms, and SHA-256. No live NOAA payload is checked into the repository by this change.
