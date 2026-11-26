# External Data Acquisition — What Code Can and Cannot Do

| Item | Can TSM download? | Path |
|------|-------------------|------|
| TR-22-4 / ERDC report | Public release confirmed; report bytes not acquired | https://doi.org/10.21079/11681/43441 |
| TR-22-4 runnable model archive | Unverified; public search or human FOIA | https://www.usace.army.mil/Resources/FOIA/ |
| CEII | **No — refuse** | FERC CEII + NDA only |
| PE/PLS | No | Licensed human seal |
| Union KY PVA | Partial public/commercial | ArcGIS / PVA office |
| Live 811 | No open bulk API | Member API key or manual ticket |
| INDOT | Public GIS REST | e.g. INDOT_NLRI MapServer |
| LoD1/2 LiDAR | Yes (3DEP; vertical evidence required) | LidarExplorer + AWS EPT + PDAL |

## CEII
Never download/store via TSM. `cim_ceii` empty in public.

## 3DEP LoD path
1. https://www.usgs.gov/tools/lidarexplorer
2. EPT: s3 usgs-lidar-public
3. `python scripts/geospatial/public_external_preflight.py --out public-review` checks exact public metadata; only an eligible project yields a PDAL plan (EPSG:26916 + EPSG:5703). The old JSON is deliberately non-executable until validated.
4. DSM−DEM heights → LoD1/2; LoD3 needs MLS/IFC

## 811
indiana811.org ticket request; memberservices@indiana811.org for JSON API key.

## Verified public sources (2026-11-26)

USACE's March 2, 2022 publication notice confirms unlimited public distribution for ERDC/CHL TR-22-4; the report DOI is 10.21079/11681/43441. The original runnable model archive is a separate unverified source; no FOIA is represented as filed. INDOT public inventory endpoint is https://gis.indot.in.gov/ro/rest/services/DOT/INDOT_NLRI_DATA/MapServer (metadata only; not live incidents). Union KY's official PVA page is https://www.unioncountyky.org/local-government/union-county-pva ; ArcGIS item and reuse rights remain unverified. NOAA InPort 69202 describes original Phase 2 West State Plane feet and NAVD88/GEOID12B, not proof of EPT Z encoding. Never use UTM bounds in an EPSG:3857 EPT reader. The USGS one-metre DEM collection states NAVD88 metre Z, but verify actual tile metadata and coverage. The preflight does not download point-cloud payloads, generate terrain, or publish. CEII, restricted ticket data, unlicensed parcel data and professional sealing remain outside the worker.
