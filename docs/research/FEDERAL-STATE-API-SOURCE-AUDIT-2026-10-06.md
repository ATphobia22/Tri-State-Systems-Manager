# Federal / State API Source Audit — 2026-10-06

## Purpose

This audit evaluates the requested FEMA, USACE, Indiana DNR, IndianaMap, and Indiana government API sources for incorporation into Tri-State Systems Manager (TSM). It follows the TSM source chain:

`source → acquisition → source validation → provenance → SHA-256 → artifact validation → publication → integrity verification → runtime`

No source is promoted to an engineering or regulatory authority merely because TSM can ingest it.

## Retrieval status

| Source | Authority | Current evidence | TSM disposition |
|---|---|---|---|
| FEMA OpenFEMA samples | FEMA | GitHub repository retrieved; current repository metadata and README inspected | **ADOPT** as client/test/reference material |
| FEMA OpenFEMA API | FEMA | Official OpenFEMA page and live dataset documentation inspected | **ADOPT**; refresh catalog/metadata periodically |
| FEMA GitHub | FEMA | Public organization/repository resources inspected | **REFERENCE**; only pin individual repos/files actually used |
| USACE CWMS Data API | USACE | Official GitHub repository and current ReadTheDocs documentation inspected | **ADOPT** as optional hydrologic operations plane; keep credentials/config separate |
| USACE CWMS live host | USACE | Connector DNS failed; repository/docs remain reachable | **PENDING LIVE-ENDPOINT PROBE** |
| USACE NID API | USACE | Official Swagger UI endpoint reachable; schema was not exposed to the text fetcher | **ADOPT DISCOVERY**, **PENDING SCHEMA PIN** |
| USACE NLD | USACE | Official data-services page and current public FeatureServer inspected | **UPDATE EXISTING BINDING** |
| USACE NSI API | USACE HEC | Official current API guide inspected | **ADOPT** for structure/consequence context; current 2026 download tool is under maintenance |
| Indiana DNR water wells | Indiana DNR Division of Water | Official ArcGIS item/metadata and current FeatureServer linkage identified | **ADOPT AS REFERENCE DATA** |
| IndianaMap | Indiana Geographic Information Office | Portal and current state GIS services referenced | **ADOPT AS DISCOVERY/CATALOG PLANE** |
| Indiana IGA API | Indiana government | Requested documentation returned HTTP 403 | **UNVERIFIED — DO NOT IMPLEMENT CONTRACT YET** |
| Indiana DNR DCAT-US feed | Indiana DNR / ArcGIS Hub | Requested feed endpoint could not be fetched in this environment | **PENDING FEED SNAPSHOT** |

## FEMA OpenFEMA

Official OpenFEMA describes the API as read-only, no-registration public access and states that the API is the authoritative source for FEMA's public OpenFEMA data. Dataset metadata exposes dataset versions, fields, update frequency, and downloadable representations.

TSM already has:

- `backend/geospatial/fema/openfema_client.py`
- `tsm-console/server/ingestion/openfema.mjs`
- `data/fema/openfema-catalog.json`
- OpenFEMA validation tests

### Required hardening

1. Keep the allowlisted dataset model.
2. Add a machine-generated metadata refresh artifact for `OpenFemaDataSets` and `OpenFemaDataSetFields`.
3. Preserve dataset version separately from retrieval timestamp.
4. Preserve `@odata.nextLink` traversal and enforce page/record safety caps.
5. Never use policy/claims records as a FEMA flood-zone or insurance determination.
6. Record source URL, dataset version, retrieval timestamp, content type, and SHA-256 for frozen snapshots.

## USACE CWMS Data API

The USACE `cwms-data-api` repository is active and currently uses the `develop` branch. Its official documentation identifies a RESTful data service with time-series and location-level data, client libraries, access-management components, and catalog/search concepts.

Important integration constraint: CWMS is a **water-data/service plane**, not a substitute for USGS observation authority or a hydraulic model result. TSM should retain provider, series identifier, units, time basis, quality/status metadata, retrieval timestamp, and source endpoint.

### TSM action

Create a CWMS adapter only behind a source configuration contract:

- `baseUrl`
- `office`
- `timeseriesId`
- `begin/end`
- `units`
- `version/content-type`
- authentication mode (if required)
- source health
- provenance

Do not hard-code the requested `cwms-data.usace.army.mil` host as the only deployment target. The USACE repository documentation and source code support configurable service deployments.

## USACE National Inventory of Dams

The official NID developer URL is:

`https://nid.sec.usace.army.mil/api/developer`

The current NID site identifies the National Inventory of Dams as a USACE-maintained national inventory and exposes a public developer/Swagger interface. The API schema was not available through the text retrieval channel, so TSM must not infer endpoint names or fields from secondary documentation.

### TSM action

Add NID as a **reference infrastructure layer** with:

- stable source ID
- official API URL
- discovery URL
- schema hash/version once retrieved
- retrieval timestamp
- geometry CRS
- dam identifier
- source record URL
- explicit disclaimer that NID is infrastructure inventory evidence, not a site-specific engineering certification

