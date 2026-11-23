# Posey County geospatial database/API — first operational backend slice

This is a deliberately **opt-in hybrid server**, not a dependency of the offline
UE5.8 Windows runtime. It extends the existing government evidence architecture without changing their regulatory claims.

## What is implemented

- PostGIS source registry, immutable raw SHA-256 snapshot identity, staged vector
  geometries, large raster/COPC/imagery asset receipts, and append-only review events.
- Real, bounded ArcGIS REST acquisition of **IGIO current parcels**, **IGIO current
  roads**, and **IGIO 2016–2020 building footprints** by object ID, with WGS84
  geometry and exact county-polygon intersection.
- Operator-controlled local vector or binary import for USGS 3DEP, flood hazards,
  levees, hydrography, OSM, orthophotos, historic scans and photographs.
- Public read API for source discovery, reviewed layers and bounded GeoJSON pages,
  with a strict property allowlist and explicit dataset timestamps/datum fields.
- A separate Compose PostGIS database + FastAPI process + private ingest CLI;
  the independent service is exposed on port 8791; the original companion API
  OpenAPI contract is unchanged.

**Not claimed:** automated complete county ingestion, measured rooftop heights,
datum conversion, exact per-tile flight dates, HEC-RAS approval, FEMA
determination, public HTTPS deployment, WebGL viewer consumption, or offline
Windows release acceptance. A registered source is **not** ingested. A staged
source is **not** public. An operator review is not an agency decision.

## Launch a local server

From repo root, set a strong non-committed secret (alphanumeric or URI-escaped)
and run:

    export TSM_POSEY_DB_PASSWORD='<your private strong password>'
    docker compose -f deploy/posey-geospatial/compose.yml up -d --build postgis api
    curl http://127.0.0.1:8791/api/geospatial/posey-stack/health
    curl http://127.0.0.1:8791/api/geospatial/posey-stack/sources
    curl http://127.0.0.1:8791/api/geospatial/posey-stack/layers

Ports are loopback-bound: Postgres 5544 and API 8791. No cloud provider,
public DNS or secrets are assumed. For an **existing** database volume, apply
003_posey_geospatial_stack.sql explicitly with psql; Docker init scripts run
only when a volume is first initialized. For production: least-privilege API
read role, private ingest credentials, TLS reverse proxy, rate limiting,
backups, database migrations and monitoring are required before public launch.

## Download and stage official road, parcel, building geometry

The fetch command contacts ONLY the three exact allowlisted IGIO ArcGIS feature
layers, queries object IDs within Posey County's census boundary *envelope*,
then filters all features by intersection with the actual polygon. It saves
the raw GeoJSON in the content-addressed object store and inserts staged
records. It does not fetch imagery or LiDAR point clouds.

    docker compose -f deploy/posey-geospatial/compose.yml run --rm ingest fetch-arcgis igio-roads
    docker compose -f deploy/posey-geospatial/compose.yml run --rm ingest fetch-arcgis igio-parcels
    docker compose -f deploy/posey-geospatial/compose.yml run --rm ingest fetch-arcgis igio-buildings

The response returns a snapshot UUID and SHA-256. The database will record
STAGED_NOT_PUBLISHED. An ArcGIS service failure, unsupported query response,
invalid geometry, duplicate feature ID or over-limit response stops the import
rather than inventing a layer or silently truncating it.

## Stage local government GeoJSON, DEM/COPC/orthos, and historic material

Prepare a JSON metadata file alongside each input, with:

    {
      "sourceUrl": "https://apps.nationalmap.gov/lidar-explorer/",
      "retrievedAt": "2026-11-23T13:00:00Z",
      "attribution": "USGS 3DEP",
      "license": "REVIEW_REQUIRED",
      "horizontalCrs": "EPSG:2966",
      "verticalDatum": "NAVD88",
      "acquisitionDate": null,
      "effectiveDate": null,
      "evidenceClass": "SOURCE_REFERENCE",
      "downloadUrl": "EXACT_DOWNLOAD_URL_GOES_HERE",
      "note": "Replace retrieval timestamp and all unknown provenance fields before ingest."
    }

The sample timestamp is **illustrative**, never inferred by the importer.
For historical scans without a known georeference, set
horizontalCrs to UNREFERENCED rather than inventing EPSG:4326. For vector
GeoJSON, explicitly reproject to EPSG:4326 before staging. No implicit
NAVD88/geoid or units transform is permitted. Keep the original acquisition
date (actual flight/survey date), retrieval date, and regulatory effective
date **separate**. The manifest sourceUrl must be on the registered agency
host; include the actual file download host in the separate downloadUrl.

