# Elevation S3 Structure · Indiana Flood Zones · Related Authorities
Verified 2026-08-19 for Tri-State Systems Manager

## 1. S3 bucket `giselevationingov` (us-east-2)

Public list: `https://giselevationingov.s3.us-east-2.amazonaws.com/?list-type=2`

| Prefix | Contents |
|--------|----------|
| `las/` | Raw LAS point clouds |
| `las/statewide/YYYY/` | Statewide by year: **2011, 2012, 2013, 2016, 2017, 2018, 2019, 2020** |
| `las/countycollect/` | County collection campaigns (e.g. 2024/) |
| `las/lakerim/` | Lake-rim special collections |
| `copc/` | Cloud-Optimized Point Cloud (statewide, lakerim) |
| `dsmoptimized/` | Optimized Digital Surface Model |
| `ndhmoptimized/` | Normalized Digital Height Model |
| `intensity/` · `intensityoptimized/` | Intensity products |
| `mosaic/dem/` | DEM mosaics (statewide) |
| `metadata/` | Collection metadata |
| `usgspreliminary/` | USGS preliminary products |
| `index.html` | S3 browser entry |

CLI: `aws s3 ls --no-sign-request s3://giselevationingov/las/statewide/`

**TSM acquisition:** Evidence Plane workers fetch LAS/COPC/DEM for Posey AOI; hash payload; store EvidenceArtifact with `authority_class: OBSERVATION` (raw LAS) or `DERIVED` (DSM/NDHM/hillshade).

**HEC-HMS path (USACE HEC guides):** DEM → clip/reproject → import as Terrain Data in HEC-HMS Basin Model. Guides:  
https://www.hec.usace.army.mil/confluence/hmsdocs/hmsguides/gis-tools-and-terrain-data  
(QGIS and ArcMap tutorials; GDAL-supported rasters; U.S. Customary units for TSM site constants.)

---

## 2. Indiana flood zones (authoritative hierarchy)

**Do not collapse layers.**

| Layer | Authority | Use |
|-------|-----------|-----|
| **FEMA NFHL / effective FIRM** | FEMA | Flood insurance; SFHA Zones A/AE/… |
| **Indiana BAFM (Best Available)** | DNR Division of Water | Local regulatory + planning; more stream miles than NFHL |
| **INFIP + FARA** | DNR | FARA required for Zone A, unmapped, flood-prone, or upstream drainage > 1 sq mi; LOMA support |
| **Posey FIRM date** | FEMA | Posey County and Incorporated Areas FIRM **November 5, 2014** (and later updates if any) |

INFIP: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal  
BAFM downloads by county: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/

Posey flood ordinance references SFHA on FIRM dated 11/5/2014; Zone A uses DNR best data when upstream DA > 1 sq mi.

---

## 3. MapLibre integration (clarified)

| Item | Detail |
|------|--------|
| Package | `maplibre-gl` ^4.7.1 |
| Route | `/map` → `MapLibreMap.tsx` |
| Base map | OSM raster tiles (swap-ready for IGIO imagery when token/CORS allow) |
| Site marker | Center of SITE bounding envelope; popup APN + BFE |
| Water / BFE mesh | `fill-extrusion` GeoJSON — **VISUALIZATION only** |
| Stage slider | SIMULATION_DEMO when not live USGS/NWPS |
| Live stage | From `mapTwinLoader` / stage.ts |
| Next optional | Add IGIO ImageServer as raster source; COPC via potential future 3D tiles |

---

## 4. Additional verified programs

### LARE (Lake and River Enhancement) — Indiana DNR Fish & Wildlife
- User-funded via boat registration fee
- Projects: sediment/logjam removal, aquatic invasive control, habitat
- Local sponsor ≥20% cost share; applications typically due **Jan 15**
- https://www.in.gov/dnr/fishwild/2364.htm · lare@dnr.IN.gov

### USACE CAP Section 204 — Beneficial Use of Dredged Material
- WRDA 1992 §204; Continuing Authorities Program
- Habitat protection/restoration or storm damage reduction **in connection with** federal navigation dredging
- **Cannot** meet mitigation/remediation requirements
- Feasibility: 100% federal; Design/construction: typically 65% federal / 35% sponsor; O&M 100% sponsor
- Federal ceiling cited in district fact sheets (often $10M–$15M range — confirm district)
- Start: Letter of Intent to local USACE district

### Posey GIS / parcels
- County portal referenced: https://poseyin.wthgis.com (WTH GIS) — validate live before treating as cadastral authority
- Statewide parcels 2025: IGIO Data Harvest FeatureServer  
  https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer

### IndianaMap
- Hub: https://www.indianamap.org / https://indianamap-inmap.hub.arcgis.com  
- Ortho, elevation viewers, framework layers

### NRCS resources
- Soil surveys / Web Soil Survey; Posey County soil map units available via NRCS
- https://www.nrcs.usda.gov/resources

