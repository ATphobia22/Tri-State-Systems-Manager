# Candidate Hydrology AOI Report — 13101 Bonebank Road, Posey County, Indiana

**Assessment date:** 2026-10-15  
**Record ID:** `posey-13101-bonebank-road`  
**Decision status:** **CANDIDATE ONLY — NOT APPROVED FOR ENGINEERING OR MODEL EXECUTION**  
**Purpose:** Identify the candidate property, distinguish parcel evidence from a hydrologic catchment, inventory authoritative terrain/water-data sources, and specify the next evidence-gated workflow steps.

## 1. Executive finding

The Indiana Geographic Information Office (IGIO) 2025 statewide parcel layer contains a matching candidate record for **13101 Bonebank Road, Mount Vernon, IN 47620**, Posey County (county FIPS `18129`). The repository records parcel identifier `65-19-08-100-008.001-010`, IGIO object ID `335325`, and a closed parcel polygon in `data/posey-county/aoi/13101-bonebank-road-parcel.geojson`.

This verifies a **candidate parcel record**, not the legal boundary by survey and not the hydrologic area of interest (AOI). The polygon-derived area estimate is approximately **2.445 acres**; it is not surveyed acreage and must never be used as the HEC-HMS drainage area.

The parcel-centroid point intersects a FEMA National Flood Hazard Layer (NFHL) feature recorded as **Zone AE / Special Flood Hazard Area** in the captured query. The query returned `STATIC_BFE = -9999` and no vertical datum; the value is a no-data sentinel, **not a base flood elevation**. A fresh live point query of the Indiana DNR/IGIO Posey CSLF layer returned one intersecting polygon (`cslf_id=3785`) with `pre_zone=AE`, `new_zone=AE`, `pre_srccit=18129C_STUDY3`, and `new_srccit=STUDY10`. That polygon query did not return a BFE observation. The result corroborates a point-to-polygon Zone AE intersection only; it does not supply a numeric BFE or parcel-wide/structure-specific determination. The state-layer parcel polygon intersection establishes some overlap with the mapped AE polygon. A separate overlay also shows the address-associated candidate building footprint (IGIO building feature `763173`) intersects the same AE polygon. Neither result supplies the proportion of parcel/building area covered, a usable BFE, flood depth at the structure, or a property-specific hydraulic result.

A prior repository record stated **361.998 ft, NAVD88**, at the IGIO parcel-layer centroid. A live refresh through the research connector returned a value of 361.9983869 labelled **meters** despite a request for feet; the same connector returned 359.4862935 labelled meters for the legacy point. Because the raw service payload could not be independently retrieved and the unit interpretation is inconsistent, both returned values are quarantined and **neither is accepted as verified site-elevation evidence**. EPQS interpolates from the dynamic 3DEP elevation service and is not a survey, site DEM, first-floor elevation, or Lowest Adjacent Grade (LAG). USGS explicitly cautions that EPQS values are interpolated and not official surveyed values.

**Coordinate discrepancy disposition:** a fresh live query of the IGIO 2025 parcel service returned one feature whose parcel ID and situs address exactly match `65-19-08-100-008.001-010` and `13101 BONEBANK RD`, with centroid `-88.00535128, 37.84579909`. The legacy point `-88.0007, 37.9035` is approximately **6.42 km** away and is rejected as the working point for this address's AOI. Its provenance remains unverified; it must not be silently reused. This resolves the working GIS reference for the candidate address, but not the actual house footprint or legal boundary. Survey/county evidence is still required for boundary-sensitive work.

Accordingly, the current coupled-model state remains **`BLOCKED_NOT_RUN`**. No HEC-HMS or HEC-RAS execution, design flow, flood depth, water-surface elevation, no-rise conclusion, or engineering recommendation is asserted in this report.

## 2. Candidate geometry and location confidence

