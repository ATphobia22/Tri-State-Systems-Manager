# Posey County Point Township — Historical Map / Current Data Reconciliation

**Reviewed:** 2026-09-14  
**Scope:** Point Township, Posey County, Indiana; Wabash–Ohio confluence corridor; T8S-R14W/R15W  
**Evidence classes:** historical reference, regulatory reference, government-derived geospatial, technical observation  
**Important:** The user-provided scans are historical reference evidence. They are not treated as current regulatory maps, surveys, parcel ownership records, or engineering determinations.

## 1. Information extracted from the supplied photographs

The supplied photographs contain two different historical source families:

### A. Point Township plat / land-ownership atlas pages

The scanned pages are labeled **POINT TWP—SOUTHWEST**, **POINT TWP—NORTHWEST**, and related Point Township quadrants. They show:

- Posey County, Indiana township geometry and PLSS section numbering.
- Township/range references including **T8S-R14W/R15W**.
- Section-level parcel boundaries and historical land-owner names.
- Historic road alignments and names including Bank Rd., Base Rd., Hasting Rd., Murphy Rd., Wolf Rd., Schroeder Ditch Rd., Major Rd., Oak Grove Rd., RESTRICTED_SITE_ROAD., and related local roads visible on the scans.
- River/channel geometry and the Indiana–Kentucky/Illinois boundary context around the Wabash/Ohio system.
- A Point Township inset showing the township quadrants (NW/NE/SW/SE).
- Page references across the township atlas, including pages 34–36 and an insert for the Illinois-side geometry.
- The maps are suitable for historical PLSS/parcel/topology reconciliation, but the handwritten annotations, ownership names, and parcel geometry must not be promoted to current cadastral truth without a current authoritative parcel source.

### B. Historical FEMA FIRM scans

The supplied scans visibly contain FEMA **Flood Insurance Rate Map (FIRM)** panels for Posey County, Indiana. The photographed panels include identifiers such as:

- **18129C0300C**
- **18129C0245C**
- **18129C0240C**
- **18129C0217C**
- **18129C0205C**

The panels visibly show flood-hazard symbology including Zone AE, Zone A, Zone X/shaded areas, floodway/other flood-area boundaries, cross-section references, base-flood elevation annotations, aerial-photo backgrounds, county/township/section context, and panel-map references. The photographed maps show an **effective date of November 5, 2014**.

These scans are valuable as a **2014 regulatory-reference snapshot** and as a historical-change baseline. They must remain distinct from the current FEMA effective product and from Indiana DNR's current Best Available Floodplain mapping.

## 2. High-value reconciliation targets

The historical scans should be used to create explicit change-detection targets rather than copied into the live authoritative layer:

1. **PLSS reconciliation:** match historical township/section geometry to current IndianaMap PLSS.
2. **Parcel reconciliation:** match historical parcel boundaries and owner labels to the 2025 Indiana parcel framework using section/township/range context and current parcel identifiers.
3. **Road-network change:** compare historical roads against current road centerlines and aerial imagery.
4. **Hydrography change:** compare historical river/channel/ditch geometry against current hydrography and current orthophotography.
5. **Floodplain change:** compare the 2014 FIRM panels against current FEMA NFHL/FIRM data and Indiana DNR Best Available Floodplain mapping.
6. **Terrain change:** compare the historical floodplain context against 2017–2020 Posey LiDAR, existing Indiana elevation products, and the newest available 3DEP/Indiana program data.
7. **Levee/embankment reconciliation:** identify mapped levees and non-levee embankments in the Point Township/Ohio-Wabash floodplain and keep their regulatory status separate from terrain-derived linear features.
8. **Hydrologic calibration:** bind the Point Township flood context to the USGS New Harmony gage and NOAA/NWS river forecasts without converting raw gage datum values into NAVD88 unless a validated datum relationship is available.

## 3. Current authoritative sources to integrate

### Indiana DNR — Floodplain Information Portal / Best Available Floodplain

Indiana DNR's current portal combines FEMA and Indiana sources and provides Best Available Floodplain mapping and BFE information. The current portal explicitly distinguishes effective mapping from Best Available Floodplain data and supports FARA generation for site-specific regulatory assessment.

Source: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/

### Indiana 2025 parcel framework

The Indiana Geographic Information Office released the **Parcel Boundaries of Indiana 2025** layer through the 2025 Data Harvest. The authoritative service exposes parcel identifiers, address fields, county FIPS, township/tax fields, and geometry in EPSG:4326. This should become the primary current parcel reconciliation layer for the historical Point Township atlas.

Source: https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0

### Indiana current orthoimagery

Indiana's Geographic Information Office maintains a current imagery service and historical/current orthoimagery program. The service is appropriate for historical-vs-current change detection and visual validation of roads, structures, channels, levees, and land use.

Source: https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer

### Indiana 2025–2028 imagery and LiDAR program

