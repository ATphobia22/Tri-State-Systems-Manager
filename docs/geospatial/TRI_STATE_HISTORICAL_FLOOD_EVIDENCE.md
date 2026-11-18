# Six-county historical flood map, BFE, buildings and NFIP evidence

**Reviewed:** 2026-11-18. **Scope:** Posey IN (18129); Henderson KY (21101); Union KY (21225); Gallatin IL (17059); Wabash IL (17185); White IL (17193).

**Evidence state:** Source-discovery registry and a reproducible offline inventory generator. **No complete county-wide downloaded map/terrain/building source set; no map-use attribution, pixel-accurate flood depth, certified BFE, actual event-by-building exposure, or regulatory determination established.** GitHub Actions tests exercise synthetic files only. No operational PostGIS instance is modified by the scripts.

## Why map era, map edition and flood event must be separated

A flood in 1937 cannot have a FEMA/NFIP map, modern FEMA BFE, or NFIP policy record *from 1937*. The NFIP was created in 1968. Later FEMA products can be used for clearly labeled retrospective comparison, not represented as what local flood authorities used in 1937. A 2014 FIRM cannot be represented as a map used during the 2011 event either.

The checked-in historical Posey photograph record identifies FEMA FIRM panel **18129C0300C** with an effective date of **2014-11-05** (see [Point Township source reconciliation](../evidence/POSEY-POINT-TOWNSHIP-HISTORICAL-SOURCE-RECONCILIATION.md)). This date still needs an independent FEMA Map Service Center product and change-log reconciliation. The code classifies this edition as **POST_EVENT_NOT_AVAILABLE** for both 1937 and 2011.

FEMA's Map Service Center **Search All Products** exposes historic/effective/preliminary FIRM, FHBM, FBFM, FIS and LOMC products; the **current NFHL service is not a historical map-usage log**. The analyst must select the edition effective *at the event time* and check later panel amendments, then independently establish whether a named government agency actually used the edition during response, floodplain management or insurance adjudication. Temporal eligibility alone never proves usage.

- FEMA MSC: https://msc.fema.gov/
- FEMA NFHL: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
- FEMA FIRM/FIS training: https://emilms.fema.gov/is_0274/groups/122.html
- USGS 1937 study: https://pubs.usgs.gov/publication/wsp838
- USGS 2012 Ohio River backwater study: https://pubs.usgs.gov/sir/2012/5212/
- USGS Flood Event Viewer / high-water marks: https://apps.usgs.gov/fev/data-download-portal
- NOAA NWPS (historic crests/low-water history only, not full historic time series): https://water.noaa.gov/about/api

## Map-formation evidence to collect per source and event

