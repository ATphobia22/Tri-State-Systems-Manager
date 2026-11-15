# FGDC Federal & Tri-State Geospatial Agency Catalog

**Dated:** 2026-11-15  
**Scope:** Federal mapping missions under OMB Circular A-16 / FGDC coordination, plus Indiana–Illinois–Kentucky state portals used by TSM.

> **Authority rule:** Catalog entries are **discovery and adapter targets**. They do not grant TSM regulatory power. Effective FIRMs, LOMA letters, PE-sealed surveys, and official warnings remain with the issuing agency. Prefer **observed** agency products; label **derived** and **scenario** layers distinctly.

## Central discovery directories

| Directory | Role | URL |
|---|---|---|
| **GeoPlatform.gov** | FGDC federal geospatial catalog / NGDA emphasis (Geospatial Data Act 2018) | https://www.geoplatform.gov/ |
| **FGDC Data & Services** | Entry to GeoPlatform search | https://www.fgdc.gov/dataandservices |
| **Data.gov Geospatial** | Aggregated open federal/state/local GIS | https://catalog.data.gov/dataset?metadata_type=geospatial |
| **USDOT State DOT GIS Directory** | Index of state DOT GIS portals | https://www.bts.gov/ (search State DOT GIS) |
| **NSGIC** | National States Geographic Information Council coordination | https://www.nsgic.org/ |

---

## Federal agencies (by mission group)

### Core civilian cartography, elevation & land records

| Agency | Primary products | Access notes |
|---|---|---|
| **USGS** | The National Map; 7.5′ topo; **3DEP** LiDAR/DEMs; hydrography (**NHD** legacy, **3DHP** successor); geologic hazards | https://www.usgs.gov/3d-elevation-program · https://apps.nationalmap.gov/ · 3DEP products free, no use restrictions |
| **BLM** | PLSS, federal land ownership, GLO historic plats | https://www.blm.gov/services/land-records |
| **U.S. Census Bureau** | **TIGER/Line** streets, boundaries, tracts, statistical areas | https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html |
| **NPS** | Park boundaries, trails, cultural resource GIS | https://www.nps.gov/subjects/gisandmapping/ |

### Water, weather, oceans & floodplains

| Agency | Primary products | Access notes |
|---|---|---|
| **FEMA** | MSC; **NFHL**; FIRMs; BFE; LOMA/LOMR | MSC: https://msc.fema.gov/ · NFHL REST: `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` (effective data) |
| **NOAA (general)** | Coastal/marine mapping, satellite, climate | https://www.noaa.gov/ |
| **NOAA NGS** | **NSRS**, datums, survey control benchmarks | https://geodesy.noaa.gov/ |
| **NOAA Coast Survey** | Nautical charts, bathymetry (coast / Great Lakes) | https://nauticalcharts.noaa.gov/ |
| **NOAA NWS** | Doppler radar, warnings, **river flood stage forecasts** | https://water.weather.gov/ · https://www.weather.gov/ |
| **USACE** | Navigable waterways, **National Levee Database**, dams, flood-risk engineering | https://www.nld.usace.army.mil/ · eHydro survey products |

### Defense, intelligence & space (public layers only)

| Agency | Public-facing products | Notes |
|---|---|---|
| **NGA** | Unclassified elevation (e.g. ArcticDEM patterns), aeronautical where released | Prefer USGS 3DEP for CONUS engineering |
| **NASA** | Earthdata land-cover, elevation, atmospheric remote sensing | https://www.earthdata.nasa.gov/ |
| **CIA World Factbook** | Political/physical reference maps (foreign) | Not a Tri-State engineering source |

### Agriculture, forestry & environment

| Agency | Primary products | Access notes |
|---|---|---|
| **USDA NRCS** | **Web Soil Survey** | https://websoilsurvey.nrcs.usda.gov/ |
| **USDA Forest Service** | Recreation/MVUM maps, timber/wildfire GIS | https://www.fs.usda.gov/ |
| **USDA FSA** | **NAIP** orthophotography | https://naip-usdaonline.hub.arcgis.com/ |
| **EPA** | EnviroAtlas, Superfund boundaries, air/water GIS | https://www.epa.gov/enviroatlas · https://echo.epa.gov/ |
| **USFWS** | **National Wetlands Inventory (NWI)**, critical habitat | https://www.fws.gov/program/national-wetlands-inventory |

### Infrastructure, transportation & health

