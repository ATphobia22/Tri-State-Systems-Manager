# Release Hardening — 2026-10-02

## Verified corrections

- USGS 03378500 gage-zero conversion is **352.67 ft NAVD88** from USGS SIR 2016-5119.
- The monitoring-location altitude **352.71 ft NAVD88** remains separate station metadata.
- Digital Twin V2 labels XSoft parcel vectors separately from WTH GIS property-record provenance.
- The WSE endpoint is explicitly an **OpenMI-compatible adapter envelope**, not a claim of OpenMI 2.0 component/runtime compliance.
- WSE refresh is user-initiated; the console no longer polls the station every five seconds.
- GitHub Pages falls back to an immutable build-time Posey parcel GeoJSON snapshot when no API base URL is configured.
- Terrain-RGB inventory documentation matches the committed 478-tile, z8–z12 product.
- Terrain-RGB encoding no longer requires the Python GDAL bindings; Pillow + NumPy provide the raster decode/PNG encode path.
- The 3D Tiles renderer synchronizes its ECEF camera with the MapLibre center, zoom, bearing, pitch, and resize events.
- `backend/app/openapi.json` is generated from the live FastAPI route tree and is checked for exact path/schema synchronization.
- Python bytecode is ignored by Git and the current repository tree contains no committed `.pyc` files.
- The retired `artifacts/tsm-indiana-data-catalog-v1.1.json` pointer remains intentionally retired; the canonical catalog is `data/schemas/tsm-indiana-data-catalog-v1.json`.
- Global government source-boundary placeholders remain fail-closed by design; site-specific parcel, FIRM, community, and vertical-control values must come from evidence rather than global constants.

## Engineering boundary

The terrain and parcel visualization products remain screening/provisional visualization artifacts until authoritative acquisition, datum control, validation, SHA-256 inventory, and human engineering review promote them. No UI state is treated as agency approval or survey certification.
