# Point Township government agency evidence gap review — 2026-10-26

**Status:** informational source audit; no new regulatory, survey, 3D-building or height acceptance.

## Uploaded historical evidence (do not publish originals)
- 2018 NFIP correspondence: historical pre-FIRM/Zone AE insurance reference only. Contains private names, residential address and policy details; none may enter public Git history. Premium advice predates current rating methodology; not a present-day flood determination or elevation certificate.
- Point Township plat atlas pages 34–36: historical PLSS, landownership, roads, state boundaries and river context; not current parcel boundaries, current ownership or roof geometry.
- USACE Indiana district map dated July 29, 2009: historical Louisville/Detroit/Chicago coverage. The **current USACE Indiana regulatory page**, updated July 10, 2026, governs permit-routing research: https://www.lrd.usace.army.mil/Missions/Regulatory/Indiana/ .
- USACE 2018 Indiana navigation quick facts: historical river-port statistics, not current throughput.
- FEMA uploaded numerical model guidance is **December 2020**. FEMA published a **November 2021** revision of Guidance 98: https://www.fema.gov/sites/default/files/documents/fema_accepting-numerical-models-guidance_112021.pdf .
- Uploaded Upper Mississippi navigation Biological Opinion: programmatic historical ecological reference for its specified action area, not a Posey County site-specific Section 7 finding.

## Official source inventory crosswalk

| Agency/product | Official URL | TSM action and authority boundary |
|---|---|---|
| IGIO building footprints 2016–2020 | https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0 | Existing building source; objectid/lidaryear/county; polygon layer does **not** supply accepted roof heights |
| IGIO 2020 elevation archive | https://registry.opendata.aws/in-elevation/ | Existing COPC, LAS, DEM, DSM, nDHM discovery; nDHM candidate is not automatically an accepted LiDAR roof |
| FEMA NFHL | https://www.fema.gov/flood-maps/national-flood-hazard-layer | Existing effective-map reference; check current panel, effective date and map changes |
| Indiana DNR INFIP | https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal | Existing FARA/BFE and best-available floodplain discovery; DNR best available is **not** an NFIP flood-insurance map |
| USACE Indiana Regulatory | https://www.lrd.usace.army.mil/Missions/Regulatory/Indiana/ | Use live district/permit routing, not 2009 paper map |
| USACE WCSC navigation | https://www.iwr.usace.army.mil/About/Technical-Centers/WCSC-Waterborne-Commerce-Statistics-Center/WCSC-Navigation-Infrastructure/ | New discovery: port/navigation context only |
| USFWS NWI | https://www.fws.gov/program/national-wetlands-inventory/wetlands-data | New discovery: wetlands context, **not** jurisdictional delineation |
| USFWS NWI REST | https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest | Official documented service; snapshot vintage, coverage and geometry QA needed |
| USFWS IPaC | https://ipac.ecosphere.fws.gov/ | New project-screening reference; never automatically claim ESA consultation |
| USDA NRCS SSURGO | https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo | Existing soil discovery; Posey data vintage and polygon acquisition unverified |
| USDA Soil Data Access | https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx | New API discovery; no acquired Posey snapshot yet |
| NOAA NGS datasheets | https://www.ngs.noaa.gov/datasheets/ | Survey-control reference; not automatic site NAVD88 validation |
| NOAA NCAT | https://www.ngs.noaa.gov/web_services/ncat/index.shtml | Datum transformations require frame, epoch, grids, units and residual QA |
| USGS 3DHP | https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products | Existing hydrography discovery; no site-specific approval |

## 3D release separation
The most recent recorded production attempt covered **23,082 IGIO footprint identities**, with **11,821 OBSERVED**, **8,696 DERIVED** and **2,565 lacking accepted height evidence**; 29 DEM sampling gaps remained. Counts are from a prior build, **not** a new accepted run. Twelve invalid polygons were found in a separate uploaded candidate and must not be silently auto-repaired. The public partial 3D preview may continue with an explicit incomplete-evidence warning. Issue #416 tracks full source-ID, topology, LiDAR height, ground elevation, GLB and 3D Tiles acceptance.

**Privacy:** Never commit the user's raw letters, atlas scans, source images, policyholder identity, address, insurance number, or private local review receipts. Source catalogs and links are **not proof of downloaded, hashed or validated datasets**.