| Agency | Primary products | Access notes |
|---|---|---|
| **USDOT / BTS / FHWA / FAA** | National Transportation Atlas; highways; aeronautical charts | https://www.bts.gov/ · FAA chart services |
| **DOE** | Grid, pipelines, renewable resource potential | Lab portals (verify current hosts) |
| **HUD** | QCTs, Opportunity Zones, public housing geography | https://www.huduser.gov/ |
| **HRSA** | Medically Underserved Areas / HPSA maps | https://data.hrsa.gov/ |

---

## Standard state agency categories (NSGIC pattern)

Every state typically distributes mapping across:

1. **GIO / GIS Clearinghouse** — base maps, parcels, ortho, LiDAR  
2. **Geological Survey** — bedrock, surficial, aquifers, karst, minerals, faults  
3. **DNR / Environmental Protection** — parks, forests, wetlands, floodplains, dams, wells  
4. **DOT** — highways, centerlines, bridges, ROW  
5. **EMA** — hazard mitigation, evacuation, response dashboards  
6. **Revenue / Assessment** — cadastral standards, taxing districts  

---

## Indiana & Tri-State regional portals (TSM priority)

### Indiana

| Entity | Products | Portal |
|---|---|---|
| **IGIO** | IndianaMap; **Indiana Elevation Hub**; statewide QL2→QL1 LiDAR program; ortho (CC0) | https://www.indianamap.org/ · https://elevation.gio.in.gov/ · Imagery: https://imagery.gio.in.gov/ |
| **IGWS** (Indiana University) | Subsurface geology, coal mine maps, karst, water resources | https://igws.indiana.edu/ |
| **IDNR** | **INFIP**; Best Available Flood Hazard mapping | Indiana Floodplain Information Portal |
| **AWS Open Data** | Indiana statewide elevation LAS (CC0) | https://registry.opendata.aws/in-elevation/ |

**2025–2028 program notes (IGIO):** 3-inch 4-band leaf-off ortho; QL1 LiDAR target 8 ppsm (tiered by year). Prior collections: 2011–2013 QL3; 2016–2020 QL2.

### Illinois

| Entity | Products | Portal |
|---|---|---|
| **ISGS Clearinghouse** | Statewide LiDAR (ILHMP), DEM/DTM/DSM, geology, imagery | https://clearinghouse.isgs.illinois.edu/ · LiDAR: https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/ |
| **Gallatin / southern IL** | County tiles via ILHMP downloader map | Align with TSM Gallatin DEM notes |

### Kentucky

| Entity | Products | Portal |
|---|---|---|
| **DGI / KyFromAbove** | Statewide leaf-off ortho, LiDAR LAZ, bare-earth DEM, oblique imagery (public domain) | https://kyfromabove.ky.gov/ · Catalog Explorer: https://kygeonet.ky.gov/catalogexplorer/ |
| **AWS Open Data** | KyFromAbove distribution | https://registry.opendata.aws/kyfromabove/ |

---

## TSM integration priorities (Tri-State River Valley)

| Priority | Source family | TSM use |
|---|---|---|
| **P0** | USGS 3DEP, IGIO/ISGS/KyFromAbove elevation | Terrain twin, freeboard geometry, NAVD88 awareness |
| **P0** | FEMA NFHL + MSC | Regulatory flood zones/BFE labels — never silent override |
| **P0** | USGS NWIS / NOAA NWPS | Live stage with sentinel correction + quality labels |
| **P1** | USACE NLD / eHydro | Levee context, navigation surveys |
| **P1** | Census TIGER + state DOT centerlines | Roads/cityscape basemap |
| **P1** | IDNR INFIP / Best Available | IN planning flood context (distinct from effective FIRM) |
| **P2** | NAIP / state ortho | Imagery drape |
| **P2** | NRCS soils, USFWS NWI, EPA EnviroAtlas | Environmental screening layers |
| **P3** | BLM PLSS, NASA Earthdata | Land records / research context |

### Adapter discipline

- Record **agency, product name, URL, CRS, vertical datum, retrieval time, SHA-256** when caching.  
- Soft-label `SOURCE_UNAVAILABLE` / `STALE` rather than inventing values.  
- Official hardcopy FIRM + FIS remain controlling under 44 CFR for NFIP purposes when digital and paper disagree (document both).  
- Machine-readable registry: [`data/tsm-fgdc-tristate-geospatial-registry-v1.json`](../data/tsm-fgdc-tristate-geospatial-registry-v1.json)

---

## Related TSM docs

- [DATA-SOURCE-CATALOG.md](DATA-SOURCE-CATALOG.md)  
- [MULTI-AGENCY-FLOOD-MAPPING-ERA-TABLE](flood/MULTI-AGENCY-FLOOD-MAPPING-ERA-TABLE-2026-11-14.md)  
- Engineering assurance standard; NFHL fabric; gage-datums fail-closed altitude metadata  
