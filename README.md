# Tri-State Systems Manager (TSM)

**An evidence-first geospatial and engineering decision-support platform for the Ohio–Wabash tri-state region: Indiana, Illinois, and Kentucky.**

TSM brings maps, public geospatial data, weather and water observations, flood-hazard references, infrastructure context, and engineering workflows into one reviewable workspace. The goal is to make it easier to understand **where data came from, what it means, how current it is, and what has—or has not—been verified**.

> **Plain-language promise:** TSM helps people investigate and organize evidence. It does not turn an unverified map layer into a survey, a model into a regulatory decision, or a weather image into a flood prediction.

## Start here

- **Public web console:** https://atphobia22.github.io/Tri-State-Systems-Manager/
- **3D terrain viewer:** https://atphobia22.github.io/Tri-State-Systems-Manager/terrain-3d/
- **Twin Canvas:** https://atphobia22.github.io/Tri-State-Systems-Manager/twin/
- **Platform overview:** https://atphobia22.github.io/Tri-State-Systems-Manager/platform/
- **Source catalog:** [docs/DATA-SOURCE-CATALOG.md](docs/DATA-SOURCE-CATALOG.md)
- **Release status and open blockers:** [docs/release/RELEASE-GATES-2026-10-15.md](docs/release/RELEASE-GATES-2026-10-15.md)
- **Hydrology release contract:** [docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md](docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md)
- **Regional AOI/source validation:** [docs/hydrology/regional-aoi-source-validation.md](docs/hydrology/regional-aoi-source-validation.md)
- **Hydrology pipeline runbook:** [docs/hydrology/pipeline-operator-runbook.md](docs/hydrology/pipeline-operator-runbook.md)

Production URLs depend on a successful deployment. A page loading successfully does not prove that every external service, layer, API, or engineering workflow is live.

## What TSM does

| Area | What it helps with | Important limitation |
|---|---|---|
| Interactive mapping | Explore geography, imagery, boundaries, roads, buildings, and selected public-data layers | A displayed feature may be generalized, stale, incomplete, or unsuitable for survey/design use |
| 3D terrain context | View terrain, hillshade, and available derived 3D assets | Visualization assets are not automatically engineering-grade elevation or bathymetry |
| Weather and water context | Review selected National Weather Service / NOAA products and USGS water observations | Observations, forecasts, radar reflectivity, rainfall estimates, and flood models are different data types |
| Flood-hazard context | Compare FEMA effective mapping and applicable state floodplain references | TSM does not issue official flood-zone, Base Flood Elevation (BFE), floodway, Letter of Map Change, or permit determinations |
| Hydrology screening | Validate hydrograph structure and run documented screening calculations | A valid file or formula does not establish that inputs are representative or a result is suitable for design |
| Engineering workflow controls | Track input sources, timestamps, coordinate systems, vertical datums, hashes, assumptions, and review gates | A gate or schema check is not independent scientific validation or professional approval |
| Desktop/offline work | Package selected application capabilities and dated data snapshots where supported | A snapshot is not live data; availability depends on the relevant build and acquisition artifacts |

## How to interpret data in TSM

TSM intentionally keeps these categories separate:

- **Observed:** measured by a source agency or sensor, with its timestamp, units, quality flags, and reference system.
- **Forecast:** a source's forecast for a stated valid time—not an observation.
- **Derived:** calculated or transformed by TSM or another workflow, with method and input provenance.
- **Modelled / scenario:** produced by a model or what-if scenario; not automatically an observation or regulatory result.
- **Regulatory reference:** an official agency product used for its stated regulatory purpose, such as FEMA effective flood mapping.
- **Candidate / unverified:** discovered or proposed, but not yet qualified for the intended use.

A source being listed in this README or in a registry means it is a documented source or candidate. It **does not** mean every dataset has been downloaded, every endpoint is currently healthy, every location is covered, or every source is approved as a model input.

## Current engineering status

**As of 2026-10-15, TSM is an active software project with open scientific, runtime, and deployment release gates.** Check the linked release-gate register and GitHub Actions for current evidence; do not infer a green build or successful deployment from this README.

### Hydrology and hydraulic modeling

The repository contains hydrology screening code, source manifests, provenance contracts, validation tests, and a fail-closed preflight pipeline. The pipeline does **not** currently authorize or claim a completed HEC-RAS run.