| Evidence type | Required original inputs / map construction method | Quality and provenance acceptance fields | Common false inference |
|---|---|---|---|
| FEMA historic FIRM/FHBM/FBFM/FIS | Edition/panel identifier, base map, study hydrology, hydraulic profile/cross-section, revisions/LOMC, effective date | Map scale, date, zone, spatial reference, BFE, vertical datum (may be NGVD29 or NAVD88), official original and later amendments, source hash | Current NFHL polygon was on the 1937 or 2011 incident map |
| FEMA NFHL | Effective digital FIRM database, DFIRM_ID, zone, panels, floodway, BFE lines and revision history | Layer/service ID, per-feature provenance, effective status, coverage/count/geometry completeness | A current DFIRM proves how a past agency drew a flood |
| USGS event measurements | Flood event IDs, surveyed HWMs, stage/discharge, peak measurement and site-rating histories | Survey time, GPS/survey method, mark confidence, observation status, vertical datum, site-specific gauge datum | Stage in gage feet equals NAVD88 elevation |
| USGS modeled inundation | Channel/cross-sections, bathymetry, DEM, calibration gage, hydraulic model, stage profiles | Model version, calibration period, DEM acquisition date and uncertainty, study reach and scenario assumptions | Model-generated event maps are FEMA regulatory BFEs |
| Indiana GIO lidar/elevation | LAS/LAZ tile collection, classification, bare-earth DEM, DSM, NDHM | Exact GPS tile acquisition, lidar QL, density, resolution, coordinate reference, vertical accuracy, datum/geoid | Later DEM existed in the year of the historic flood |
| Kentucky KyFromAbove | STAC point-cloud/DEM/ortho tile and phase, processing and quality docs | Tile ID, flight date, asset checksum, phase, QL, CRS, NAVD88/other datum if actually declared | Phase-wide accuracy applies to every tile without QA review |
| Illinois ISWS buildings | Microsoft/Bing imagery-derived polygons or selected class-6 lidar points classified/extracted with LP360 | Building producer/method, polygon source, acquisition year, topology, footprint uncertainty | A footprint from 2018 is proof that a building existed in 1937 |
| FEMA OpenFEMA NFIP | Redacted claims/policies and declared disaster datasets | Endpoint VERSION, query filter, refresh time, record count, paging completeness, response page hashes, aggregation limitations | A redacted NFIP claim identifies a particular house or proves flood depth |
| Local/state historical maps | PLSS parcels, aerial photography, FEMA/USACE/USGS archive reports and documented historic flood extent | Agency custodianship, published edition, scan scale, georeferencing RMSE, survey control and revision date | A georeferenced paper map has contemporary survey accuracy |

**BFE requirements:** retain the BFE directly printed on the applicable FIRM/FIS, FIS profile/cross-section or documented FEMA revision, the vertical datum, units, source-map edition, hydraulic method, source chain and QA. Never infer an old BFE from a modern DEM, or copy current one back to 1937. Do not add gage stage directly to ground elevation without an authenticated gage datum offset. A NAVD88 figure must not be manufactured by simply renaming an NGVD29, ellipsoidal or EGM2008 value. GEOID18 and any future geoid model must be recorded separately.

**Buildings:** a GIS polygon is footprint evidence for its acquisition vintage, not proof of a structure's past existence, FFE, foundation, use, occupancy or construction date. For Illinois, the ISWS portal distinguishes statewide imagery-generated footprints from selected LiDAR-derived footprints, listing Gallatin (SWS/MS), Wabash (MS), White (SWS/MS). Confirm the file's specific method and acquisition year rather than assigning one accuracy figure to all three counties.

## Data sources for each county

| County FIPS | Jurisdiction | Regulatory and administrative | Terrain and building discovery |
|---|---|---|---|
| 18129 | Posey, Indiana | FEMA MSC/NFHL, OpenFEMA, Indiana DNR floodplain portal | Indiana GIO lidar S3, GIO acquisition dates, IGIO buildings |
| 21101 | Henderson, Kentucky | FEMA MSC/NFHL, OpenFEMA | KyFromAbove lidar/DEM/orthos STAC, KyGeoNet structures/cadastral |
| 21225 | Union, Kentucky | FEMA MSC/NFHL, OpenFEMA | KyFromAbove lidar/DEM/orthos STAC, KyGeoNet |
| 17059 | Gallatin, Illinois | FEMA MSC/NFHL, OpenFEMA, Illinois flood maps | ISWS building footprints and ISGS lidar |
| 17185 | Wabash, Illinois | FEMA MSC/NFHL, OpenFEMA, Illinois flood maps | ISWS building footprints and ISGS lidar |
| 17193 | White, Illinois | FEMA MSC/NFHL, OpenFEMA, Illinois flood maps | ISWS building footprints and ISGS lidar |

Shared USGS historic streamgage/event and USACE archive sources must be linked by actual study coverage. A regional 1937/2011 event index **does not assert actual parcel flooding in each county**. Include an event only in a specific county incident layer after county-specific agency/measurement evidence.

### Indiana public S3

The Indiana bucket public root was enumerated separately using the AWS API. Its collection families include `copc/`, `las/`, `demraw/`, `demoptimized/`, `dsmraw/`, `metadata/` and `ndhmoptimized/`. Root prefix existence **does not validate Posey coverage, individual tile hash, dates, collection accuracy or height datum**.

