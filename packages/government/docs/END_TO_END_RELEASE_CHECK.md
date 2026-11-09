# Government source → geoprocessing → PostGIS → ledger → digital twin

Execution boundary: **connected ingestion workstation**, NOT offline Unreal runtime. This
document describes commands; it does not claim a deployment or agency approval.

## Source retrieval and evidence

- Canonical typed transport: `packages/government/src/index.ts` (`queryGovernmentJson`)
- Canonical snapshot materializer: `packages/government/src/liveIngestion.ts`
- Metadata/agency inventory: `GovernmentSourceRegistry.ts`
- Output triples: `<datasetId>-<sha>.json`, `*.manifest.json`, `*.evidence.json`
- All newly retrieved responses are `UNVERIFIED`; source HTTP success and hash integrity
  are **not** spatial accuracy, datum authority, legal acceptance or regulator review.
- Do not promote without independent metadata completeness, CRS, vertical datum where
  necessary, acquisition/effective date, source licensing, QA results and human approval.

## Geoprocessing

Use [GDAL ogr2ogr](https://gdal.org/en/latest/programs/ogr2ogr.html) with a known
source CRS and explicit `-t_srs EPSG:4326` on reviewed GeoJSON, or the existing
`scripts/geospatial/pdal_pipelines.py` ground/DEM operations on approved LiDAR.
Use [PDAL Pipeline](https://pdal.org/en/stable/pipeline.html) to retain processing
stage configuration and software version in the ledger. Reprojection of horizontal
coordinates never establishes a NAVD88 vertical transformation.

## Local PostGIS acceptance

Requires Docker Engine/Compose and locally managed secret (do not commit secrets):

```sh
export POSTGIS_PASSWORD='<strong-random-local-password>'
docker compose -f packages/government/docker-compose.postgis.yml up -d
export TSM_POSTGIS_DSN='postgresql://tsm_government:<password>@127.0.0.1:5439/tsm_government'
python -m pip install 'psycopg[binary]'
python packages/government/scripts/verify-postgis.py
```

The migration `packages/government/sql/001_government_fabric_postgis.sql`
only runs automatically when the local database volume is initialized for
the first time. Existing databases require migration tooling. No AWS RDS
resources or cloud costs are provisioned by this file.

## Offline vector publication and twin integration

A human-reviewed `PASS` GeoJSON manifest in WGS84 may be tiled using:

```sh
node packages/government/scripts/publish-pmtiles.mjs \
    validated.geojson validated.manifest.json validated.pmtiles fema_hazard
```

This requires Tippecanoe installed and an independently validated source.
The resulting tile archive is **BUILT_NOT_FIELD_VERIFIED** pending independent
tile hash verification. The twin loads from pinned local PMTiles using its
existing PMTiles MapLibre protocol/overlay and
`src/layers/maplibreGovernmentLayers.ts`. A reference to an HTTP endpoint
is not sufficient evidence that data were staged offline.

## Solver and native release gates

- HEC-RAS: record exact HDF5 output, computation log, model version and hydraulic
  convergence; see `backend/solver_evidence_adapters.py`.
- MODFLOW 6: record listing, head, budget and independently computed mass balance.
- EPA SWMM: record binary/output report, run metadata and error messages.
- OpenMI bridge passes exchange contracts; it does not certify any underlying solver.
- Approval must be human-authored, scoped, dated, immutable and attached to
  exact source/solver artifact digests. No source/solver can self-approve.
- Unreal Engine 5.8 Shipping proof must include packaged binary, clean Windows 11
  offline startup, data checksums, headed screenshots, FPS/VRAM/hardware and tests
  proving no WebView/localhost/Node dependency. Flax is not a verified replacement
  for this acceptance gate.
