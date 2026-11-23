# Posey Regional Twin — PostGIS, acquisition, API, evidence and PhysicsNeMo

**Scope:** Optional hybrid backend for the 4D Tri-State River Valley digital twin.
Posey County (Indiana FIPS 18129) first; no single-parcel anchoring. This does
**not** replace the independent offline Windows/UE5.8 runtime. Public access is
anonymous/read-only; operator import and publication remain local/privileged.

## Working code in this package

- `sql/003_posey_regional_twin.sql`: PostGIS `twin_geo` source/asset/feature
  tables, independent building dimension records, scientific model artifact
  ledger, append-only publication receipts and read-role grants.
- `backend/geospatial/posey_sync.py`: user-invoked ArcGIS feature retrieval.
  Each request uses the official IGIO Posey boundary (FIPS 18129) as a polygon
  spatial filter. Builds a complete SHA-256-stamped GeoJSON snapshot with
  bounded, checked pages. No unattended polling, no silent synthetic features.
- `backend/geospatial/twin_import.py`: reviewed-vector and binary-asset import,
  content-addressed local copy, explicit CRS/datum, checksum and licensing
  gates. Vector imports require EPSG:4326. DEM/LiDAR metadata require vertical
  datum and units; orthos require collection start AND end dates.
- `backend/geospatial/twin_publish.py`: explicit local reviewer allowlist,
  reviewer receipt digest and append-only publication event.
- `backend/api/v1/regional_twin.py`: registered source discovery, approved
  assets, bounded spatial queries, independent height evidence, reviewed
  model outputs. Parcels are redacted to public non-owner attributes.
- `backend/geospatial/twin_server.py`: independent lean read-only API;
  the same router is mounted in the existing companion FastAPI app.
- `backend/geospatial/physicsnemo_infer.py`: optional real checkpoint inference,
  not a training service or a certified forecast system. Requires an
  operator-allowlisted SHA-256 model and preserves provenance.

## Source registry vs acquisition status

All endpoints below are **registered references** on DB initialization, not
automatically downloaded or declared current/valid:

| Domain | Source | Adapter state |
| --- | --- | --- |
| Buildings | [IGIO 2016–2020 footprints](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0) | Full bounded Posey GeoJSON staging |
| Parcels | [IGIO current parcels](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0) | Full bounded Posey GeoJSON staging |
| Roads | [IGIO current roads](https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer/0) | Full bounded Posey GeoJSON staging |
| County boundary | [IGIO current counties](https://gisdata.in.gov/server/rest/services/Hosted/County_Boundaries_of_Indiana_Current/FeatureServer/0) | Used directly to constrain staging; not automatically imported |
| Flood hazards | [Indiana DNR best-available planning layer](https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Watergdb/FeatureServer/0) | Full bounded Posey GeoJSON staging; PLANNING, not FEMA regulation |
| Regulatory floodplain | [FEMA NFHL](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) | Registered, not imported: effective DFIRM version/panel must be checked |
| Levees | [USACE NLD](https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer) | Registered; verify layers before importing |
| DEM/LiDAR | [USGS TNMAccess v1](https://tnmaccess.nationalmap.gov/api/v1/products) | Registered discovery; verified raster/LPC files import locally |
| Hydrology | [USGS Water Data OGC v1](https://api.waterdata.usgs.gov/ogcapi/v1/) | Registered; time-series acquisition remains in existing gauge service |
| Orthos | [Indiana imagery AWS catalog](https://registry.opendata.aws/in-imagery/) | Registered; collection date mandatory on file import |
| Roads reference | [Geofabrik OSM Indiana](https://download.geofabrik.de/north-america/us/indiana.html) | Registered; ODbL review before use |
| Historical | [Library of Congress Sanborn](https://www.loc.gov/collections/sanborn-maps/) | Registered; rights, edition date and georeferencing review required |
| Historical | [USGS historical quadrangles](https://apps.nationalmap.gov/downloader/) | Registered; source year, sheet edition and registration residuals needed |

The authoritative Indiana GIS service is distinct from the OpenStreetMap
community layer. Neither parcel geometry nor extruded building footprints
satisfy independent field-survey accuracy. Keep original features, identifiers,
acquisition/valid time, license, and a SHA-256 receipt.

## Local run (server/database)

```bash
# From repository root. Real secret must NOT be committed.
cp packages/government/.env.twin.example packages/government/.env.twin
# Edit the local file, replacing the example with a unique strong POSTGIS_PASSWORD.
docker compose --env-file packages/government/.env.twin \
  -f packages/government/docker-compose.twin.yml up -d --build
curl -fsS http://127.0.0.1:8769/api/geospatial/twin/health
curl -fsS http://127.0.0.1:8769/api/geospatial/twin/sources
```

Compose provisions initial SQL in an **empty** volume. Existing databases
require an explicit migration application; mounting new init scripts does not
re-run them against nonempty volumes. Do not remove volumes that contain data.

## Stage and import actual IGIO vectors

```bash
python -m backend.geospatial.posey_sync --source igio-buildings --output /data/tsm/staged
python -m backend.geospatial.posey_sync --source igio-parcels --output /data/tsm/staged
python -m backend.geospatial.posey_sync --source igio-roads --output /data/tsm/staged
python -m backend.geospatial.posey_sync --source indnr-flood --output /data/tsm/staged
```

Staged GeoJSON is **UNVERIFIED**. An independent human/geospatial review must
confirm license, snapshot completeness, feature IDs/geometry validity,
timestamps and coordinate reference before changing a copied manifest to
`validationStatus: PASS`, `licenseReviewed: true`, a nonplaceholder
`reviewId`, and a reviewed license description. For raster/orthos/historical
assets provide `assetKind`, dates, exact CRS, datum/units where applicable,
source catalog URL, byte size and SHA-256 of the **actual downloaded bytes**.
The binary asset does not need to be GeoJSON. Do not invent missing acquisition
or vertical datum metadata.

```bash
export TSM_POSTGIS_DSN='postgresql://tsm_government:YOUR_LOCAL_SECRET@127.0.0.1:5439/tsm_government'
python -m backend.geospatial.twin_import \
  /data/tsm/staged/REVIEWED.geojson /data/tsm/staged/REVIEWED.manifest.json \
  --object-store /data/tsm/objects
```

A successfully imported snapshot is still **NOT_APPROVED** for public viewing.
Only a locally allowlisted operator may publish it, recording a review-receipt
SHA-256 in an append-only event.

```bash
export TSM_TWIN_REVIEWER_SUBJECTS='reviewer-subject-from-your-operator-identity-system'
python -m backend.geospatial.twin_publish REVIEWED_ASSET_ID \
  --reviewer 'reviewer-subject-from-your-operator-identity-system' \
  --proof-file /data/tsm/reviews/review-receipt.txt \
  --reason 'Scope-limited release approval after license and integrity review'
```

A string allowlist and hashed local receipt do not independently authenticate
someone; deployment must limit database/CLI access to authenticated operators.
Use a separate read-only DB login in production and avoid exposing admin DB
credentials to the public API.

## Read endpoints

```text
GET /api/geospatial/twin/health
GET /api/geospatial/twin/sources
GET /api/geospatial/twin/assets?sourceId=igio-buildings&limit=20
GET /api/geospatial/twin/features/{assetId}?bbox=-88.1,37.75,-87.7,38.1
GET /api/geospatial/twin/buildings/{assetId}/{featureId}/dimensions
GET /api/geospatial/twin/models
```

Only explicitly approved, validated snapshots appear in the public asset and
feature endpoints. Empty results are empty; no placeholder building heights,
fabricated gauge measurements or model predictions are returned. Pixel rasters
and LAZ/COPC point clouds remain binary files, **not** converted into
pretend GeoJSON by this API. Cesium/UE consumers will still need tile/terrain
packaging from the immutable content store.

## Independent building dimensions

`twin_geo.building_dimension` records method, independent evidence asset,
height above ground in meters, NAVD88 ground elevation if available,
uncertainty, timestamp and reviewer reference. Heights are not synthesized
from GIS footprints. This change creates the evidence schema and query; a
field-survey/point-cloud validation workflow and countywide reconciliation
are still independent release gates.

## Optional PhysicsNeMo computation

NVIDIA [PhysicsNeMo](https://github.com/NVIDIA/physicsnemo) offers FNO,
AFNO, PINO and other physics ML models; use it to **accelerate or evaluate**
a baseline solver, never to replace floodplain decisions automatically.
The optional inference worker uses
`physicsnemo.Module.from_checkpoint` for an independently trained
`.mdlus` checkpoint. It does not train a model from scratch.

```bash
# Install PhysicsNeMo/PyTorch in an independently managed GPU environment,
# using current NVIDIA instructions and the correct CUDA/PyTorch combination.
export TSM_ENABLE_PHYSICSNEMO=1
export TSM_TRUSTED_PHYSICSNEMO_SHA256=SHA256_OF_TRUSTED_CHECKPOINT
python -m backend.geospatial.physicsnemo_infer \
  --checkpoint /data/models/river-fno.mdlus \
  --inputs /data/models/scenario-inputs.npz \
  --contract /data/models/river-fno.contract.json \
  --output /data/models/predictions --device cuda
```

The contract requires input/model/training hashes, a physical baseline asset
ID, CRS, NAVD88, units, time window, model architecture and installed version.
The result is an **UNVERIFIED SIMULATION**, not a validated HEC-RAS output
or a government water-level observation. Before promotion into the
`model_artifact` table, independently compare held-out events, mass balance,
peak WSE error, wet/dry classification and uncertainty against the numerical
baseline. Missing truth data means **no PASS**. CUDA is optional to TSM's public
API and Windows native renderer.

## Test and release gates

```bash
python -m pytest backend/tests/test_posey_regional_twin.py -q
```

The `Posey Regional Twin PostGIS and API Gates` workflow additionally
provisions PostGIS 16, applies the migrations, tests a **synthetic** independent
review/import/publish flow, proves source paging/privacy/coordinates, checks
the append-only review table and builds the lean API image. CI does not
certify countywide feature completeness, agency uptime, field-survey quality,
raster seam integrity or production deployment. Confirm these separately
before exposing the public Atlas or packaging the offline Windows release.

## Additional framework decisions

- **PhysicsNeMo:** optional GPU inference and future training; not a required
  FastAPI or offline-native dependency. Legacy Modulus APIs should not be
  mixed with pinned PhysicsNeMo versions without compatibility tests.
- **Digital Twin Consortium:** its capabilities toolkit offers maturity and
  architecture evaluation, not authoritative Posey geospatial observations.
- **OpenTwins, Snap4City, Sentilo:** evaluate their interoperability
  (NGSI-LD/FIWARE, OGC API, FMI) and licenses before importing services.
  Snap4City's AGPL obligations warrant legal review for derivative code.
- **Mcity TeraSim and OFacT:** relevant to later mobility and logistics
  subsystems, not the initial floodplain/terrain engineering truth chain.
- **WorldSim AI/PhysicalAI:** these names do not identify sufficiently
  verified, version-pinned packages in this implementation; no installation
  or integration is asserted.

**Human Authority Final.** This software is decision-support, not a
surveying, permitting, warning or regulatory determination system.