Indiana's new program provides high-resolution orthoimagery and QL1 LiDAR, with acquisition and QA/QC tracked by the state. County-level acquisition status must be recorded before a new product is promoted to verified Posey terrain evidence.

Source: https://www.in.gov/gis/geoinsights/posts/imagery-and-elevation-roadshows-march-2026/

### USGS 3DEP / LidarExplorer

USGS LidarExplorer provides current 3DEP LiDAR, DEM, topobathymetric and related product discovery. USGS publishes work-unit metadata containing acquisition dates, quality levels and project metadata links. This is the independent federal elevation discovery layer for TSM.

Source: https://www.usgs.gov/tools/lidarexplorer

### 2017–2020 Indiana western LiDAR

NOAA's metadata record for the Indiana statewide western-phase 2017–2020 LiDAR explicitly includes **Posey County**. This is a valuable historical terrain baseline between the older statewide products and the new 2025–2028 program.

Source: https://www.fisheries.noaa.gov/inport/item/69202

### USGS Wabash River at New Harmony — 03378500

USGS currently reports the New Harmony station as a Posey County monitoring location. The station metadata identifies NAVD88 for the surveyed gage altitude and provides continuous/daily/field/peak records through 2026. Raw stage observations remain distinct from any NAVD88-converted water-surface elevation used in engineering products.

Source: https://waterdata.usgs.gov/monitoring-location/USGS-03378500/

### NOAA / National Weather Service flood operations

2026 NWS products document multiple minor-flood events at Wabash River at New Harmony, including March, June, and August 2026 events. These records demonstrate why TSM should preserve event issuance time, observed stage, forecast crest, flood stage, and warning lifecycle as separate time-series evidence.

Representative current source: https://forecast.weather.gov/

### USACE National Levee Database

The National Levee Database should be used to reconcile levee systems against the historical FIRM/plat context and against LiDAR-derived embankments. Do not infer levee regulatory status solely from visual terrain signatures.

Source: https://levees.sec.usace.army.mil/

## 4. Current-vs-historical evidence rules

| Evidence | Classification | TSM treatment |
|---|---|---|
| User-provided Point Township plat scans | Tier 6 legacy/reference | Preserve as historical topology/ownership evidence; never current cadastral truth |
| User-provided 2014 FIRM scans | Tier 6 legacy + FEMA historical reference | Preserve panel/effective-date metadata; compare against current FEMA products |
| Current FEMA NFHL/FIRM | Tier 1 regulatory | Regulatory reference only; preserve effective date/version |
| Indiana DNR BAFL/INFIP | Tier 1/2 government-derived | Current state floodplain/regulatory reference; preserve source status |
| Indiana 2025 parcels | Tier 2 government-derived | Current parcel framework; reconcile, don't overwrite history |
| Indiana current imagery | Tier 2 government-derived | Current visual/change-detection evidence |
| 2017–2020 Posey LiDAR | Tier 3 technical | Historical terrain baseline |
| Current 3DEP / Indiana LiDAR | Tier 3 technical | Current terrain evidence after metadata/QA validation |
| USGS 03378500 | Tier 3 technical | Live/historical hydrologic observations; raw stage remains gage datum |
| NOAA/NWS forecasts/warnings | Tier 3 technical | Forecast and event evidence; never merge into observations |
| USACE NLD | Tier 2 government-derived | Levee inventory/evidence; status must follow NLD metadata |

## 5. Integration status

The TSM Posey acquisition registry now includes current Indiana parcel, current imagery, 2025–2028 imagery/LiDAR program, USGS 3DEP, Posey-specific 2017–2020 LiDAR, NOAA/NWPS and USACE/NLD sources. The Posey evidence ledger now records the historical Point Township scans separately from current regulatory and engineering evidence.

Large binary imagery/LAS/LAZ/DEM payloads should **not** be committed to Git history. Store only source manifests, metadata, hashes, acquisition dates, CRS/datum, and cache/object-storage references in the repository.

## 6. Recommended next ingestion sequence

1. Acquire current FEMA NFHL/FIRM and identify the current effective panels intersecting Point Township.
2. Download/query the Indiana 2025 parcel layer for `county_fips = 18129` and reconcile Point Township parcels.
3. Query current Indiana imagery footprints and retain the newest QA/QC-approved Posey imagery available.
4. Acquire the Posey subset of 2017–2020 LiDAR and current 3DEP/Indiana elevation products; record exact acquisition/vertical metadata.
5. Query USGS 03378500 historical and real-time stage/discharge and NOAA/NWPS forecast products into the observation/forecast planes separately.
6. Reconcile USACE NLD levee records and Indiana non-levee embankment data against terrain.
7. Generate a historical-to-current change report keyed by PLSS section and current parcel identifier.

**No historical map, user photograph, third-party property listing, or inferred geometry should be promoted to regulatory or cadastral truth without the authoritative source and metadata validation.**