## USACE National Levee Database

The current official NLD public services expose:

`https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer`

The public service currently exposes layers including:

- Boreholes (0)
- Crossings (1)
- Levee Stations (2)
- Piezometers (3)
- Pump Stations (4)
- Relief Wells (5)
- Pipe Gates (6)
- Alignment Lines (7)
- Pipes (8)
- Cross Sections (9)
- Closure Structures (10)
- Embankments (11)
- Floodwalls (12)
- FRM Lines (13)
- Toe Drains (14)
- System_Routes (15)
- Leveed Areas (16)
- Berms (17)

The service reports NAD83 horizontal reference and a NAVD88 vertical reference. NLD's own data dictionary states that its data are standardized geospatial/database records and that public data can be downloaded/shared.

### TSM action

The existing `tsm-console/server/ingestion/usace-nld.mjs` should be updated from the legacy/alternate service binding to the current public FeatureServer when acquiring current records. Preserve per-record `Data Last Updated` / assessment metadata where available.

Do not turn NLD presence into a claim that a levee is accredited, safe, FEMA-certified, or hydraulically adequate.

## USACE National Structure Inventory

The current NSI API guide uses:

`https://nsi.sec.usace.army.mil/nsiapi/`

It supports GeoJSON structure retrieval by bounding box, FIPS, and complex polygon POST requests, plus statistics. The current documentation also states that repeated use of the same inventory should favor downloading/storing a local copy rather than repeatedly calling the API.

The NSI documentation further warns that the base inventory contains modeled/estimated attributes and is not an exact representation of reality.

### TSM action

Treat NSI as a **consequence-analysis reference layer**, not survey truth. Store the NSI release/vintage, structure identifier, ground-elevation metadata, and source lineage. For flood consequences, require compatible terrain/model datum assumptions.

## Indiana DNR Water Well Records

The current official ArcGIS item is:

`https://www.arcgis.com/home/item.html?id=67ae17877937442dbf454390df3cc803`

Its official metadata identifies the underlying service as:

`https://gisdata.in.gov/server/rest/services/Hosted/WaterWells_DNR_Water_IN_1/FeatureServer`

The dataset is read-only and contains approximately 407,000 records according to its metadata. A substantial portion of locations are field located, while many are geocoded or estimated from PLSS/Township-Range-Section information.

### TSM action

This is useful for subsurface/hydrogeology context and screening, but it must be classified as **reference evidence**. In particular:

- retain location method/accuracy metadata where available;
- distinguish field-located, geocoded, and PLSS-derived/estimated points;
- do not use an estimated well point as survey-grade site geometry;
- retain the Indiana DNR attribution/use constraints;
- do not expose private/personally identifying fields if the upstream service ever provides them.

## IndianaMap / ArcGIS Hub

IndianaMap is the statewide discovery/catalog plane. Most state geospatial services are hosted through the Indiana GIS service infrastructure. TSM should use IndianaMap/DCAT metadata to discover products, but each runtime source must still bind to the underlying authoritative service and preserve its product metadata.

### TSM action

Add a catalog-ingestion step that can consume DCAT-US metadata when available, but require the underlying distribution URL to be validated before promotion.

## Indiana IGA API

The requested documentation endpoint:

`https://docs.api.iga.in.gov/usage.html`

returned HTTP 403 to this retrieval environment. No endpoint/schema contract is therefore asserted here.

### TSM action

Leave the IGA connector in `PENDING` state until an authoritative OpenAPI/schema document or successful authenticated/public documentation retrieval is available.

## Acquisition and hashing

Binary downloads from public URLs could not be materialized directly by the execution container because outbound DNS resolution is disabled. The public GitHub/API/web evidence was therefore inspected through connected retrieval services rather than falsely represented as local downloads.

For the next acquisition run, the required output is:

1. source URL
2. HTTP status
3. retrieval timestamp
4. content type
5. source/product version
6. native CRS
7. vertical datum
8. file size
9. SHA-256
10. validation receipt
11. publication artifact ID

The absence of a local download is an environment limitation, **not** evidence that the source is unavailable.

## Priority order for TSM implementation

1. **Update USACE NLD adapter to current public FeatureServer.**
2. **Add NID discovery/config contract; pin actual Swagger schema before coding field mappings.**
3. **Add NSI adapter/configuration for consequence context using the current API.**
4. **Add Indiana DNR Water Wells acquisition/reference adapter with location-quality classification.**
5. **Add CWMS optional adapter with deployment-configurable endpoint and explicit time-series provenance.**
6. **Automate OpenFEMA metadata/catalog refresh and hash the resulting snapshot.**
7. **Add IndianaMap/DCAT discovery ingestion.**
8. **Keep IGA API blocked until its schema is authoritative and retrievable.**

## Authority boundary

These sources improve TSM's evidence fabric. They do not authorize TSM to issue FEMA determinations, Indiana DNR determinations, USACE engineering certifications, dam/levee safety certifications, surveys, permits, or professional-engineering seals.