The ERDC/CHL TR-22-4 reference describes a regional Wabash–Ohio confluence study using Adaptive Hydraulics (AdH). It is useful engineering context, **not** a drop-in HEC-RAS project or a local residential catchment. The four-gauge arithmetic described by the report is implemented as a review-only utility; it does not fetch or authenticate observations, apply travel-time corrections, or authorize execution.

Before a production hydraulic conclusion can be released, the applicable project needs:

1. A named, bounded, human-approved area of interest (AOI) and a verified receiving outlet.
2. A delineated watershed/catchment that is distinct from the parcel, building footprint, and hydraulic model domain.
3. Qualified source data with product dates, exact identifiers, coverage, terms, hashes where retained, units, coordinate reference system (CRS), and vertical datum.
4. Verified terrain and, where needed, bathymetry/topobathymetry and structure information.
5. Appropriate rainfall/discharge forcing, model geometry, roughness, boundary conditions, mesh/cross-sections, and solver/version evidence.
6. Reproducible model outputs, diagnostics, mass-balance and stability checks, calibration/independent validation, uncertainty analysis, and qualified review.
7. Explicit approval tied to the exact input/configuration artifacts before execution or publication.

**No property-level flood depth, BFE, no-rise, design-flow, permit, or life-safety conclusion should be inferred from a visualization or an unvalidated model.**

### Current hydrology references

- [Hydrology and hydraulics release contract](docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md)
- [USACE HEC software integration plan](docs/hydrology/USACE-HEC-SOFTWARE-INTEGRATION.md)
- [Regional AOI source validation notes](docs/hydrology/regional-aoi-source-validation.md)
- [Hydrology pipeline operator runbook](docs/hydrology/pipeline-operator-runbook.md)
- [Source registry (configuration only; unverified unless separately qualified)](config/hydrology/source-registry.yaml)

### Software and delivery

- **Web console:** React, TypeScript, Vite, MapLibre-based mapping.
- **Repository/automation:** GitHub, GitHub Actions, schema and regression checks.
- **Desktop:** Tauri packaging is part of the project; see [Windows offline desktop instructions](docs/WINDOWS-11-OFFLINE-DESKTOP.md) and [multi-installer matrix](docs/MULTI-INSTALLER-MATRIX.md).
- **Unreal Engine:** optional native visualization scaffold; do not assume a packaged, release-ready Unreal application exists.
- **Offline data:** source-specific dated snapshots and manifests are used where acquisition workflows support them. Snapshot vintage and retrieval time are tracked separately.

The exact current build and deployment state is reported by GitHub Actions and the release-gate register, not by capability claims alone.

## Official government sources used or referenced

This is the project-level inventory of **official government source families and entry points referenced in TSM code, data manifests, source catalogs, or engineering documentation**. It is intentionally broader than “live and verified.” Each source's status depends on the specific dataset, endpoint, date, location, license/terms, and intended use. See the [detailed source catalog](docs/DATA-SOURCE-CATALOG.md) for dataset-level details.

### Federal — elevation, terrain, hydrography, and water observations

