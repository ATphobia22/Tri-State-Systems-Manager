# TSM Martin, Ditto and native execution decision

2026-11-22 | Indiana, Illinois and Kentucky Ohio-Wabash 4D digital twin

## Architecture

Maintain the current PostGIS append-only canonical event store, its
bitemporal revisions, Redpanda/Kafka ingest and outbox, CQRS projection
checkpoints, read-only twin APIs, and pgSTAC evidence catalog. Eclipse Ditto
is optional device-shadow interoperability for owner-authorized SCADA or
other MQTT/Kafka devices: no Ditto update may silently overwrite a canonical
observed O event, model H revision, or independently reviewed evidence.

Use existing Martin for networked PostGIS MVT delivery and licensed local
PMTiles/MBTiles/COG raster archives. Use MapLibre for the public 2D/2.5D
thematic viewer, CesiumJS/3D Tiles for regional 3D, and Three.js / React
Three Fiber for evidence-linked high-detail facility subscenes. No engine
creates authoritative elevation merely by rendering it.

Keep the required Windows 11 Shipping desktop independent: native UE5.8,
local spatial/observation assets, no WebView2, Node, localhost HTTP server
or network requirement. Tauri is a possible *separate* WebView2 workbench,
not the offline runtime specified for this project. Martin is therefore
used on the connected backend and as an optional headless bulk tiling tool,
not as a mandatory local daemon in the installer.

## Twelve proposed civic source classes

This classification is an implementation planning registry and is not proof
of acquisition, licensing, authority or complete coverage.

1. Terrain: USGS 3DEP, state elevation agencies. Datum, geoid, units and
   LiDAR/DEM vintage explicitly verified.
2. Orthophotography: official state aerial programs, USDA/USGS. Preserve
   capture date and imagery licensing.
3. Hydrography: USGS 3DHP/NHD or USACE. Geometry is not a model WSE.
4. Gauges: USGS station 00065 stage. Preserve station datum, age, quality.
5. Effective floodplain: FEMA NFHL, FIRM/LOMC and effective dates.
6. Planning floodplain: Indiana DNR BAFL and distinct state counterparts.
7. Parcels: state/county native IDs, stripped owner/address public MVT.
8. Road centerlines: state DOT/county engineering data with version.
9. Bridges: DOT/USACE inventory with authorized inspection evidence.
10. Levees/pump stations: USACE NLD and local utility authority, restricted
    operation/security data.
11. Buildings: source IGIO/IL/KY footprints; heights require independent
    roof/ground lidar proof, not assumed LoD2/3/4.
12. Ports/utility infrastructure: USACE and explicitly approved owners;
    do not publish SCADA/grid telemetry or sensitive nodes anonymously.

Each approved layer requires authority, service/layer/feature ID,
publication/effective date, acquisition time, native CRS, vertical
datum/geoid, units, source SHA-256, transformation receipt, coverage,
licensing, export permissions, version and validation status.
Do not claim all 12 are working because these classes are listed.

## Geodetic / simulation contract

EPSG:2966 applies to the verified Indiana source only; do not impose it on
Illinois/Kentucky native geometry without numerical reprojection checks.
MapLibre Web Mercator is the presentation plane, not engineering geometry.
Cesium ECEF and local Unreal ENU/local centimeters need a reviewed, pinned
transform and correct NAVD88/GEOID18 handling. Never convert river gage
stage to NAVD88 by assumption.

Hydrology uses source-linked model revs and observations on separate
timelines. Compare station, measurement parameter, UTC interval, units,
NAVD88 evidence, calibration-use classification and uncertainty before
producing a residual. HEC-RAS and OpenDSS model outputs are source evidence,
not automatically independently approved physical behavior.

## Online / offline boundaries

ONLINE: official snapshot -> checksum/QA -> PostGIS history and evidence
-> Redpanda -> CQRS read API + pgSTAC -> approved Martin tile service
-> anonymous MapLibre/Cesium viewer with unavailable/stale states.

OFFLINE BUILD: headless licensed geospatial download -> CRS/datum audit
-> artifact checksums -> local terrain/3D/vector/observation package
-> direct UE5.8 native file I/O -> clean Win11 offline start test.
No WebView/local HTTP server. No fake live telemetry when offline.

The public Martin parcel MVT permits parcel ID, APN, acreage, evidence
SHA-256, and reviewed ground elevation only. It rejects impossible XYZ
indices, while the browser client checks the same XYZ bounds and canonical
base paths. Private E-911/site address and owner fields are not bundled
into anonymously fetched parcels.

## Independent gates

- PostGIS, Redpanda and API integration green on exact source commit.
- Actual Martin config validated against the pinned deployed binary;
  source catalog, returned tiles, glyphs and sprite files verified.
- USGS snapshot and offline file receipt independently verified.
- Countywide 23,082 IGIO source IDs reconciled to real height-linked 3D
  meshes; fallback footprints are not full 3D coverage.
- Deployed public Atlas/Cesium screenshot, navigation and network telemetry
  verified; unit and CI tests are not enough.
- A real UE5.8 Shipping executable installed and launched on clean Win11
  with networking disabled; native data loaded, log/hash/FPS evidence.
- Human authority final, FEMA regulatory determinations never inferred.

## Primary sources

- https://maplibre.org/martin/
- https://maplibre.org/martin/config-file/
- https://maplibre.org/maplibre-style-spec/sources/
- https://eclipse.dev/ditto/connectivity-overview.html
- https://tauri.app/start/prerequisites/
- https://api.waterdata.usgs.gov/
- https://www.hec.usace.army.mil/software/hec-ras/
- https://postgis.net/docs/ST_AsMVT.html

Status: configuration, code and docs; not claimed to be full production
12-layer acquisition, public rendering or offline Windows certification.