The ingestion container reads /app/imports, mounted from
data/posey-county/offline by default:

    docker compose -f deploy/posey-geospatial/compose.yml run --rm ingest \
      import-geojson indnr-bafl /app/imports/flood.geojson \
      --manifest /app/imports/flood.manifest.json

    docker compose -f deploy/posey-geospatial/compose.yml run --rm ingest \
      import-asset usgs-3dep /app/imports/posey-dem.tif \
      --kind DEM --manifest /app/imports/posey-dem.manifest.json

Large assets are copied and SHA-256 checked in streaming chunks (up to 8 GiB
each), not loaded into memory. Operator-provided acquisition manifests and
explicit reusable rights are prerequisites before publishing.

## Review and publish a snapshot

An authorized server operator sets an allowlist of reviewer subjects:

    export TSM_REVIEWER_SUBJECTS='reviewer-id-from-your-controlled-process'

After verifying the upstream record, exact geometry/CRS, collection date,
correct source, dataset rights and all required data checks, the operator may
approve **display only**:

    docker compose -f deploy/posey-geospatial/compose.yml run --rm ingest \
      approve SNAPSHOT_UUID \
      --reviewer reviewer-id-from-your-controlled-process \
      --reason 'Checked provenance, geographic subset, format and reuse rights' \
      --license-note 'Specific verified rights statement and attribution'

This command checks the original bytes again, records an append-only review
event and changes status to APPROVED_FOR_VIEW. Reviewer allowlist absence or
bad hashes block promotion. It does **not** grant regulatory authority or
certify a DEM. A production system must use externally authenticated reviewer
subjects, independent source inspection and audit logging.

Example public read (after at least one explicit approval):

    curl 'http://127.0.0.1:8791/api/geospatial/posey-stack/layers/igio-roads/features?bbox=-87.92,37.91,-87.87,37.95&limit=100'

Use the next_after cursor for subsequent pages and the optional timezone-aware
as_of parameter to select by **retrieval time**. That is not a historical
simulation, tide/river forecast or model validation. The API exposes no raw
owner-address/property-value attributes.

## Official upstreams (verified lookup endpoints, not ingested claims)

| Layer | Operator integration | Original reference |
|---|---|---|
| Roads | Live ArcGIS GeoJSON snapshots | https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer/0 |
| Parcels | Live ArcGIS GeoJSON snapshots | https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0 |
| Buildings | Live ArcGIS GeoJSON snapshots; height evidence separate | https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0 |
| Terrain/LiDAR | Local source files and checked asset manifests | https://apps.nationalmap.gov/lidar-explorer/ |
| Orthophotos | Local COGs; per-tile flight dates must be reviewed | https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer |
| Historical Sanborn | Rights-reviewed historic scans, not current buildings | https://www.loc.gov/collections/sanborn-maps/ |
| Historic topographic | Dated quadrangles | https://ngmdb.usgs.gov/topoview/ |
| Waterways | Official USGS hydrography export/local adapter | https://api.water.usgs.gov/ |
| FEMA floodplain | Effective NFHL snapshot with panel/effective date | https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer |
| Indiana DNR BAFL | **Separate** state planning map, not FEMA effective layer | https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Watergdb/FeatureServer/0 |
| USACE | NLD levee geometry and evidence | https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/7 |
| OpenStreetMap | Separately attributed, ODbL-reviewed context | https://www.openstreetmap.org/copyright |

No automated scraping of Google/Bing/Pastmaps is part of this pipeline.
Do not distribute imagery or historic material before verifying rights.

## Gates and tests

    python -m pip install -r deploy/posey-geospatial/requirements.txt pytest
    python -m pytest backend/tests/test_posey_geospatial_stack.py -q
    docker compose -f deploy/posey-geospatial/compose.yml config --quiet

CI also starts fresh PostGIS + the API, queries the populated source catalog,
and verifies that no STAGED data is exposed as a reviewed layer.

**Next integration:** connect the public web console through an explicit
same-origin HTTPS API proxy; adapt Cesium/Unreal export workers to consume
APPROVED_FOR_VIEW snapshots and keep each asset's geometry + CRS + epoch
provenance together. No claim that this end-to-end rendering connection exists
until it is implemented and independently tested.