| Item | Captured evidence | Interpretation / limit |
|---|---|---|
| Address | 13101 Bonebank Road, Mount Vernon, IN 47620 | Address match in IGIO statewide parcel record; confirm with owner and county records |
| Administrative area | Posey County, Indiana; FIPS 18129 | Administrative context, not a watershed boundary |
| Parcel identifier | 65-19-08-100-008.001-010; state ID `651908100008001010` | Dataset identifiers; confirm current county parcel record |
| Parcel data source | IGIO, Parcel Boundaries of Indiana 2025, object ID 335325, source load date 2025-08-28 | Statewide GIS parcel geometry, not a certified boundary survey |
| Parcel geometry | EPSG:4326; SHA-256 `93d9115b21b14932674095b5267b482c9b38c6fc45399687a8b5126894b71572` | Hash pins the repository geometry bytes; does not certify the geometry's legal accuracy |
| Polygon-derived area | 9,895.75 m² / 2.4453 acres | Geodesic estimate from published ring vertices; not surveyed acreage or drainage area |
| IGIO parcel centroid | `-88.00535128, 37.84579909` (lon, lat) | Source-layer centroid used for point queries |
| Address point | `-88.005101, 37.845889` (lon, lat); IGIO object ID 1948776 | Live Address Points of Indiana 2024 record matches the same state parcel ID and situs address; point is not a surveyed entrance |
| Candidate building footprint | IGIO Building Footprints object ID 763173; approximately 258.7 m²; LidarYear 2020 | The matching Posey County address point falls inside this polygon; best available address-associated structure candidate, not owner/survey confirmed |
| Legacy coordinate | `-88.0007, 37.9035` (lon, lat) | Rejected as the working point for this address because it is ~6.42 km from the live exact-address IGIO parcel reference; provenance remains unknown |
| Approval | `NOT_APPROVED`; no approver, timestamp, or approval evidence | Keep fail-closed |

The stored GeoJSON is a closed five-position exterior ring and is suitable as a **candidate parcel footprint for review**. It is not suitable as the watershed polygon, HEC-RAS computational domain, inundation boundary, or substitute for a surveyed property line.

## 3. Authoritative data-source inventory

Availability below means that an official source or service has been identified and a candidate-site observation is recorded where stated. It does **not** mean a complete, quality-controlled model-input package has been acquired.

