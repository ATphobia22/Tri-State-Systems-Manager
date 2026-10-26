# TSM government agency and uploaded evidence audit — 26 October 2026

Scope: Posey County, Indiana / Point Township; Wabash–Ohio confluence; adjoining Illinois and Kentucky. Status: **informational evidence inventory only**. No survey, flood insurance decision, building acceptance or regulatory ruling is made here.

## Evidence-classification results from user-provided material

| Input family | Finding | Release-safe use |
|---|---|---|
| FEMA NFIP correspondence (2018) | Historical letter identifying pre-FIRM/Zone AE and advising about elevation certificates under 2018 pricing regulations. | PRIVATE historical reference. Do not upload original scan or policyholder/policy/address information. Cannot infer today's NFIP rate, effective hazard or eligibility. |
| Point Township plat atlas quadrants, printed pages 34–36 | Historic PLSS, road, river and township quadrant context; private landowner names on maps. | Source-category-only record; do not ingest owner labels or scanned pages into public app. Not a modern property survey or building roof map. |
| USACE Indiana district map (2009) | Historical map delineating Louisville, Detroit, Chicago district areas. | Historical reference; current USACE 2026 regulatory site overrides map for permit routing. |
| USACE WCSC Indiana navigation facts (2018) | Historic 2018 statewide port statistics; Mount Vernon listed as a river port. | Research-only economic/navigation context. Not real-time navigation data or building LiDAR. |
| FEMA Guidance 98 (December 2020) | NFIP requirements on accepted numerical models and independent GIS pre/postprocessors. | Archived technical guidance; official November 2021 update verified. Check accepted model list and version at submission; no TSM auto-approval. |
| USFWS Upper Mississippi 9-foot navigation Biological Opinion (May 2000) | Programmatic Tier I consultation addressing the Upper Mississippi navigation project, with some Indiana bat species discussion. | Historical ecological reference for its defined action area; **not** a site-specific Point Township/Ohio-Wabash Section 7 determination. |
| Uploaded TSM government/mapping inventory (snapshot 25 October 2026) | 32 documented source groups; several integrated, others referenced, configured, rejected. | Cross-reference source *names* and official public URLs only; not a substitute for live API/vintage checks. |

## Source inventory gap findings, distinguishing catalog from ingestion

1. **USFWS National Wetlands Inventory** and REST/WMS services should be added as a discovery-only wetlands layer. NWI geographic indicators **do not determine federal jurisdiction** or whether a project needs a permit.
2. **USFWS IPaC** is relevant for prospective ESA consultation screening, but project-specific IPaC records and Section 7 consultation remain human/regulatory workflows. A 2000 programmatic opinion for the Upper Mississippi system does not substitute for a modern Posey consultation.
3. **USDA NRCS SSURGO Soil Data Access (SDA)** official WFS/REST offers soil map-unit and soil-property context. Repository already names USDA soil discovery; actual Posey extract, data vintage, and source hash are still unverified.
4. **USACE WCSC navigation infrastructure/ports and waterborne commerce** should be cataloged for river/port economic context. The uploaded state facts are 2018 vintage, not current volumes.
5. **NOAA NGS datasheets + NCAT** should be registered to support datum and survey-control review. A vertical geoid model or transformation cannot be silently inferred from historic plat/survey scans.
6. **FEMA November 2021 Numerical Models Guidance 98** supersedes this uploaded December 2020 guidance edition. FEMA Risk Rating 2.0 has changed premium methodology since the 2018 letter; an Elevation Certificate can still provide information and may affect rating, but historical advice must not be projected unchanged into 2026.
7. **USACE Louisville Regulatory Program** current Indiana jurisdiction and official permit systems should be source-of-record for regulatory routing, while 2009 boundaries remain archived only.
8. **USGS 3DHP** is already present in TSM discovery; current 3DHP/legacy NHD availability must be tested for Posey, not inferred from national coverage.

## Source-of-truth URLs verified or examined on 26 October 2026

- IGIO elevation: https://www.in.gov/gis/geoinsights/elevation/ ; https://registry.opendata.aws/in-elevation/
- FEMA numerical model updated guidance: https://www.fema.gov/sites/default/files/documents/fema_accepting-numerical-models-guidance_112021.pdf
- FEMA Risk Rating 2.0 facts: https://www.fema.gov/sites/default/files/documents/fema_rr-2.0_2025.pdf
- USACE LRD current Indiana regulatory program: https://www.lrd.usace.army.mil/Missions/Regulatory/Indiana/
- USACE WCSC navigation infrastructure: https://www.iwr.usace.army.mil/About/Technical-Centers/WCSC-Waterborne-Commerce-Statistics-Center/WCSC-Navigation-Infrastructure/
- USACE WCSC statistics: https://ndc.ops.usace.army.mil/wcsc/webpub/
- USFWS NWI data and services: https://www.fws.gov/program/national-wetlands-inventory/wetlands-data ; https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services
- USDA NRCS SSURGO/SDA: https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo ; https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx
- NOAA NGS control and transformations: https://www.ngs.noaa.gov/datasheets/ ; https://www.ngs.noaa.gov/web_services/ncat/index.shtml
- USGS 3DHP access: https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products

## Countywide 3D acceptance remains independent

The 2026-10-26 COPC build demonstrated 23,082 footprint IDs, 11,821 OBSERVED plus 8,696 DERIVED heights, 2,565 unavailable, and 29 unfilled DEM sample cases. Historical Point Township paper maps cannot fill LiDAR gaps. nDHM, official 2020 DEM, and alternative LAS are *candidate review data*, not newly accepted roof records. The new `audit_igio_ndhm_gap_candidates.py` checks pixels strictly inside verified geometry and emits a **private** coordinate-free review receipt, never production acceptance. The full authoritative building GLB/3D Tiles mesh chain remains required. Issue #416 remains open.

## Privacy and governance rule

Never commit the original scanned policy letter, private names, personal address, policy number, historical landowner labels, or raw images to public repositories. Keep only de-identified document type/date, original acquisition metadata, and official public reference URLs in public source ledgers. Reviewer-controlled private evidence must be outside Git history.