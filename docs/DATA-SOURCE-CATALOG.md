# Tri-State Systems Manager — Authoritative Data Source Catalog

**Status:** Production source registry  
**Updated:** 2026-09-18

This catalog defines external sources that may supply operational, hydrologic, regulatory-reference, or geospatial data to TSM. Source adapters run server-side. Provider responses are normalized with source identity, source/retrieval timestamps, units, CRS, vertical datum, quality/status, and data class before reaching application consumers.

## Federal sources

| Source ID | Authority | Primary endpoint | Data | Class / boundary |
|---|---|---|---|---|
| `USGS-NWIS-IV` | U.S. Geological Survey | `https://waterservices.usgs.gov/nwis/iv/` | Instantaneous streamflow/stage; parameter `00065` stage and `00060` discharge | Observation; raw stage remains GAGE_DATUM |
| `USGS-TNM` | U.S. Geological Survey National Map | `https://tnmaccess.nationalmap.gov/` | 3DEP lidar, DEM and related products | Evidence/geospatial acquisition; product metadata retained |
| `USGS-3DEP-LIDAREXPLORER` | U.S. Geological Survey | `https://www.usgs.gov/tools/lidarexplorer` | Current lidar, DEM, topobathymetry and ORI discovery/metadata | Evidence/geospatial acquisition; retain work-unit metadata |
| `NOAA-NWPS` | NOAA/National Weather Service | `https://api.water.noaa.gov/nwps/v1/` | Gauge metadata, observed stage/flow and forecast products | Observation and forecast remain separate |
| `FEMA-NFHL` | Federal Emergency Management Agency | `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer` | FIRM panels, flood hazard zones, BFEs, LOMAs/LOMRs, cross sections and related layers | Regulatory reference; not a TSM-issued determination |
| `USACE-NLD` | U.S. Army Corps of Engineers | `https://nld.sec.usace.army.mil/data-services/services/` | National Levee Database services | Geospatial/evidence reference |

## Indiana sources

| Source ID | Authority | Primary endpoint | Data | Class / boundary |
|---|---|---|---|---|
| `IDNR-BAFL` | Indiana DNR Division of Water | Indiana Floodplain Information Portal / Best Available Floodplain services | State flood hazard, BFE/floodway and elevation references | Regulatory-reference; preserve source status |
| `IDNR-INFIP` | Indiana DNR | Indiana Floodplain Information Portal | FEMA + state floodplain mapping and eFARA reference | Regulatory/reference service; do not scrape presentation HTML |
| `INDIANA-GIS` | Indiana Geographic Information Office | `https://gisdata.in.gov/server/rest/` | PLSS and other authoritative GIS services | Geospatial; preserve each service's native CRS |
| `INDIANA-PARCELS-2025` | Indiana Geographic Information Office / Indiana local governments | `https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0` | 2025 statewide parcel framework and parcel identifiers | Current cadastral framework; preserve source/load metadata |
| `INDIANA-CURRENT-IMAGERY` | Indiana Geographic Information Office | `https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer` | Current statewide orthoimagery | Current visual/change-detection evidence |
| `INDIANA-IMAGERY-LIDAR-PROGRAM` | Indiana Geographic Information Office / Woolpert | Indiana 2025–2028 Imagery & Elevation Program | 3-inch/6-inch orthoimagery and QL1 LiDAR program products | Acquisition program; county-specific QA/QC required before promotion |
| `INDIANA-2017-2020-LIDAR-WEST` | Indiana / NRCS / USGS | NOAA InPort metadata `69202` | 2017–2020 western Indiana classified LAS 1.4 LiDAR, explicitly including Posey County | Historical terrain baseline |

## Historical/reference sources

| Source ID | Source | Data | Class / boundary |
|---|---|---|---|
| `USER-POINT-TWP-PLAT-SCANS` | User-provided historical scans | Point Township PLSS, parcel/ownership labels, roads and historical hydrography | Tier 6 historical reference; not current cadastral truth |
| `USER-FEMA-2014-FIRM-SCANS` | User-provided historical FIRM scans | Posey County FIRM panels including 18129C0300C, 18129C0245C, 18129C0240C, 18129C0217C and 18129C0205C; photographed effective date 2014-11-05 | Tier 6 historical regulatory reference; not current effective mapping |


## Verified jurisdictional rule sources

| Rule ID | Authority | Citation | Primary source | Boundary |
|---|---|---|---|---|
| `IN-FLOODWAY-CAPACITY-0.15FT` | Indiana DNR | 312 IAC 10-2-3 | `https://www.in.gov/dnr/water/regulatory-permit-programs/exemptions/` | Rule reference; applicability and exceptions must be evaluated |
| `IN-FEMA-FLOODWAY-NORISE-0.00FT` | FEMA / Indiana DNR | 44 CFR 60.3(d)(3) implementation guidance | `https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/no-rise/` | FEMA/local no-rise pathway; distinct from DNR's state surcharge administration |
| `IL-PART-3700-FLOODWAYS` | Illinois DNR | 17 Ill. Adm. Code Part 3700 | `https://dnr.illinois.gov/content/dam/soi/en/web/dnr/adrules/documents/17-3700.pdf` | Jurisdiction-specific floodway construction rules |
| `KY-401-KAR-4-060` | Kentucky Administrative Regulations | 401 KAR 4:060 | `https://apps.legislature.ky.gov/law/kar/titles/401/004/060/` | Jurisdiction-specific stream construction criteria |

These records are mirrored in `data/regulatory/tsm-floodway-rules-v1.json` and are selected by jurisdiction and applicability before an engineering comparison is allowed to use a numeric criterion.

## TSM source rules

1. A provider URL is not itself evidence of a successful observation. Store the exact source identifier and retrieval timestamp.
2. Raw USGS/NOAA gage height is `GAGE_DATUM` unless a separately validated, product-matched zero establishes a NAVD88 conversion.
3. Observed, forecast, simulation, derived calculation, evidence artifact, and regulatory-reference classes cannot be silently merged.
4. Missing or stale provider data produces an explicit degraded/unavailable state.
5. Binary terrain datasets such as LAS/LAZ/DEM are discovered or acquired outside Git history; Git stores manifests and provenance, not large operational payloads.
6. Regulatory source layers inform engineering review. TSM does not issue FEMA/IDNR/local floodplain determinations or permits.
7. Historical scans are change-detection/reference evidence only. They do not override current FEMA, Indiana DNR, parcel, imagery, or survey sources.
8. Source contracts are validated in CI; unexpected endpoint or schema changes fail closed rather than silently degrading into synthetic values.