| Agency / source | Official link | TSM use or documented role |
|---|---|---|
| U.S. Geological Survey (USGS) — The National Map / TNM Access | [National Map download tools](https://www.usgs.gov/tools/download-data-maps-national-map) · [TNM Access](https://tnmaccess.nationalmap.gov/) | Discover/download topographic, elevation, hydrography, boundaries, roads, structures, and related mapping products |
| USGS — 3D Elevation Program (3DEP) | [3DEP](https://www.usgs.gov/3d-elevation-program) · [Lidar Explorer](https://www.usgs.gov/tools/lidarexplorer) | DEM, LiDAR, terrain and elevation-product discovery; each tile still requires product-level quality and datum checks |
| USGS — 3D Hydrography Program (3DHP) | [3DHP](https://www.usgs.gov/3dhp) · [Access 3DHP products](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products) | Current hydrography-product discovery and service access; coverage and release metadata must be checked |
| USGS — legacy NHD / Watershed Boundary Dataset (WBD) | [National Hydrography products](https://www.usgs.gov/national-hydrography/about-national-hydrography-products) · [WBD](https://www.usgs.gov/national-hydrography/watershed-boundary-dataset) | Legacy/reference hydrography and watershed context; USGS has transitioned toward 3DHP, so legacy products must not be mislabeled as newly maintained |
| USGS — Water Data APIs | [Water Data APIs](https://api.waterdata.usgs.gov/) · [API documentation](https://api.waterdata.usgs.gov/docs/) | Monitoring-location metadata, streamflow, gage height, and other water observations; verify site, parameter, timestamp, quality, units, and datum |
| USGS — StreamStats | [StreamStats](https://streamstats.usgs.gov/ss/) | Potential watershed delineation and streamflow-estimate cross-check where supported; not assumed to be integrated or applicable to every AOI |
| USGS — Elevation Point Query Service (EPQS) | [EPQS](https://epqs.nationalmap.gov/v1/docs) | Point-elevation lookup/reference; not a substitute for a site DEM, terrain QA, or survey |

### Federal — weather, precipitation, flood hazards, and engineering

| Agency / source | Official link | TSM use or documented role |
|---|---|---|
| National Oceanic and Atmospheric Administration (NOAA) / National Weather Service (NWS) — CloudGIS | [NWS CloudGIS web services](https://www.weather.gov/gis/cloudgiswebservices) | Official OGC WMS/WFS/WCS service directory; capabilities checks do not alone prove deployed image rendering |
| NOAA/NWS — radar viewer documentation | [NWS radar FAQ](https://www.weather.gov/radarfaq) · [NWS radar](https://radar.weather.gov/) | Radar product context; reflectivity is not rainfall accumulation or modeled flood depth |
| NOAA/NWS — NCEP OpenGeo services | [OpenGeo service directory](https://opengeo.ncep.noaa.gov/geoserver/www/index.html) | Published WMS/WFS service and layer discovery, including selected warning and radar products |
| NOAA/NWS — Multi-Radar Multi-Sensor (MRMS) | [MRMS data tutorial](https://www.weather.gov/gis/mrms_data_quick_tutorial) · [MRMS QPE service](https://mapservices.weather.noaa.gov/raster/rest/services/obs/mrms_qpe/ImageServer) | Radar/precipitation context; accumulation windows, product semantics, coverage and nodata must be validated before any model use |
| NOAA — Atlas 14 precipitation frequency | [Precipitation Frequency Data Server](https://hdsc.nws.noaa.gov/pfds/) | Design precipitation-frequency reference; no design storm is selected merely because the source is listed |
| NOAA/NWS — National Water Prediction Service (NWPS) | [NWPS](https://water.noaa.gov/) | Water forecasts and related products where integrated; forecast and observation records remain distinct |
| Federal Emergency Management Agency (FEMA) — National Flood Hazard Layer (NFHL) | [NFHL](https://www.fema.gov/flood-maps/national-flood-hazard-layer) · [Flood Map Service Center](https://msc.fema.gov/portal/home) | Effective flood-hazard and FIRM reference products; map dates, panel, BFE/datum, map changes and site intersections must be verified |
| FEMA — Community Status Book | [Indiana community status](https://www.fema.gov/cis/IN.pdf) | Community/NFIP reference, not a parcel-specific flood determination |
| U.S. Army Corps of Engineers (USACE) — Hydrologic Engineering Center (HEC) | [HEC-RAS](https://www.hec.usace.army.mil/software/hec-ras/) · [HEC-RAS documentation](https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx) | Hydraulic modeling software and documentation; exact installed version, project compatibility, execution path, and outputs require separate verification |
| USACE — HEC-HMS | [HEC-HMS](https://www.hec.usace.army.mil/software/hec-hms/) · [documentation](https://www.hec.usace.army.mil/software/hec-hms/documentation.aspx) | Candidate rainfall-runoff / watershed modeling workflow; a completed validated run is not implied |
| USACE — HEC-SSP | [HEC-SSP](https://www.hec.usace.army.mil/software/hec-ssp/) | Candidate hydrologic statistical-analysis workflow |
| USACE — HEC-FIA | [HEC-FIA](https://www.hec.usace.army.mil/software/hec-fia/) | Candidate flood-impact/consequence analysis workflow |
| USACE — National Levee Database (NLD) | [NLD](https://levees.sec.usace.army.mil/) · [data services](https://levees.sec.usace.army.mil/data-services/services/) | Levee inventory/context; per-record dates, status and assessment limitations matter |
| USACE — National Inventory of Dams (NID) | [NID](https://nid.sec.usace.army.mil/) | Dam inventory and coordinates for situational context; not a dam-safety determination |
| USACE Engineer Research and Development Center (ERDC), Coastal and Hydraulics Laboratory | [ERDC library report record](https://erdc-library.erdc.dren.mil/handle/11681/43441) | ERDC/CHL TR-22-4, regional Wabash–Ohio confluence AdH study; reference-only, not a local model or HEC-RAS project |
| U.S. Department of Agriculture (USDA), Natural Resources Conservation Service (NRCS) — SSURGO | [Soil Survey Geographic Database](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-ssurgo-database) · [Web Soil Survey](https://websoilsurvey.nrcs.usda.gov/) | Soil context for watershed/runoff assumptions; data does not automatically establish a validated hydrologic soil group at a site |
| USDA NRCS — TR-55 | [Urban Hydrology for Small Watersheds](https://www.nrcs.usda.gov/resources/guides-and-instructions/urban-hydrology-for-small-watersheds-tr-55) | Method reference for applicable screening/design workflows; applicability and assumptions require review |
| U.S. Census Bureau — TIGER/Line | [TIGER/Line files](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html) | Administrative boundary and road context; cartographic boundaries are not legal surveys |

### State and regional government sources

| State / agency | Official link | TSM use or documented role |
|---|---|---|
| Indiana Department of Natural Resources (IDNR) — Floodplain Information Portal (INFIP) | [INFIP information](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/) · [Portal](https://infip.dnr.in.gov/) | Indiana floodplain references and Floodplain Analysis and Regulatory Assessment (FARA) workflow; verify applicability and current site-specific results |
| Indiana DNR — Best Available Floodplain Mapping (BAFM/BAFL) | [Best Available Floodplain Mapping](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/) | State planning/reference mapping, distinct from FEMA effective mapping |
| Indiana DNR — Hydrology and hydraulics resources | [H&H links and model resources](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links) · [general assessment guidance](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/general-guidelines-for-the-hydrologic-hydraulic-assessment/) | Existing-study discovery and state guidance; applicability must be determined for the actual project |
| Indiana DNR — Online Research Center | [DoWORC](https://www.in.gov/dnr/water/online-research-center/) | Discovery of records such as permits, dams, drainage and models; individual records must be retrieved and qualified |
| Indiana Geographic Information Office (IGIO/GIO) | [Indiana GIS data portal](https://gisdata.in.gov/) · [Indiana elevation portal](https://elevation.gio.in.gov/) | Statewide parcels, addresses, roads, imagery, boundaries, and elevation-product discovery; layer and vintage must be pinned |
| Indiana — Changes Since Last FIRM (CSLF) | [Indiana GIO data portal](https://gisdata.in.gov/) | Pending/preliminary map-change context; not interchangeable with effective FEMA mapping |
| Illinois State Water Survey / University of Illinois public water and geospatial resources | [Illinois State Water Survey](https://www.isws.illinois.edu/) | Illinois elevation/water-data source discovery; the homepage is not evidence of AOI-specific coverage |
| Illinois state geospatial resources | [Illinois Geospatial Data Clearinghouse](https://clearinghouse.isgs.illinois.edu/) | State GIS and geology/elevation data discovery; validate specific dataset, vintage, and service |
| Kentucky Division of Geographic Information / KyFromAbove | [KyFromAbove](https://kyfromabove.ky.gov/) · [Kentucky GeoNet](https://kygeonet.ky.gov/) | Kentucky elevation, LiDAR, imagery and geospatial source discovery; individual tiles and datum metadata still require checks |
| Kentucky Energy and Environment Cabinet — Division of Water | [Water and flood/drought resources](https://eec.ky.gov/Environmental-Protection/Water/FloodDrought/Pages/default.aspx) | Kentucky water and floodplain source discovery; jurisdiction-specific applicability must be checked |
| Indiana / Illinois / Kentucky local and regional authorities | Source records linked from the [data source catalog](docs/DATA-SOURCE-CATALOG.md) and manifests | Local parcels, drainage, roads, culverts, flood studies, structures and planning records when explicitly identified in a source manifest |

### How to read this source inventory

- **Official source listed** means TSM documents or references that agency or source family. It is not proof that every service is currently integrated or healthy.
- **Catalog/capabilities checked** means a directory, metadata response, or service capabilities record was examined. It does not prove successful runtime rendering or AOI coverage.
- **Downloaded / hashed** must be established by a specific acquisition receipt or manifest. A URL in documentation is not a downloaded dataset.
- **Qualified for a model** requires the exact source artifact, appropriate coverage and vintage, units, CRS/datum, quality checks, transformations, and approval for the intended use.
- **Regulatory authority remains with the responsible agency.** TSM displays and organizes evidence; it does not confer regulatory status on derived layers.

The repository's [detailed data-source catalog](docs/DATA-SOURCE-CATALOG.md), [NOAA/NWS CloudGIS integration contract](docs/data-sources/NOAA-CLOUDGIS-INTEGRATION.md), [hydrology release contract](docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md), and [HEC integration plan](docs/hydrology/USACE-HEC-SOFTWARE-INTEGRATION.md) provide additional source-specific details and limitations.

## Quick start (web console)

Requirements: a supported Node.js version and npm. Use the version declared by the repository's package metadata or CI configuration.

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager
npm install
npm run dev --workspace=tsm-console
```

Open the local URL printed by the Vite development server. Some features require network access to public services. A successful local build does not imply that third-party APIs, a production backend, live data, or hydraulic-model execution are available.

For desktop packaging and offline use, see [Windows 11 offline desktop instructions](docs/WINDOWS-11-OFFLINE-DESKTOP.md) and the [multi-installer matrix](docs/MULTI-INSTALLER-MATRIX.md).

## Repository navigation

| Path | What it contains |
|---|---|
| `tsm-console/` | Web application, mapping UI, client-side source context and server-side integrations |
| `backend/` | Python engineering and data services where implemented |
| `tsm_runtime/` | Runtime validators and engineering workflow utilities |
| `config/` | Source registries and configuration contracts; registry entries may be unverified candidates |
| `data/` and `data-sources/` | Data manifests, schemas, source receipts, and selected committed datasets |
| `scripts/` | Acquisition, validation, geospatial processing, build and operational automation |
| `tests/` | Unit, contract, and integration tests |
| `docs/` | Architecture, source catalogs, operating instructions, research notes, and release gates |

## Engineering principles

1. **Evidence over appearance.** A convincing visualization is not proof that its source data or interpretation is correct.
2. **Fail closed.** Missing inputs, ambiguous datums, invalid schemas, failed services, or missing approval must block the affected conclusion.
3. **Keep authority classes separate.** Observations, forecasts, derived products, scenarios, and regulatory references must remain distinguishable.
4. **Preserve provenance.** Record source URLs/IDs, product and observation times, versions, CRS, vertical datum, units, quality flags, transformations, and hashes where applicable.
5. **Do not invent missing values.** Nulls and explicit unknown states are safer than guessed elevations, BFEs, flow rates, coordinates, or model outputs.
6. **Human review is mandatory for consequential decisions.** Qualified surveyors, engineers, and responsible agencies retain their proper authority.
7. **Security and privacy by design.** Keep credentials out of Git, limit data collection to what is needed, and review access, retention, and licensing before storing external data.

## Contributing and release checks

Before proposing a change:

- Read the relevant contract and source-specific documentation.
- Add tests for expected behavior and fail-closed cases.
- Do not change an unverified source or model assumption into a “verified” status without retained evidence.
- Run the repository's applicable lint, type, unit, schema, build, and integration checks.
- Review [release gates](docs/release/RELEASE-GATES-2026-10-15.md) and report the exact commit and observed CI results.

A commit on `main` is not, by itself, proof that CI is green, Pages has deployed, live endpoints work, or engineering outputs are validated.

## License

TSM source code is licensed under [Apache-2.0](LICENSE), subject to the license file. Third-party data and services have their own terms, attribution requirements, update schedules, and restrictions; review the source-specific terms before redistributing snapshots or derived products.

## Safety and intended use

TSM is public-interest decision-support software. It is not an emergency alert service, licensed survey, engineering certification, legal opinion, flood insurance determination, permit decision, or substitute for the responsible agency or qualified professional. For an actual property or infrastructure decision, obtain the applicable official records and qualified site-specific review.
