# Open Mapping and Visual Evidence Governance — TSM Atlas
Date: 2026-11-22

## Decision

Use the already-integrated MapLibre GL JS and dedicated CesiumJS renderer for
free public river-valley mapping; retain Unreal Engine 5.8 as the independent
native offline Windows rendering target. Do not silently switch to Google
Maps Platform or require an API key to view a public engineering map. Existing
Plus Codes source (google/open-location-code JavaScript, Apache-2.0) is already
vendored and tested. Reuse it; there is no reason to duplicate it or replace
authoritative feature IDs with approximate addressing cells.

## Implemented visual controls

- Atlas now exposes a full, 10+ digit Plus Code navigator. It decodes *locally*
  with no address API, API key, authentication, or browser geolocation. It
  rejects short ambiguous codes, insufficient code-cell precision and points
  beyond the fixed IN–IL–KY Atlas envelope. The result flies the existing
  MapLibre camera to the code cell **center**, not to a surveyed feature.
- Regional source toggles distinguish disabled/not-renderable sources from
  registered ones. Registered does not imply tile fetch succeeded.
- Explicit authority legend separates observation, effective NFHL regulatory
  mapping, DNR planning products, and derived visualization.
- Dedicated Cesium 3D viewer remains a separate, explicitly labeled
  experience. A MapLibre LoD1 preview is not mislabeled as a live Cesium
  overlay or complete countywide 3D mesh coverage.
- If the remote OpenFreeMap style never loads, the MapLibre startup watchdog
  switches to a local, source-free neutral background and continues trying
  to initialize public GIS overlay sources. It reports that the street
  basemap and terrain are **unavailable**, rather than displaying an
  indefinite spinner or fabricating map tile data.

## Evidence and visual style rules

| Plane | Source | Visual treatment | Engineering acceptance |
| --- | --- | --- | --- |
| Contextual roads | OpenFreeMap/OpenMapTiles/OSM or official state roads | Muted streets, legible linework, source attribution | No surveyed alignment implied |
| Parcel | Indiana GIS parcel boundaries; other state datasets separately | Thin cyan or gold outlines; identifier on inspection | Version/date and cadastral authority required |
| Terrain | USGS 3DEP / IGIO lidar-derived terrain | DEM hillshade, unobstructed controls | Horizontal CRS, GEOID18 vertical reference, tile checksums, elevation bounds |
| Buildings | IGIO footprints and separately measured/derived height links | Footprint if height missing; LoD1 only when source-linked | Source OBJECTID & independently reviewed roof/ground; do not silently invent 2,567 gaps |
| Effective floodplain | FEMA NFHL effective study | High-contrast outline and visible regulatory label | Effective date/panel IDs/LOMC provenance |
| Planning floodplain | Indiana DNR BAFL/BAFM | Different pattern and planning label | Never merge into FEMA regulatory authority |
| Gauge | USGS source station ID and observation timestamp | Station marker, unavailable/stale/source badge | Actual 00065 units, station datum and NAVD88 transform evidence |
| Cinematic | Sky, mist, lighting, flyover | Presentation-only controls | Never read movie shader values as measured hydrology |

MapLibre's Web Mercator render plane is not a survey CRS; projected source
coordinates must be transformed in headless preprocessing and accompanied by
a documented CRS/datum/vertical-unit audit before use in engineering.
The Plus Code center is a navigation hint only, never a regulatory parcel
ID, BFE control or geodetic benchmark.

For source-backed reproducibility, persist release SHA, source version,
source authority, date, CRSs, vertical datum, units, geometry or tile hashes,
usage rights and transform receipts. Renderers must visibly retain states
for missing asset, failed fetch, stale observation, non-authoritative scenario
and inferred height. Do not make up a live result.

## Open-source source/licensing decisions

1. googlemaps official SDKs / Extended Component Library are Apache-2.0
   wrappers around Google Maps services and do not grant a free Google tile
   or geocoding/data license. They are optional examples only.
2. google/open-location-code is Apache-2.0 and runs offline. Existing vendored
   implementation is reused as a location-cell navigator.
3. MapLibre GL JS remains the 2D/2.5D frontend, CesiumJS the Earth/3D Tiles
   frontend, and UE5.8 the offline native world. Avoid a parallel Leaflet or
   OpenLayers renderer without a demonstrated capability gap.
4. OpenStreetMap data is open (ODbL), but tile.openstreetmap.org explicitly
   prohibits bulk prefetching. Never harvest OSMF public tiles for installers.
5. OpenFreeMap public styles are keyless but are a network service, so still
   require error states and adherence to provider terms; if creating offline
   archives, use licensed self-hosted extracts or compliant package sources.
6. Overture Maps building/transportation references can be acquired in
   headless spatially bounded batches, but source schema/version, attribution,
   ODbL share-alike where applicable, and topology/identity quality must be
   reviewed prior to use. Overture cannot overwrite authoritative IGIO IDs.
7. OSRM/Nominatim/GraphHopper are optional routing/geocoding engines, not
   substitutes for verified transportation or cadastral engineering data.
   A self-hosted backend is inappropriate for a Windows installer required
   to run with no localhost/network service. If routing is adopted offline,
   build a locally validated road graph and a direct native library/SQLite
   route query, with deterministic route receipts.

## Acceptance / outstanding gates

- Run TypeScript parse, type check, Vitest, and headed Chrome UI tests against
  the exact branch. Unit tests confirm behavior, not source or geodetic quality.
- Headed public deployment must show **real visible map tiles** and working
  overlays on the exact deployed commit. The neutral fallback by itself is
  NOT a passing public map-render test; log failures and expose a retry.
- Verify source tile responses, CORS, cross-state bounds, returned attribution,
  layer visibility controls, screen-reader labels and reduced-motion settings.
- Cesium 3D Tiles, PBR/textures, real roof heights and native UE5.8 Shipping
  executable startup are separate acceptance tracks. Do not mark complete from
  successful source compilation.

## References (primary)

- https://developers.google.com/maps/documentation/javascript/libraries-open-source
- https://github.com/googlemaps/extended-component-library
- https://github.com/google/open-location-code
- https://maplibre.org/maplibre-style-spec/
- https://openfreemap.org/quick_start/
- https://openfreemap.org/tos/
- https://operations.osmfoundation.org/policies/tiles/
- https://docs.overturemaps.org/attribution/
- https://docs.overturemaps.org/getting-data/