```sh
aws s3 ls s3://giselevationingov/ --no-sign-request
aws s3 ls s3://giselevationingov/metadata/ --no-sign-request
# Discover exact Posey tile/work-unit IDs from the Indiana GIO lidar-date service;
# only then retrieve the corresponding public tiles and source metadata.
```

Indiana GIO access guide: https://www.in.gov/gis/geoinsights/posts/how-to-access-indianas-imagery-and-elevation-raster-datasets/ . Acquisition-date service: https://gisdata.in.gov/server/rest/services/Indiana_Statewide_3DEP_Lidar_Dates/MapServer .

Kentucky tile and asset discovery: https://kygeonet.ky.gov/catalogexplorer/ . Illinois footprint classification and source: https://www.illinoisfloodmaps.org/building-footprints.aspx . Illinois LiDAR holdings: https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/ .

## OpenFEMA integration (reuse existing TSM client)

Existing authority catalog: [OpenFEMA catalog](../../data/fema/openfema-catalog.json). Existing controlled client: [openfema_client.py](../../backend/geospatial/fema/openfema_client.py). Existing snapshot: [Posey declaration export](../../scripts/government/openfema_posey_snapshot.py).

- `DisasterDeclarationsSummaries` v2: federal incident/declaration administrative records; county FIPS, declaration date, incident type.
- `NfipPolicies` v3 and `NfipClaims` v3: **redacted, administrative, not geocoded parcels**. Aggregate only at statistically/privacy-safe levels and avoid small-cell reidentification.
- Preserve source `retrieved_at`, versioned URL, OData query, selection, completeness/PARTIAL status, pagination receipts and raw-response SHA-256. A published API catalog record is not a live observed event.
- The existing TSM bounded adapter has file/response budgets. Large historical national NFIP exports can be staged in versioned Parquet for **offline DuckDB** summaries after privacy review. Do not force Apache Spark, ClickHouse or a continuously streaming service into the zero-login offline Windows installer.

## Implemented artifacts and review-only commands

- `data/historical-floods/tri-state-catalog-v1.json`: 17 source/product categories, 6 county targets, 2 regional historical-event contexts, one photographed Posey 2014 map edition; all unknown dates and QL fields are **null**, not guesses.
- `scripts/geospatial/historical_flood_evidence_schema.sql`: PostGIS tables for counties, events, agency sources, map edition, source asset quality, BFE records, versioned building polygons, explicit agency map use review, and temporal diagnostic view.
- `scripts/geospatial/historical_flood_source_seeds.sql`: SQL seeds for **all 17** registry categories and county-specific discovery scopes; no claim of tile coverage.
- `scripts/government/historical_flood_bundles.py`: no-network, hash-validating local bundle builder that refuses out-of-root paths, hash mismatches and post-event-map historical-use claims.
- `tests/government/test_historical_flood_bundles.py` and `.github/workflows/historical-flood-evidence.yml`: synthetic tests and six-county CI-generated inventory.

```sh
python -m unittest discover -s tests/government -p test_historical_flood_bundles.py -v
python scripts/government/historical_flood_bundles.py \
  --catalog data/historical-floods/tri-state-catalog-v1.json \
  --asset-root . --out /some/new/review-only-inventory-folder
# Apply to a reviewed PostGIS database ONLY after inspecting and backing up schema:
psql -v ON_ERROR_STOP=1 -f scripts/geospatial/historical_flood_evidence_schema.sql
psql -v ON_ERROR_STOP=1 -f scripts/geospatial/historical_flood_source_seeds.sql
```

Optional `--asset-manifest` accepts a JSON array of operator-owned local assets. Each record must reference a catalog `source_id`, event, county, evidence class, **relative filename and actual SHA-256**. An accepted file is always marked `NOT_VERIFIED` engineering-wise, even when its bytes match the declared digest. An agency-use claim requires a supporting archival URL and can never contradict the edition's event date. No network access or fictitious file contents are used to generate example files.

