# Tri-State Systems Manager — Authoritative Data Source Catalog

**Status:** Production source registry
**Updated:** 2026-09-07

This catalog defines external sources that may supply operational, hydrologic, regulatory-reference, or geospatial data to TSM. Source adapters run server-side. Provider responses are normalized with source identity, source/retrieval timestamps, units, CRS, vertical datum, quality/status, and data class before reaching application consumers.

## Federal sources

| Source ID | Authority | Primary endpoint | Data | Class / boundary |
|---|---|---|---|---|
| `USGS-NWIS-IV` | U.S. Geological Survey | `https://waterservices.usgs.gov/nwis/iv/` | Instantaneous streamflow/stage; parameter `00065` stage and `00060` discharge | Observation; raw stage remains GAGE_DATUM |
| `USGS-TNM` | U.S. Geological Survey National Map | `https://tnmaccess.nationalmap.gov/` | 3DEP lidar, DEM and related products | Evidence/geospatial acquisition; product metadata retained |
| `NOAA-NWPS` | NOAA/National Weather Service | `https://api.water.noaa.gov/nwps/v1/` | Gauge metadata, observed stage/flow and forecast products | Observation and forecast remain separate |
| `FEMA-NFHL` | Federal Emergency Management Agency | `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` | FIRM panels, flood hazard zones, BFEs, LOMAs/LOMRs, cross sections and related layers | Regulatory reference; not a TSM-issued determination |
| `USACE-NLD` | U.S. Army Corps of Engineers | `https://nld.sec.usace.army.mil/data-services/services/` | National Levee Database services | Geospatial/evidence reference |

## Indiana sources

| Source ID | Authority | Primary endpoint | Data | Class / boundary |
|---|---|---|---|---|
| `IDNR-BAFL` | Indiana DNR Division of Water | Indiana Floodplain Information Portal / Best Available Floodplain services | State flood hazard, BFE/floodway and elevation references | Regulatory-reference; preserve source status |
| `IDNR-INFIP` | Indiana DNR | Indiana Floodplain Information Portal | FEMA + state floodplain mapping and eFARA reference | Regulatory/reference service; do not scrape presentation HTML |
| `INDIANA-GIS` | Indiana Geographic Information Office | `https://gisdata.in.gov/server/rest/` | PLSS and other authoritative GIS services | Geospatial; preserve each service's native CRS |

## TSM source rules

1. A provider URL is not itself evidence of a successful observation. Store the exact source identifier and retrieval timestamp.
2. Raw USGS/NOAA gage height is `GAGE_DATUM` unless a separately validated, product-matched zero establishes a NAVD88 conversion.
3. Observed, forecast, simulation, derived calculation, evidence artifact, and regulatory-reference classes cannot be silently merged.
4. Missing or stale provider data produces an explicit degraded/unavailable state.
5. Binary terrain datasets such as LAS/LAZ/DEM are discovered or acquired outside Git history; Git stores manifests and provenance, not large operational payloads.
6. Regulatory source layers inform engineering review. TSM does not issue FEMA/IDNR/local floodplain determinations or permits.
7. Source contracts are validated in CI; unexpected endpoint or schema changes fail closed rather than silently degrading into synthetic values.