| Theme | Authoritative source / next acquisition | Present evidence | Required qualification |
|---|---|---|---|
| Parcel / administrative context | [IGIO Parcel Boundaries of Indiana 2025](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0); [IGIO 2025 data release](https://www.in.gov/gis/geoinsights/posts/data-releases-data-harvest-2025-and-imagery/) | Candidate parcel record and geometry are in the repository | Reconcile coordinate conflict; compare with current Posey County assessor/recorder data and survey if available |
| Elevation | [USGS 3DEP](https://www.usgs.gov/3d-elevation-program); [USGS EPQS](https://epqs.nationalmap.gov/v1/json); [USGS EPQS accuracy FAQ](https://www.usgs.gov/faqs/how-accurate-are-elevations-generated-elevation-point-query-service-national-map) | One EPQS point sample: 361.998 ft NAVD88, reported 1 m source resolution | Acquire full AOI-covering DEM/point cloud, metadata, acquisition date, vertical datum, nodata, breaklines and checksums; validate against survey |
| Streams / catchment | [USGS StreamStats](https://streamstats.usgs.gov/ss/); [StreamStats fundamentals and delineation limits](https://www.usgs.gov/streamstats/streamstats-fundamentals); [USGS 3D Hydrography Program](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products) | Candidate delineation method identified; no catchment is recorded | Select an explicit outlet/hydraulic point; delineate and inspect against conditioned terrain, hydrography, culverts, ditches, levees and flat terrain; save full-resolution polygon and basin area |
| Federal flood mapping | [FEMA Map Service Center](https://msc.fema.gov/portal/home); [FEMA NFHL service](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) | Captured centroid point intersection: Zone AE / SFHA; BFE sentinel `-9999`; datum absent | Retrieve effective FIRM panel, FIS report and relevant profiles/cross sections; determine zone coverage across parcel; do not infer BFE from sentinel |
| Indiana flood mapping / regulatory path | [Indiana Floodplain Information Portal](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/); [Indiana H&H guidance and model library](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links); [general H&H assessment guidance](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/general-guidelines-for-the-hydrologic-hydraulic-assessment/) | State-layer centroid point agrees with Zone AE/SFHA; no normalized BFE/depth/velocity | Obtain/download the site-specific INFIP/FARA result as applicable; verify whether existing state/FEMA models cover the relevant reach and their datum/model versions |
| Rainfall / design hydrology | [NOAA Atlas 14 precipitation-frequency data](https://hdsc.nws.noaa.gov/pfds/); [NOAA MRMS data tutorial](https://www.weather.gov/gis/mrms_data_quick_tutorial); [USDA NRCS TR-55](https://www.nrcs.usda.gov/resources/guides-and-instructions/urban-hydrology-for-small-watersheds-tr-55) | Sources identified; no selected storm, rainfall time series, or validated runoff hydrograph | Select the event/design standard for the intended decision; preserve interval, duration, temporal distribution, units, source/version and uncertainty; do not treat radar reflectivity (dBZ) as rainfall accumulation |
| Observed water / discharge | [USGS Water Data](https://waterdata.usgs.gov/); [USGS Water Services](https://waterservices.usgs.gov/) | TSM already tracks regional stations, but no site-catchment flow series has been qualified for this run | Confirm relevant gage(s), period of record, parameter/units, quality flags and representativeness; keep gage datum distinct from NAVD88 unless a published conversion supports it |
| Bathymetry / hydraulics | [Indiana DNR H&H Model Library](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links); [USACE HEC-RAS](https://www.hec.usace.army.mil/software/hec-ras/); [USACE HEC-HMS](https://www.hec.usace.army.mil/software/hec-hms/) | No reviewed site-specific HEC-HMS/HEC-RAS model package or qualified boundary conditions in this record | Obtain existing models, terrain/geometry, cross-sections, structures, roughness and boundaries; verify exact solver version/platform and reproducible execution path |

### Regional context from ERDC/CHL TR-22-4

The supplied USACE ERDC report, *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation* (February 2022), documents an AdH 2D hydrodynamic and sediment-transport investigation near the Wabash–Ohio confluence. It describes multi-beam bathymetry, floodplain LiDAR, flow measurements, hydraulic and sediment validation, and model scenarios. The study reach is near the confluence and extends downstream toward Smithland Locks and Dam.

This is valuable **regional methodological context**, not evidence that its model covers this parcel, not a ready-to-run HEC-HMS/HEC-RAS package, and not a transferable site-specific flood elevation. The report uses an “Ohio River Datum” for elevations and notes that a current location-specific conversion is needed; do not relabel those elevations as NAVD88. Source: [ERDC Library / report](https://erdc-library.erdc.dren.mil/handle/11681/43441) and the supplied file `ERDC-CHL-TR-22-4.pdf`.

## 4. AOI definition: keep the geometries separate

TSM must store at least three separate geometries for this effort:

1. **Candidate parcel footprint** — the IGIO polygon in the repository; used to anchor document/source queries and request owner review.
2. **Hydrologic catchment(s)** — to be delineated from an explicitly selected outlet/point of interest, reviewed against terrain and drainage infrastructure, and independently checked. This polygon is currently **not delineated**.
3. **Hydraulic model domain** — to be defined from the river/overland flow paths, structures, boundary locations and decision question. It may be larger than both parcel and catchment and must be justified by a qualified modeler.

A parcel address cannot choose the hydraulic outlet, identify the contributing drainage area, determine the upstream boundary, or establish a 1D/2D model domain. Do not start a real HEC-HMS/HEC-RAS run until the owner/engineer selects the intended question and the required geometries and inputs have been approved.

## 5. Evidence-gated next steps

### P0 — resolve location and authority

- [ ] Owner/qualified surveyor resolves the approximately 6.4 km coordinate discrepancy using a current authoritative parcel record, survey plat, and/or certified survey.
- [ ] Confirm parcel ID and geometry with Posey County and IGIO; record the source record, retrieval timestamp, geometry hash and any changed boundary.
- [ ] Download the effective FEMA map panel/FIS and relevant Indiana INFIP/FARA evidence; preserve the full source output and metadata.
- [ ] Record the engineering purpose (e.g., parcel drainage screening versus reach-scale river hydraulics) and intended decision; obtain a named reviewer.

### P1 — construct candidate hydrologic AOI

- [ ] Select and record the outlet/point of interest only after coordinate resolution.
- [ ] Run USGS StreamStats or an approved GIS delineation; archive the full-resolution basin polygon, basin area, method, data versions and output hash.
- [ ] Review the basin in terrain/hydrography, including flat floodplain, levees/berms, culverts, road crossings, ditches, and artificial drainage.
- [ ] Acquire full-coverage 3DEP terrain and site survey/breaklines as needed; verify horizontal CRS, vertical datum, units, resolution, acquisition dates and no-data.
- [ ] Identify applicable precipitation, gages, existing flood studies/models, channel bathymetry and boundary-condition records.

### P2 — qualify model inputs and run reproducibly

- [ ] Pin HEC-HMS/HEC-RAS version, platform, runner commands, project packages and dependency hashes.
- [ ] Build and validate the canonical manifest; hash all input artifacts and document transformations.
- [ ] Validate the HMS hydrograph’s timestamp/time zone, interval, units, gaps, drainage area and volume balance before transfer.
- [ ] Validate the RAS boundary mapping, datum, terrain/geometry, roughness, structures, mesh/cross sections and numerical settings before execution.
- [ ] Run a baseline only after upstream gates pass; retain logs, solver diagnostics, project/result hashes, mass-balance/convergence checks and deterministic run receipt.
- [ ] Complete independent calibration/validation, sensitivity/uncertainty analysis and qualified engineering review before publishing conclusions.

## 6. Current workflow state

| Gate | State | Evidence / reason |
|---|---|---|
| Address / candidate parcel lookup | **PARTIAL PASS** | IGIO candidate record captured; legal/site-coordinate conflict unresolved |
| Parcel geometry recorded | **PASS FOR CANDIDATE REVIEW ONLY** | Closed GeoJSON polygon and SHA-256 pinned; not a survey certification |
| Site elevation | **OBSERVATION ONLY** | Single interpolated EPQS point; not survey-grade or a surface |
| FEMA / Indiana flood context | **PARTIAL OBSERVATION** | Zone AE/SFHA centroid intersections; BFE/depth/velocity unavailable from these query responses |
| Hydrologic catchment | **BLOCKED — NOT DELINEATED** | No approved outlet, basin polygon or drainage area |
| AOI approval | **BLOCKED — NOT APPROVED** | Approval identity, timestamp and evidence are null |
| HMS execution | **BLOCKED — NOT RUN** | Catchment, forcing, parameters, solver package and validated runner not qualified |
| RAS execution | **BLOCKED — NOT RUN** | Domain, terrain/geometry, boundaries, datum, calibration and runner not qualified |
| Engineering / regulatory conclusions | **BLOCKED** | No validated model or qualified review disposition |

## 7. Main-branch / CI evidence

The report is committed to TSM `main`. The earlier verified workflow results on `43bd3c442fd7391eb3f1825ec5a581223762e768` do not prove the current tip is green. For the latest main commit, the connected GitHub status lookup returned no status entries and the available commit-workflow lookup returned no runs (that lookup is PR-triggered only). Therefore **current CI is not verified green**; inspect [GitHub Actions on main](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions?query=branch%3Amain) for the latest commit's actual run results.

## 8. Source references

- IGIO 2025 parcel service: https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0
- USGS 3DEP: https://www.usgs.gov/3d-elevation-program
- USGS EPQS accuracy FAQ: https://www.usgs.gov/faqs/how-accurate-are-elevations-generated-elevation-point-query-service-national-map
- USGS StreamStats fundamentals: https://www.usgs.gov/streamstats/streamstats-fundamentals
- USGS 3DHP data access: https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products
- FEMA Map Service Center: https://msc.fema.gov/portal/home
- FEMA NFHL: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
- Indiana INFIP: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/
- Indiana H&H resources/model library: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links
- Indiana general H&H assessment guidance: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/general-guidelines-for-the-hydrologic-hydraulic-assessment/
- NOAA Atlas 14: https://hdsc.nws.noaa.gov/pfds/
- NOAA MRMS: https://www.weather.gov/gis/mrms_data_quick_tutorial
- USGS Water Data: https://waterdata.usgs.gov/
- HEC-HMS: https://www.hec.usace.army.mil/software/hec-hms/
- HEC-RAS: https://www.hec.usace.army.mil/software/hec-ras/
- ERDC/CHL TR-22-4: https://erdc-library.erdc.dren.mil/handle/11681/43441

---
**Disposition:** Keep the parcel as a candidate record, not an approved hydrology AOI. Resolve the coordinate conflict, delineate and verify the watershed, acquire qualified inputs, and obtain human approval before any coupled HEC-HMS/HEC-RAS run or engineering recommendation.


## 9. Completion artifacts and current source guidance

The operational handoff is now split into three linked artifacts:

- [Candidate hydrology AOI report](./AOI-REPORT-13101-BONEBANK-ROAD-2026-10-15.md) — findings and limitations.
- [AOI completion checklist](./AOI-COMPLETION-CHECKLIST-13101-BONEBANK-ROAD-2026-10-15.md) — gate-by-gate evidence and approval requirements.
- [Authoritative source register](../../data/posey-county/evidence/13101-bonebank-road-source-register-v1.json) — machine-readable inventory of datasets, access URLs, limitations, and acquisition status.

Additional source review confirms two implementation details that should govern future ingestion:

1. USGS states that in 2024 it shifted from maintaining the legacy National Hydrography Dataset (NHD), Watershed Boundary Dataset (WBD), and NHDPlus High Resolution to 3D Hydrography Program (3DHP) products. Legacy datasets remain accessible but are no longer updated/maintained. Record the precise product vintage in every run manifest. See [USGS 3DHP access and data products](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products).
2. Indiana DNR's [INFIP guidance](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/) describes FARA requirements for certain A-zone permitting/LOMA cases and regulatory determinations involving drainage areas over 1 square mile, unmapped areas, or known flood-prone areas. The exact applicability must be confirmed with the state/local floodplain administrator; the current centroid point result is not a substitute for an INFIP/FARA review.

These sources add a repeatable acquisition plan, not a new delineated catchment or an engineering approval. The coordinate conflict, site-wide terrain review, and outlet confirmation remain release blockers.


## 10. Live source refresh and evidence corrections

A fresh query of the [IGIO 2025 parcel FeatureServer](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0) returned one feature for object ID `335325` with the exact situs address and parcel identifiers recorded above. The service reports Posey County as source originator, source feature ID `821117010080896417`, and load date `2025-08-28`. The returned polygon ring matches the candidate geometry coordinates. This independently refreshes the candidate parcel/address match, while leaving legal boundary certification and house footprint confirmation open.

A fresh point intersection against [Posey CSLF February 2025 state floodplain layer](https://gisdata.in.gov/server/rest/services/Hosted/Posey_CSLF_Feb2025/FeatureServer/0) returned polygon `cslf_id=3785`, with both `pre_zone` and `new_zone` equal to `AE`, and source citation `STUDY10`. This is a live point/polygon result, not a whole-parcel overlay, BFE, flood-depth estimate, or determination of the house's flood exposure.

The live EPQS refresh exposed a **unit-normalization inconsistency** through the research connector: values were returned with units labelled meters despite the query requesting feet. Since the raw service payload could not be independently retrieved in this pass, both EPQS values are quarantined. The prior report's numerical elevation claim must not be used for design or model inputs until the response and units are independently verified.

The full machine-readable record is [live query evidence (2026-10-15)](../../data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json). Current dispositions: working address/parcel match **verified from live service**; legacy point **rejected for this candidate AOI**; state floodplain point intersection **verified, limited**; EPQS elevations **quarantined**; legal boundary, actual structure footprint, site-wide DEM, effective FEMA/BFE review, outlet, catchment, and engineering approval **still open or blocked**.


## 11. Terrain product availability and methodological QA

The USGS The National Map Access API was queried against the candidate parcel bounding box. It returned four 1-meter DEM products covering that area. The selected candidate for the next acquisition step is [USGS 1 Meter 16 x41y419 IN_Indiana_Statewide_LiDAR_2017_B17](https://www.sciencebase.gov/catalog/item/60e6aebcd34e2a7685d0271b), with official raster URL [GeoTIFF](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/IN_Indiana_Statewide_LiDAR_2017_B17/TIFF/USGS_1M_16_x41y419_IN_Indiana_Statewide_LiDAR_2017_B17.tif). USGS metadata describes a 1-meter bare-earth DEM, horizontal reference NAD83 / UTM in meters, elevations in meters referenced to NAVD88, publication date 2021-07-04, and source acquisition dates 2017-03-03 to 2020-04-11. **The raster has not been downloaded, hashed, inspected, or processed in this pass.** Product availability is therefore verified, terrain suitability is not. The metadata also warns that one-meter tiles are not necessarily seamless across project boundaries.

Peer-reviewed method evidence supports treating terrain source and resolution as model inputs requiring explicit QA, not as interchangeable basemaps:

- Moges et al. (2023), [“How does the choice of DEMs affect catchment hydrological modeling?”](https://doi.org/10.1016/j.scitotenv.2023.164627), evaluated DEM choice across four terrain regions and found significant effects on stream/catchment delineation, with weaker performance in smaller/flatter catchments. Application here: inspect flow paths and boundaries in the actual local terrain, and cross-check any delineation rather than relying on resolution labels alone.
- Zhu and Chen (2024), [“A Study of the Effect of DEM Spatial Resolution on Flood Simulation in Distributed Hydrological Modeling”](https://doi.org/10.3390/rs16163105), found resolution-related changes in simulated flood results, with water-system extraction and slope reduction among factors associated with accuracy loss. Application here: preserve native DEM metadata, avoid unrecorded resampling, and test sensitivity before any hydraulic conclusions.

These studies are methodological evidence, not direct evidence about this parcel or a substitute for local calibration, survey, outlet confirmation, or regulatory review.

The research connector for scite could not be used because it reported that an active paid plan or free trial is required. Wolfram's contextual search returned no parcel-specific terrain or flood data. Official-source service queries and the SciSpace/Consensus/alphaXiv discovery results are captured through the source register and linked paper records; no unavailable connector is treated as evidence.

The live snapshot and source register now record the DEM catalog result. The next gate is acquisition and QA of the GeoTIFF, followed by local drainage/outlet verification. A catchment remains blocked until the outlet is approved and terrain/conveyance evidence is checked.


## 12. Updated regulatory flood query disposition

The direct FEMA NFHL point query is now refreshed and returned `FLD_ZONE=AE`, `STATIC_BFE=-9999`, and `V_DATUM=null`. The query confirms the Zone AE point intersection but provides no usable BFE or datum. A full parcel-geometry query against FEMA's NFHL service did not complete through the research connector, so no parcel-wide FEMA overlay is claimed.

Separately, the live Indiana CSLF service successfully queried the entire candidate parcel polygon and returned an intersecting state floodplain polygon (`cslf_id=3785`, `pre_zone=AE`, `new_zone=AE`, source `STUDY10`). This is stronger than the earlier centroid-only state result, but it is still a topological intersection, not a coverage percentage, house-footprint overlay, depth, or BFE. Review the effective FEMA panel, any LOMC, and Indiana INFIP/FARA before regulatory conclusions.


## 13. Terrain and hydrography live verification

### 13.1 One-meter DEM product identified; raster QA still open

A live The National Map product query returned four 1-meter DEM catalog candidates for the parcel bounding box, including **USGS 1 Meter 16 x41y419 IN_Indiana_Statewide_LiDAR_2017_B17**. Its [ScienceBase metadata](https://www.sciencebase.gov/catalog/item/60e6aebcd34e2a7685d0271b) states:

- 1-meter pixel resolution; bare-earth topographic surface derived from high-resolution lidar.
- Horizontal reference: UTM, NAD83, meters.
- Vertical reference: NAVD88, meters.
- Product publication date: 2021-07-04; source acquisition dates include 2017-03-03 and 2020-04-11.
- Tile bounds: west -88.023036022, south 37.762897306, east -87.908274708, north 37.853947521 (WGS84), which contain the candidate parcel.
- DEM tiles are seamless within collection projects but may not be seamless across project boundaries.

The exact GeoTIFF is [available from USGS TNM](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/IN_Indiana_Statewide_LiDAR_2017_B17/TIFF/USGS_1M_16_x41y419_IN_Indiana_Statewide_LiDAR_2017_B17.tif). The current execution environment could not resolve external DNS for a direct download, so no raster bytes were acquired, hashed, opened, or inspected. The terrain gate therefore remains **PARTIALLY RESOLVED — CATALOG MATCH ONLY**. Do not claim that raster QA or flow routing has been completed.

A separate direct 3DEP ImageServer identify request returned multiple pixel values, reported units as `NoData`, and a 150-unit pixel size. That response is not a trustworthy 1-meter DEM point sample and is excluded from site-elevation evidence. EPQS values also remain quarantined due the earlier adapter unit inconsistency.

### 13.2 Nearby mapped hydrography is context, not an outlet

A live query to the [USGS 3DHP FeatureServer](https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer) found 20 flowline records within a 1,000-meter query distance of the candidate parcel centroid, including records named **Levy Slough** and mapped features classified as canals, waterbody connectors, channel lines, and drainageways. The returned flowlines identify their source product as legacy `NHD`.

The same 1,000-meter query returned **zero** features from the service's HydroLocation layer (including catchment-outlet points) and **zero** catchment polygons. The USGS service documentation says the national service is not intended for site-specific regulatory determinations; USGS also states legacy NHD/WBD/NHDPlus HR products are no longer maintained. Therefore, this query establishes nearby mapped drainage context only. It does not prove hydraulic connectivity from the property, identify a site outlet, or produce a watershed boundary.

### 13.3 Evidence gate disposition

The detailed query responses are in [terrain and hydrography evidence JSON](../../data/posey-county/evidence/13101-bonebank-road-terrain-hydrography-evidence-2026-10-15.json). Current state:

| Gate | Disposition |
|---|---|
| Parcel/address reference | Verified by live IGIO record |
| 1-meter DEM catalog coverage | Verified by USGS catalog metadata |
| DEM download, checksum, and raster QA | Open; direct download blocked in this execution environment |
| Nearby hydrography | Screening context verified; records are NHD-derived |
| Actual structure footprint and legal boundary | Open |
| Effective FEMA panel, BFE, floodway and applicable FARA | Open |
| Specific outlet / culvert / ditch connectivity | Open; no 3DHP outlet point returned |
| Catchment polygon | Not delineated |
| HEC-HMS / HEC-RAS | `BLOCKED_NOT_RUN` |

The evidence-gated next steps are now more specific, but they are not all closed. A defensible catchment cannot be produced without the DEM raster, outlet selection, and conveyance/flow-path validation. The residential AOI remains unapproved for engineering or model execution.


### 13.4 Local 3DHP conveyance screen

The current [USGS 3DHP service](https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer) reports a service data refresh date of 2026-09-04. A query of a small bounding box around the candidate parcel returned ten flowline features. One returned feature, identifier `H77EJ`, is classified as a **Canal**. Using its returned EPSG:4326 line vertices and the candidate parcel ring, projected to NAD83 / UTM zone 16N (EPSG:32616), the line is approximately **7.0 m from the parcel boundary** at the nearest computed points. The nearest point on that mapped line is approximately `(-88.00443929, 37.84584730)`.

This is a **nearby conveyance candidate for review, not a selected or verified outlet**. The 3DHP service itself cautions that its data may be temporally outdated in places and is not intended for site-specific regulatory determinations. The broader local query returned four waterbodies, zero catchment-layer features, and zero outlet hydrolocations; those are query results, not evidence that no watershed exists. No private drain, culvert connection, yard grading, or runoff direction has been verified. The owner/field/county evidence must establish where home-site runoff actually enters a conveyance before delineating the catchment.

The live evidence JSON now records the flowline inventory, geometry-derived distance, candidate coordinates, source URL, service refresh date, and limitations. The connector-normalized flowline count was not consistent between query variants (10 vs. 20 for the same small bounding box); the companion 1-km query identified returned flowlines as NHD-derived. Treat these as screening records, not a complete hydrography inventory. The next actionable task is to inspect the site and nearby ditch/canal with current imagery and field/county evidence, then confirm the outlet point; do not substitute the nearby mapped canal automatically.


## 14. FEMA panel lookup and local outlet candidate update

A live FEMA NFHL query of the FIRM Panels layer at the parcel centroid returned panel **0300**, community **18129C**, effective date **2014-10-05**, source `18129C_BASE12`. This identifies the panel record for the centroid, but the current effective map index and any subsequent products must still be checked in the [FEMA Map Service Center](https://msc.fema.gov/portal/home) before regulatory use.

The NFHL Base Flood Elevations layer query was not usable for a numeric site BFE: the research connector summarized a feature with `bfe_value=0`, vertical datum `N/A`, panel `N/A`, and effective date `N/A`. That value is not accepted as a BFE. The point queries to FEMA's LOMR and LOMA layers returned no intersecting feature at the parcel centroid; this does not replace a full property/structure review of effective products. The flood gate is therefore **partially resolved, not closed**: Zone AE and a panel record are confirmed, but usable BFE, floodway status, actual structure exposure, and current MSC/INFIP/FARA review remain open.

The most local 3DHP bounding-box query returned ten flowline records. Feature `H77EJ`, classified as a canal, is approximately **6.997 m from the candidate parcel boundary** based on returned line geometry projected to EPSG:32616. This is the current nearby conveyance candidate to inspect. It is not the selected outlet: no drainage connection from the home to the canal, culvert, yard grading, or runoff direction has been verified. A separate 1-km query was summarized with duplicate rows (20 rows, 10 unique IDs) and included Levy Slough; retain that query as broad context, not as the local outlet inventory.

Updated raw query records are stored in:
- [Live parcel/flood query evidence](../../data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json)
- [Terrain/hydrography evidence](../../data/posey-county/evidence/13101-bonebank-road-terrain-hydrography-evidence-2026-10-15.json)
- [Source register](../../data/posey-county/evidence/13101-bonebank-road-source-register-v1.json)

The AOI remains **CANDIDATE / NOT APPROVED**. Remaining hard blockers are the DEM file acquisition and raster QA, actual house footprint and boundary review, current effective flood review and BFE/datum, physical outlet confirmation, and catchment delineation with independent QC.


### 13.5 Address-associated building footprint candidate

A live query of [Address Points of Indiana 2024](https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2024/FeatureServer/0) returned one Posey County address point for state parcel ID `651908100008001010` and `13101 BONEBANK RD`, at `(-88.005101, 37.845889)`. The same bounding-box query against [Indiana Building Footprints 2016-2020](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0) returned four footprint polygons, each with `LidarYear=2020`:

- **Object ID 763173**, approximately **258.7 m²**: fully within the candidate parcel and contains the matching address point (point-to-polygon distance 0 m). This is the strongest address-associated building candidate.
- Object ID 763169, approximately 143.0 m²: within the parcel; address point is about 18.5 m from the polygon.
- Object ID 763172, approximately 49.7 m²: within the parcel; address point is about 17.1 m from the polygon.
- Object ID 763168, approximately 88.0 m²: outside the parcel polygon by about 5.2 m; likely adjacent context, not assigned to the parcel.

The same state CSLF polygon query against candidate footprint 763173 returned `cslf_id=3785`, `pre_zone=AE`, `new_zone=AE`, source `STUDY10`. Thus the address-associated candidate building footprint intersects the state AE polygon. This is not a surveyed outline, a definitive classification of principal dwelling versus accessory structure, or evidence of a BFE/flood depth. The statewide building footprint layer is vintage 2016–2020; verify current imagery and owner/county/survey evidence before treating 763173 as the actual home footprint or using it for regulatory decisions.

Full geometries, areas, distances, query URLs and limitations are retained in [live query evidence JSON](../../data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json).


## 15. Address-associated building footprint candidate

A live query of Indiana's **Address Points of Indiana 2024** layer returned a Posey County address point for `13101 BONEBANK RD` tied to state parcel ID `651908100008001010`, at `(-88.005101, 37.845889)` in EPSG:4326. The point record's update date is 2022-08-01.

A live query of Indiana's **Building Footprints 2016–2020** layer returned four nearby polygons. Candidate feature **objectid 763173** is the best available address-associated footprint because the county address point falls inside it, it is fully within the candidate parcel, and it is the closest of the returned footprints to that address point. Its reported planar area is approximately **258.7 m²** (2020 lidar footprint). Two additional footprints (objectids 763169 and 763172) also lie within the parcel, and one footprint lies about 5.18 m outside the parcel boundary. The dataset does not functionally classify which structures are the principal dwelling, accessory buildings, or other structures.

A live Indiana CSLF overlay of candidate footprint 763173 intersects the state Zone AE polygon (`cslf_id=3785`, source `STUDY10`). This is a building-footprint-to-zone intersection only; it supplies no BFE, depth, velocity, finished-floor elevation, or regulatory determination. The footprint is historical and not a survey. Current imagery and owner confirmation are needed to confirm that feature 763173 is the actual home and that the footprint remains current. FEMA NFHL full-footprint overlay and effective panel/LOMC review remain open.

The structure evidence and all returned footprint geometries are preserved in the [live query evidence JSON](../../data/posey-county/evidence/13101-bonebank-road-live-query-evidence-2026-10-15.json). The structure gate is now **ADDRESS-ASSOCIATED CANDIDATE FOUND — OWNER/CURRENT-IMAGERY CONFIRMATION PENDING**, not fully approved. The AOI remains candidate-only; no catchment or model result has been generated.
