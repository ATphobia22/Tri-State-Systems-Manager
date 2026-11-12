# Tri-State Systems Manager (TSM)

**A digital twin and scientific engineering workbench for the Ohio–Wabash River Valley.**

TSM brings **maps, terrain, rivers, buildings, land parcels, environmental information, engineering calculations, and traceable government evidence** into one open-source system. Its primary study area is the Ohio and Wabash River confluence across **Indiana, Illinois, and Kentucky**, with detailed source-data work in **Posey County and Mount Vernon, Indiana**.

**The idea is simple:** make complex river-valley information easier to see, understand, test, and explain—while preserving the mathematics and evidence that scientists and engineers need to review it.

[Explore the public console](https://atphobia22.github.io/Tri-State-Systems-Manager/) · [Browse the source code](https://github.com/ATphobia22/Tri-State-Systems-Manager) · [Engineering assurance standard](docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md) · [Government source catalog](docs/DATA-SOURCE-CATALOG.md)

> **Foundational principle:** Technology informs people; human authority remains final. TSM provides scientific information and decision support, not official emergency instructions, a professional certification, or an agency determination.

## Native Unreal Engine 5.8 application

The native engineering experience uses [`TSMNative.uproject`](tsm-native/TSMNative.uproject) and the **TSMNative** C++ module. Its Mount Vernon and Point Township scenes are part of the Tri-State digital twin, alongside the separately maintained public web console.

### Native features and functions

| System | Implemented source and functionality |
|---|---|
| **Engineering command dashboard** | Native Slate-based [engineering HUD](tsm-native/Source/TSMNative/TSMEngineeringHUD.cpp) with runtime inspection and engineering status controls |
| **World Partition scene support** | [GameMode](tsm-native/Source/TSMNative/TSMNativeGameMode.cpp) initializes the native HUD and creates a streaming prefetch anchor when the active map supports World Partition |
| **Scientific engineering runtime** | [Engineering runtime subsystem](tsm-native/Source/TSMNative/TSMEngineeringRuntimeSubsystem.cpp) provides native engineering calculation and inspection integration |
| **Native experience lifecycle** | [Experience subsystem](tsm-native/Source/TSMNative/TSMExperienceSubsystem.cpp) organizes application experience state |
| **Terrain and building workflows** | Geospatial source acquisition, terrain and 3D building geometry preparation, GLB/3D Tiles tooling, source-identity reconciliation and validation |
| **Hydrology and flood analysis** | Gage-datum validation, runoff and diffusion-wave screening, hydraulic-model evidence contracts, flood-zone and elevation comparisons |
| **Geodesy and surveying** | Coordinate transformations, NAVD88/GEOID18 evidence, COGO, LandXML import, weighted least-squares adjustment and earthwork quantities |
| **Evidence and review** | Source manifests, checksums, provenance records, missing-evidence states and human-reviewed engineering calculations |

These are **repository source capabilities**, not a claim that every GIS layer is populated in a packaged scene or that every subsystem has been independently exercised in a Shipping executable. The [native scene-layer subsystem](tsm-native/Source/TSMNative/TSMSceneLayerSubsystem.cpp) and [engineering HUD](tsm-native/Source/TSMNative/TSMEngineeringHUD.cpp) now include source-aware BUILDINGS/FLOODPLAIN/UTILITIES visibility controls and local save/load profiles; [offline startup smoke-test tooling](scripts/native/Verify-TSMOfflineLaunch.ps1) also exists on `main`. These source-level features do **not** prove that a complete native map, verified geometry, or headed Shipping runtime has been tested.

### Build and offline distribution

The canonical Windows entry points are [`Build-TSMNativeWindows.ps1`](scripts/native/Build-TSMNativeWindows.ps1) and [`Build-TSMShipping.ps1`](scripts/build/Build-TSMShipping.ps1). The pipeline is designed to stage native dependencies, generate the native map, compile/cook/archive the UE5.8 Win64 Shipping application, and prepare an offline distribution. A successful script invocation must still be corroborated by its actual build logs and output artifacts.

Release verification includes a real native map, packaged executable, TSMData manifest hashes, compatible CRS and vertical-datum metadata, headed terrain/building screenshots and performance measurements, and startup on a clean Windows 11 x64 system with networking disabled. **A process surviving startup is not proof of correct graphics, scientific data or complete offline operation.**

### Sovereign Deduplication Engine and parallel reasoning

The [Sovereign Deduplication Engine (SDE)](crates/sovereign-dedup-engine/) is merged into `main` through [PR #572](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/572) (squash commit `4faf56dfb96eda3dd9ab8bb7319b613a9ed85aba`). It is an **offline Rust content-addressed store** for versioned, deterministic reasoning-subgraph JSON and its provenance, not a replacement for the authoritative engineering evidence ledger.

- **Chunking and integrity:** GF(2) Rabin rolling fingerprints define content-dependent chunk boundaries; SHA-256 identifies and verifies stored objects. Graph and provenance payloads can be reconstructed and checked.
- **Evidence bridge:** [Python adapter](backend/sde_evidence_adapter.py) connects the Rust CLI to TSM's existing SQLite scientific-evidence ledger, retaining its own chain and recording outcomes as **not evaluated** until separately reviewed. SQLite chain-head writes are serialized to prevent concurrent-writer forks.
- **Parallel reasoning:** the bounded [Rust reasoning interface](crates/sovereign-dedup-engine/src/parallel.rs) evaluates independently supplied candidate hypotheses and validates response identity and score. **No trained, pinned offline neural model is supplied or certified by this interface.**
- **Build integration:** the [Windows native build](scripts/native/Build-TSMNativeWindows.ps1) stages the [Rust companion](scripts/native/Stage-SovereignDedupEngine.ps1) for the offline archive and requires separate Authenticode signing and verification before installer compilation. `Cargo.lock` and `--locked` support reproducible Rust dependency resolution.
- **Validation:** [SDE CI](.github/workflows/sovereign-dedup-engine.yml) exercises Rust tests, Rust → Python → SQLite integration, concurrent ingestion and metadata-corpus benchmarks on Windows and Linux. The first three-file TSM metadata proxy corpus measured **0% byte deduplication** (15,910 logical input bytes; 15,910 unique chunk bytes). **No 40–70% storage-savings claim is established**; representative reasoning-graph benchmarks and complete on-disk accounting remain required.

Read the [SDE production integration and outstanding acceptance gates](docs/native/SDE-PRODUCTION-INTEGRATION.md). Neural scores, chunk hashes, or successful CI tests are not engineering or regulatory certification.

### Release status and independent acceptance gates (2026-11-12)

The code merges for [installer evidence retention (#570)](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/570), [Shipping artifact inventory (#571)](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/571), and [SDE integration (#572)](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/572) are complete. PR #572 passed **14/14 reported PR-head workflows** before merge. That is distinct from post-merge `main` CI and from actual native application release evidence.

| Gate | Evidence / state at the 2026-11-12 check |
|---|---|
| SDE source and cross-platform PR CI | **Verified:** merged and PR-head checks passed |
| Post-merge `main` CI | **Pending verification:** new push workflows started; do not infer green from PR checks |
| UE5.8 Win64 Shipping and offline installer | **Queued / not yet verified:** [TSM Native run 43227217501](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43227217501) has a `package-windows` job queued; signed binary and installer not evidenced |
| Clean Windows 11 x64 air-gapped startup | **Not evidenced:** needs executable launch, no external service dependency, headed screenshots, FPS/VRAM/hardware and logs |
| Terrain, buildings and scientific provenance | **Partially evidenced:** source identity checks do not establish full county DEM coverage, vertical-datum correctness, cooked .umap, all 3D tiles or regulatory approval |
| Offline neural inference | **Not evidenced:** reasoning interface exists; trained model and audited inference runtime absent |
| SDE production-size storage savings | **Not evidenced:** metadata proxy benchmark is not representative of repeated reasoning subgraphs |

The [Shipping artifact inventory](scripts/native/) and [offline launch smoke test](scripts/native/Verify-TSMOfflineLaunch.ps1) help capture evidence but cannot replace physical, network-disabled runtime validation. A green static workflow does not prove a signed Unreal Shipping package. **Human authority remains final.**

### Scientific and regulatory boundaries

TSM separates **observed water levels**, **modeled flood scenarios**, **FEMA effective flood-hazard data**, and **Indiana DNR planning layers**. Flood calculations and elevation comparisons require verified units, coordinate reference systems, vertical datums, timestamps and source provenance. Engineering reports support review; they are not automatically certified surveys, FEMA/USACE determinations, or authorized regulatory submissions.

## 1. What TSM can do

| Capability | What it means in everyday language | Technical foundation |
|---|---|---|
| **Interactive digital twin** | Explore terrain, rivers, roads, parcels, buildings, and flood-related layers together. | React/TypeScript, MapLibre, Three.js, geospatial tiles and source-aware map layers |
| **Cinematic 3D engineering scenes** | View landscape and infrastructure in 3D, inspect elevations, and explore scene and camera tools. | Building geometry, GLB/3D Tiles tooling, Unreal Engine 5.8 native source and Cesium integration contracts |
| **River observations** | Inspect named river stations, water levels, flow observations, and timestamps. | USGS Water Data, NOAA National Water Prediction Service, gage-datum validation |
| **Flood-hazard mapping** | Compare published flood information with parcels, roads, structures, and terrain. | FEMA National Flood Hazard Layer, effective map products, Indiana DNR flood-hazard layers |
| **Rainfall and runoff** | Estimate the runoff generated by a defined rainfall event and watershed. | USDA NRCS Curve Number method and time-step runoff calculations |
| **Water movement and inundation** | Explore depth and spread of water over terrain for declared scenario inputs. | 2D diffusion-wave screening, Manning friction and explicit numerical time stepping |
| **Hydraulic-model evidence** | Bring hydraulic-model inputs, results, and review records into a traceable workflow. | HEC-RAS-related tools, HDF5/result adapters, model and manifest contracts |
| **Ground and building elevation analysis** | Compare elevation surfaces and identify geometry or datum inconsistencies. | LiDAR/DEM ingestion, geodesy, GEOID18 references, 3D-building source reconciliation |
| **Earthworks and slope stability** | Evaluate berm sections, volumes, cut/fill quantities, and simplified stability factors. | Trapezoidal geometry, volume integration, Bishop simplified-method solver |
| **Surveying and land geometry** | Import survey geometry, transform coordinates, perform COGO and adjust observations. | LandXML, PROJ, GeographicLib, weighted least squares and leveling |
| **Farms and environmental context** | Cross-reference soils, agricultural land, wetlands, waterways, and flood exposure. | USDA soils/cropland, USGS hydrography, USFWS wetlands, parcel overlays |
| **Infrastructure and community context** | Study roads, bridges, levees, structures, jurisdictions, and public datasets. | Indiana GIO, Census TIGER, USACE levees, FHWA inventory and agency registries |
| **Research and funding evidence** | Organize technical context for community improvement and funding research. | Source registries, documented program references, evidence reports and grant matrices |
| **Audit-friendly results** | Understand which source, formula, inputs, units, version, and timestamp produced a result. | Provenance records, checksums, validation rules, manifests, human-review states |

The repository contains both the **public web console** and **native engineering application source**, along with independent scientific, geospatial, surveying, ingestion, and validation modules. Each function operates within its own input and evidence requirements.

## 2. Explore the system

### Maps, 3D landscapes, and infrastructure

TSM's mapping and visualization modules support:

- Terrain models, hillshades, elevation inspection, and source-attributed imagery.
- Buildings and infrastructure linked to their original spatial identifiers.
- Parcel, road, flood-zone, hydrography, and jurisdiction overlays.
- 3D geometry workflows involving GeoJSON, GLB, 3D Tiles, and hierarchical level of detail.
- Water-depth visualization, scenario layers, in-world inspection controls, and cinematic scene tooling.
- Both local/offline data packaging contracts and separate public web visualization paths.

**Posey County building example:** Two recovered GeoJSON inventories were reconciled by government building identifier. They contain **23,082 matching building OBJECTIDs and 23,082 matching footprint geometries**, with no missing or duplicate IDs in that comparison. This establishes footprint identity across those two files; derived building-height attributes have their own evidence classification.

Read the [Posey source verification](docs/engineering-development/POSEY-DRIVE-SOURCE-VERIFICATION-2026-11-09.md), [Mount Vernon city-scene runbook](docs/engineering-development/MOUNT-VERNON-CITY-SCENE-RUNBOOK.md), and [LOD roof-evidence methods](docs/MOUNT-VERNON-LOD-EVIDENCE.md).

[Roof-plane and terrain-alignment diagnostics](docs/engineering-development/LOD-RECONSTRUCTION-METHODS-AND-ALIGNMENT.md) provide native plane-intersection/vertical-residual helpers and a non-mutating GeoTIFF contact comparison. They preserve missing-evidence states and do not certify LoD, source accuracy, facade openings, or interiors.

### Rivers, flooding, and property context

The hydrology and mapping systems help users:

- Find the original river station and observation time rather than reading an unexplained water-level number.
- Keep **gage stage** separate from an actual elevation referenced to a vertical datum.
- Inspect effective FEMA flood-hazard information independently from Indiana's best-available flood-hazard planning information.
- Evaluate user-defined rainfall, runoff, flood-depth, and conveyance scenarios.
- Compare site elevations, first-floor elevations, and water surfaces **only when units and datums are compatible**.
- Preserve source inputs and model results for subsequent scientific or professional review.

### Survey, construction, and geotechnical work

Engineering modules provide coordinate geometry (COGO), geodesic distance calculations, coordinate transformations, LandXML point/TIN import, weighted least-squares adjustment, leveling, earthwork quantity calculations, and simplified Bishop slope stability. These produce calculation records—not a survey seal or permit.

Survey documentation: [Offline survey tools](tools/survey/README.md) · [Survey computational methods](docs/survey/SURVEY-COMPUTATION-NOTES.md) · [Geotechnical solver](backend/solvers/geotech.py).

## 3. Mathematics and scientific methods

This section lists **equations represented in the repository**, their input meanings, and where the implementation can be reviewed. Units must remain consistent within each calculation. Empirical screening formulas and numerical models have defined assumptions and are not interchangeable with calibrated hydraulic studies.

### 3.1 River stage and water-surface elevation

A river gage measures the water level **relative to its own reference zero**. Where a verified gage-zero elevation is supplied:

$$
\mathrm{WSE}_{NAVD88}=\mathrm{stage}_{gage}+\mathrm{gageZero}_{NAVD88}
$$

All three quantities must use compatible units. The station, parameter, reference datum, and documented gage zero are part of the evidence record.

Implementation: [Gage-datum evidence](backend/evidence/gage_datum.py) · [Stage and datum explanation](docs/engineering/GAGE_DATUM_AND_STAGE.md).

### 3.2 Geodesy: ellipsoid height, orthometric height, and geoid separation

$$
H=h-N \qquad\text{or equivalently}\qquad h=H+N
$$

- **H:** orthometric height (for example, NAVD88 when supported by the appropriate model).
- **h:** ellipsoidal height.
- **N:** geoid separation from the appropriate geoid model.

TSM identifies horizontal reference systems and vertical datums separately. The Posey workflow uses NAD83 / Indiana West reference systems and NGS GEOID18 evidence where applicable. A valid conversion also depends on a compatible frame, epoch, geoid grid, and stated units.

Implementation: [Geoid model](packages/geo/src/geodesy/GeoidModel.ts) · [GEOID18 evidence](data/geo/geoid18/README.md).

### 3.3 Rainfall to runoff: USDA NRCS Curve Number

For event precipitation **P**, watershed Curve Number **CN**, potential retention **S**, and initial abstraction **Ia**, with rainfall and retention expressed in inches:

$$
S=\frac{1000}{CN}-10,\qquad I_a=0.2S
$$

$$
Q=\begin{cases}
0 & P\le I_a\\
\frac{(P-I_a)^2}{P-I_a+S} & P>I_a
\end{cases}
$$

Here **Q** is estimated *direct runoff depth*, not river discharge. The implementation also converts the change in runoff depth across time intervals into an area-weighted discharge rate. It uses a lumped watershed representation and explicitly records modeled provenance.

Implementation: [SCS Curve Number runoff module](tsm-console/src/lib/hydrology-runoff.ts).

### 3.4 River/channel conveyance: Manning equation

In SI units, average open-channel velocity and discharge can be estimated as:

$$
V=\frac{1}{n}R^{2/3}S_f^{1/2},\qquad Q=AV
$$

- **n:** Manning roughness coefficient.
- **R:** hydraulic radius, in metres.
- **S_f:** energy/friction slope, dimensionless.
- **A:** flow area, in square metres.
- **V** and **Q:** velocity (m/s) and discharge (m³/s).

Engineering modules use the corresponding unit-specific formulations for other unit systems. A defensible result depends on measured or justified geometry, roughness, and slope.

Implementation: [Engineering kernel](integrations/engineering-fabric/engineering_kernel.py) · [Native engineering runtime](tsm-native/Source/TSMNative/TSMEngineeringRuntimeSubsystem.cpp).

### 3.5 Two-dimensional inundation: diffusion-wave approximation

The 2D screening solver updates cell water depth from precipitation and intercell flow:

$$
h^{t+\Delta t}=\max\left(0,\ h^t+\Delta t\,[r-\nabla\cdot\mathbf q]\right)
$$

The implementation calculates face fluxes using water-surface slope and Manning friction, with closed domain boundaries. It checks an explicit diffusion time-step condition of the form:

$$
\Delta t\le\frac{\Delta x^2}{4D_{\max}}
$$

This is a **diffusion-wave approximation**, not a full shallow-water momentum solution. Results are interpreted for their stated model assumptions.

Implementation: [2D hydraulics](tsm-console/src/lib/hydraulics-diffusion2d.ts).

### 3.6 Flood depth and freeboard

For a water-surface elevation and terrain elevation in the **same** vertical datum:

$$
d=\max(0,\ \mathrm{WSE}-z_{ground})
$$

For a building or property screening comparison:

$$
\mathrm{freeboard}_{LAG}=\mathrm{LAG}-\mathrm{BFE}
$$

**LAG** is lowest adjacent grade; **BFE** is base flood elevation. The same general subtraction can be applied to a properly documented first-floor elevation, but that is a different property quantity.

Implementation: [Freeboard methodology](docs/simulation/LAG-BFE-FREEBOARD-AND-HEC-RAS.md).

### 3.7 Geotechnical stability: Bishop simplified method

For slope slices with weight **W**, slice width **b**, pore pressure **u**, cohesion **c**, friction angle **φ**, and slip-base inclination **α**, the code iteratively evaluates:

$$
F=\frac{\sum_i\frac{c b_i+(W_i-u_i b_i)\tan\phi}{m_{\alpha,i}}}{\sum_i W_i\sin\alpha_i},
\qquad
m_{\alpha,i}=\cos\alpha_i+\frac{\sin\alpha_i\tan\phi}{F}
$$

The solver records convergence, iteration count, a configurable screening threshold, and an input SHA-256 digest. Geotechnical parameters must come from justified inputs.

Implementation: [Bishop solver](backend/solvers/geotech.py).

### 3.8 Earthwork quantities and compensatory storage

For gridded existing and proposed terrain, an approximate cut/fill volume is the sum of positive elevation differences multiplied by cell area:

$$
V_{\mathrm{fill}}=\sum_i\max(0,z_{proposed,i}-z_{existing,i})A_i
$$

$$
V_{\mathrm{cut}}=\sum_i\max(0,z_{existing,i}-z_{proposed,i})A_i
$$

For an **explicitly supplied** storage ratio **r**:

$$
V_{\mathrm{required\ excavation}}=r\,V_{\mathrm{fill}}
$$

The required ratio is a project or authority-specific **input**, not a universal statutory constant.

Implementation: [Engineering kernel](integrations/engineering-fabric/engineering_kernel.py) · [Storage screening evaluator](tsm-console/server/engineering/compensatory-storage.mjs).

### 3.9 Survey adjustment: weighted least squares

Survey observations can be represented as a linear system with design matrix **A**, observations **l**, and weight matrix **W**:

$$
\hat{x}=\arg\min_x (Ax-l)^T W(Ax-l)
$$

For full-rank systems, the conventional normal-equation representation is:

$$
\hat{x}=(A^TWA)^{-1}A^TWl
$$

TSM's survey tool uses numerical linear-algebra methods, including SVD, and records residuals, covariance, and diagnostic information to support review.

Implementation: [Survey adjustment](backend/survey/adjustment.py) · [Offline survey pipeline](tools/survey/README.md).

### 3.10 Depth-damage research screening

The depth-damage module relates **water depth above first floor** to an occupancy-specific damage fraction. In simplified form:

$$
\mathrm{estimated\ loss}=f(d,\mathrm{occupancy})\times\mathrm{replacement\ value}
$$

The repository's curves include illustrative adaptations of published FEMA Hazus/USACE generic relationships. They are labeled modeled estimates and require appropriate local calibration for consequential use.

Implementation: [Depth-damage module](tsm-console/src/lib/hazus-depth-damage.ts).

## 4. Government data and authoritative reference sources

TSM's source registry and scientific workflows name **official agencies, data services, and technical references**. Some entries are directly queried by adapters; others are source catalogs, acquired snapshots, or reference methods. A link in this table identifies the **source of record**, not proof that the service is continuously online or that a particular dataset is current.

### Floodplains, maps, property, and infrastructure

| Agency | Government source / official link | Role in TSM |
|---|---|---|
| FEMA | [Flood Map Service Center](https://msc.fema.gov/portal/home) | Effective FIRM/FIS flood-map search and reference |
| FEMA | [National Flood Hazard Layer — REST](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) | Effective flood-hazard GIS layer discovery and queries |
| FEMA | [FEMA GIS Hub](https://gis-fema.hub.arcgis.com/) | Agency geospatial datasets and map discovery |
| Indiana GIO | [2016–2020 building footprints](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0) | Government building polygons and identifiers |
| Indiana GIO | [2024 road centerlines](https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2024/FeatureServer/0) | Road network geometry and mapping context |
| Indiana GIO | [Current parcel boundaries](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer) | State parcel mapping references |
| Indiana GIO | [PLSS reference layer](https://gisdata.in.gov/server/rest/services/Hosted/PLSS_Indiana_State_Boundary/FeatureServer) | Public Land Survey System reference geometry |
| Indiana DNR | [Division of Water](https://www.in.gov/dnr/water/) | Floodplain information, review, and state guidance |
| Indiana DNR | [Floodplain Information Portal (INFIP)](https://infip.dnr.in.gov/) | Effective and best-available floodplain research |
| Indiana DNR / GIO | [Best Available Flood Hazard Layer](https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer) | State flood-hazard planning layer, distinct from FEMA effective data |
| USACE | [National Levee Database](https://levees.sec.usace.army.mil/) | Levee inventory and levee-system context |
| USACE | [National Structure Inventory](https://nsi.sec.usace.army.mil/) | Structure inventory and consequences-analysis context |
| USACE | [Indiana Regulatory Program](https://www.lrd.usace.army.mil/Missions/Regulatory/Indiana/) | Federal regulatory reference and agency routing |
| U.S. Census Bureau | [TIGERweb GIS services](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb) | Counties, places, and statistical geography |
| FHWA / USDOT | [National Bridge Inventory](https://www.fhwa.dot.gov/bridge/nbi.cfm) | Bridge inventory reference |
| Illinois DNR | [Office of Water Resources](https://dnr.illinois.gov/waterresources.html) | Illinois floodway and water-resource context |
| Kentucky legislature | [401 KAR 4:060](https://apps.legislature.ky.gov/law/kar/titles/401/004/060/) | Kentucky regulatory reference |

### Terrain, geodesy, hydrography, and surveying

| Agency | Government source / official link | Role in TSM |
|---|---|---|
| USGS | [3D Elevation Program (3DEP)](https://www.usgs.gov/3d-elevation-program) | National terrain, elevation, and LiDAR products |
| USGS | [The National Map products API](https://tnmaccess.nationalmap.gov/api/v1/) | Elevation, maps, and orthoimagery product discovery |
| USGS | [3D Hydrography Program](https://www.usgs.gov/3d-hydrography-program) | Stream-network and hydrography references |
| Indiana / ISDP | [2016–2020 statewide elevation archive](https://gis.iu.edu/s/isdp/page/20162020elevation) | Indiana LiDAR and DEM acquisition documentation |
| Indiana GIO | [Indiana elevation resources](https://www.in.gov/gis/geoinsights/elevation/) | State elevation program and dataset provenance |
| NOAA / NGS | [GEOID18 technical details](https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml) | Ellipsoid-to-orthometric height relationship |
| NOAA / NGS | [NCAT coordinate transformation tool](https://www.ngs.noaa.gov/NCAT/) | Official coordinate and datum transformation reference |
| USGS | [USGS Publications Warehouse](https://pubs.usgs.gov/) | Scientific reports and methods documentation |

### Water, weather, rainfall, and hydraulic science

| Agency | Government source / official link | Role in TSM |
|---|---|---|
| USGS | [Water Data OGC API](https://api.waterdata.usgs.gov/ogcapi/v1/) | Streamgage stage, discharge, and station observations |
| USGS | [Water Data for the Nation](https://waterdata.usgs.gov/) | Source observations and station metadata |
| NOAA / NWS | [National Water Prediction Service](https://water.noaa.gov/) | River forecast and threshold information |
| NOAA / NWS | [NWPS API](https://api.water.noaa.gov/nwps/v1/) | Gauge observations, forecasts, and metadata |
| NOAA / NWS | [Weather API](https://api.weather.gov/) | Alerts, forecast data, and grid information |
| NOAA / NWS | [CloudGIS web services](https://www.weather.gov/gis/cloudgiswebservices) | Official GIS weather, warnings, and radar overlays |
| NOAA / NCEP | [OpenGeo service directory](https://opengeo.ncep.noaa.gov/geoserver/www/index.html) | GIS service catalogs and radar products |
| NOAA / NWS | [Precipitation Frequency Data Server](https://hdsc.nws.noaa.gov/pfds/) | Design-storm precipitation frequency references |
| USACE HEC | [HEC-RAS](https://www.hec.usace.army.mil/software/hec-ras/) | Hydraulic-model methodology and external solver interface |
| EPA | [Storm Water Management Model (SWMM)](https://www.epa.gov/water-research/storm-water-management-model-swmm) | Urban stormwater and drainage modeling reference |

### Agriculture, ecology, climate, and environmental context

| Agency | Government source / official link | Role in TSM |
|---|---|---|
| USDA NRCS | [Web Soil Survey](https://websoilsurvey.nrcs.usda.gov/) | Soil map units, drainage and soil properties |
| USDA NRCS | [Soil Data Access / SSURGO](https://sdmdataaccess.sc.egov.usda.gov/) | Soil database access and quantitative attributes |
| USDA NASS | [Cropland Data Layer](https://www.nass.usda.gov/Research_and_Science/Cropland/) | Agricultural land-cover classifications |
| USFWS | [National Wetlands Inventory](https://www.fws.gov/program/national-wetlands-inventory/wetlands-data) | Wetlands mapping and ecological context |
| EPA | [WATERS / water data](https://www.epa.gov/waterdata) | Watershed and water-quality program information |
| EPA | [ECHO](https://echo.epa.gov/) | Environmental facility and compliance-reporting context |
| NASA | [POWER agroclimatology](https://power.larc.nasa.gov/) | Solar and meteorological observations/products for agricultural analysis |
| NASA | [LANCE near-real-time Earth observation](https://www.earthdata.nasa.gov/data/projects/lance) | Satellite product discovery and environmental context |

### Government funding and program research

| Source | Official link | Purpose |
|---|---|---|
| U.S. government | [Grants.gov](https://www.grants.gov/) | Federal grant opportunity discovery |
| U.S. government | [Simpler.Grants.gov](https://simpler.grants.gov/search) | Public federal funding search |
| U.S. government | [SAM.gov](https://sam.gov/) | Assistance listings and federal registrations |
| FEMA | [Hazard Mitigation Assistance](https://www.fema.gov/grants/mitigation) | Hazard-mitigation program references |
| USDA NRCS | [Conservation programs](https://www.nrcs.usda.gov/programs-initiatives) | Land, soil, and conservation program references |

More detailed authority classifications, dataset vintages, restrictions, and endpoint records are maintained in the [Government Source Registry](packages/government/src/index.ts), [Native Source Catalog](tsm-native/config/authoritative-source-catalog.json), and [Authoritative Data Source Catalog](docs/DATA-SOURCE-CATALOG.md).

## 5. Data integrity and peer-review approach

A technical result is useful only if another person can understand **where it came from** and **how it was produced**.

TSM's [Engineering Assurance Standard](docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md) distinguishes four evidence classes:

| Evidence class | Meaning | Example |
|---|---|---|
| **Observed** | Published measurement from a named source with time and units | USGS river stage |
| **Derived** | Computation using identified inputs and a named method | Calculated runoff depth |
| **Scenario** | A modeled result under explicit assumptions | Flood depth for a specified design event |
| **Regulatory** | A decision or document issued by the authorized body | Effective FEMA map or issued agency determination |

Relevant outputs can retain the issuing agency, source URL, observation/acquisition time, coordinate reference system, vertical datum, units, software/method version, input parameters, and SHA-256 digests.

The engineering design separates **source evidence** from **derived calculations** and **visual presentation**. This allows a cinematic scene to explain engineering data without changing the authoritative source record.

### Example: independently checked Posey source files

The building-inventory reconciliation compares original source IDs and exact polygon coordinate arrays. Its result and file hashes can be reviewed independently of any rendered 3D building. The DEM source gate also checks the acquired TIFF bytes against their SHA-256 receipts and reports the embedded horizontal reference system separately from vertical-elevation claims.

- [Building reconciliation code](scripts/geospatial/reconcile_posey_building_inventories.py)
- [DEM evidence gate](scripts/geospatial/verify_posey_dem_gate.py)
- [Posey source-verification report](docs/engineering-development/POSEY-DRIVE-SOURCE-VERIFICATION-2026-11-09.md)
- [Official DEM reference crosswalk](docs/engineering-development/POSEY-DEM-AUTHORITY-CROSSWALK-2026-11-09.md)
- [Scientific validation methods](docs/engineering/SCIENTIFIC_VALIDATION.md)

## 6. Software architecture

~~~text
OFFICIAL GOVERNMENT DATA & DOCUMENTS
                  |
          Acquisition / catalogs
                  |
      Source IDs + date + CRS + units
                  |
       Integrity / provenance checks
                  |
     Scientific and engineering modules
     |         |          |         |
   Survey   Hydrology  Hydraulics  Geotech
     |         |          |         |
             Evidence records
                  |
      Maps / 3D scenes / reports
                  |
           Human interpretation
~~~

| Layer | Technologies and repository paths |
|---|---|
| Public mapping console | [React, TypeScript and Vite](tsm-console/) |
| Mapping and 3D rendering | MapLibre, Three.js, [3D building/tiles tooling](scripts/geospatial/) |
| Native 3D engineering source | [Unreal Engine 5.8 application and plugins](tsm-native/) |
| Scientific computing | [Python engineering backend](backend/), [engineering fabric](integrations/engineering-fabric/), TypeScript hydrology/hydraulics |
| Survey and geodetic calculations | [Survey preprocessing](tools/survey/), [geodesy package](packages/geo/) |
| Government adapters | [Government source package](packages/government/), [official-source catalog](docs/DATA-SOURCE-CATALOG.md) |
| Spatial information | GeoJSON, GeoTIFF, LiDAR, PostGIS, SQLite/SpatiaLite, PMTiles, GLB and 3D Tiles paths |
| Evidence and reproducibility | JSON/JSON Schema contracts, SHA-256 manifests, source snapshots, tests and review metadata |

The software uses **source-bound input parameters** rather than treating an attractive rendering or computed number as proof of a regulatory outcome.

## 7. Get started and reproduce calculations

**Requirements for the web console:** Git, Node.js **22+**, and npm. Domain-specific Python tasks have their own dependencies.

~~~bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager/tsm-console

npm ci
npm run dev
~~~

Open the local address printed by Vite.

For code-quality and reproducibility checks:

~~~bash
cd tsm-console
npm run check:type
npm run build

# From the repository root, with pytest/rasterio/numpy installed:
cd ..
python -m pytest -q \
  scripts/geospatial/test_reconcile_posey_building_inventories.py \
  scripts/geospatial/test_verify_posey_dem_gate.py
~~~

For LandXML, COGO, least-squares adjustment and leveling:

~~~bash
python -m pip install -r tools/survey/requirements.txt
python -m unittest discover -s tests/survey -v
~~~

Review the [survey tool guide](tools/survey/README.md), [engineering assurance standard](docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md), [repository testing workflows](.github/workflows/), and [contribution guidelines](CONTRIBUTING.md) for method-specific instructions.

## Optional community sponsorship

Tri-State Systems Manager is **free and open-source**. Public access to the console, scientific information and source code does **not** require a donation, sponsorship, subscription or GitHub account.

If you would like to help cover project maintenance, data processing and reproducible native build infrastructure, you can [sponsor ATphobia22 on GitHub](https://github.com/sponsors/ATphobia22). Sponsoring is entirely voluntary; it does not confer privileged data access, regulatory authority, or influence over scientific findings.

## 8. Public-interest use and contributions

TSM is built around **free public access to information, traceable sources, accessible explanations, transparent science, and responsible human review**. Community members can contribute map corrections, reproducible tests, better documentation, scientific methods, accessibility improvements, and official-source references.

[Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [License](LICENSE) · [GitHub issues](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues)

**License:** Apache-2.0 for repository code, subject to third-party component and dataset terms.

**Scientific and regulatory use:** TSM is an information, research, and engineering decision-support system. Source data, calculations, simulations, and visualizations must be evaluated in their stated domain; they do not themselves replace a licensed survey, a sealed engineering deliverable, an official flood warning, or an authorized agency decision.

---

**In memory of Beverly Ann Tucker.**