Output states are `INVENTORY_ONLY` or `PARTIAL_ASSETS_ATTACHED`. There is deliberately **no automatic COMPLETE, LOMA_ELIGIBLE, BFE_CERTIFIED or CURRENT_FEMA status**.

## Repository reuse decisions

| Repository | Decision for TSM | Basis and restraint |
|---|---|---|
| `ATphobia22/open-data-registry` | Adopt AWS public-bucket discovery pattern | Registry entries describe discovery, not data custody or measured accuracy |
| `OpenRefine/OpenRefine` | Optional human-assisted correction of panel IDs, old street labels, duplicates | Keep before/after logs, never overwrite original source |
| `PostHog/posthog` | Not added to desktop offline runtime | Anonymous public use must not require behavioral telemetry or new network services |
| `ATphobia22/awesome-geospatial-data-sources` | Discovery only; path access was not verified during this audit | Directory is not authoritative parcel/BFE data |
| `duckdb/duckdb` | Recommended local analytics of approved redacted NFIP Parquet | Read-only snapshots, group aggregation, no parcel reidentification |
| `apache/spark` | Defer | Distributed processing unnecessary for reproducible six-county offline evidence |
| `ClickHouse/ClickHouse` | Defer | Additional server/operational stack unnecessary in offline Windows installer |
| `pathwaycom/pathway` | Defer | Streaming integration inappropriate for sealed historic evidence; could later ingest separate live data |
| `awesomedata/awesome-public-datasets` | Discovery only; direct README fetch was unavailable | Curated links are not original agency records |
| `mebauer/duckdb-fema-nfip` | Borrow Parquet/DuckDB analytical workflow, review code before reuse | Secondary examples, not official FEMA datasets |
| `NTICompass/APIExplorer.org` | Reference only | Old PHP/OpenFEMA API explorer; not suitable to replace current bounded v3 TSM adapter |
| `FEMA/openfema-samples` | Reuse current official paging/export reference | Official samples should not replace TSM provenance/limits |
| `schemeflex/openfema-api-python-client` | Reference only | Project states it is early/bare-bones; TSM already supports v3 route/versioning |
| `mebauer/nfip-datasets` | Reference paginated API-to-Parquet extraction | Do not silently turn partial pages into a complete file |
| `mebauer/fema-disaster-information` | Reference declaration/assistance grouping | Administrative declarations do not infer mapped flood extents |

The review of these repos is an architectural selection, not a claim of full dependency/security auditing, vendoring, compiling or running their complete codebases.

## Remaining authoritative inputs and release conditions

1. Obtain each county's archived FEMA **effective-at-event** map edition and FIS/LOMC chain from MSC, plus map QA, BFE datum and original H&H methods. For pre-NFIP 1937 use USGS/USACE/state historical mapping and classify FEMA panels as `NOT_APPLICABLE_AT_EVENT`.
2. Retrieve actual Indiana GIO, KyFromAbove and Illinois ISGS/ISWS terrain, imagery and footprint tiles with work-unit metadata, official county coverage and per-file SHA-256. Validate collection date and coverage in each county.
3. Attach actual event-era photographs, high-water marks, gauging records, original agency maps/archives, dates and georeferencing accuracy; distinguish real observed historic structures from later reconstruction.
4. For BFE, extract FIS profile/cross-section and official revision records per time-valid map; inspect native datum/units before numeric comparisons; keep BAFL planning values separate from regulatory BFEs.
5. Run the approved seed migrations against an **authorized actual PostGIS instance** and retain migration transaction/verification receipts. CI currently proves source-code tests, not a production database deployment.
6. Create reviewed source manifests and rerun offline bundle generation; validate missingness, spatial coverage, river/levee topology, vintage change and methods before advertising a county as data-complete. Formal NFIP or LOMA decisions remain with competent authorities.

**No source, agency or map edition in the registry is represented as independently having been used during the event without documentary evidence.**
