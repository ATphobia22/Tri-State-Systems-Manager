# Tri-State regional operating system — implementation crosswalk (2026-11-13)

**Decision:** Evolve `ATphobia22/Tri-State-Systems-Manager` in place. Do **not** replace the working
`tsm-console`, `backend`, `packages`, `database`, or `tsm-native` trees with a second
Next.js/Neo4j/Kafka microservice scaffold. This document distinguishes *code exists* from
*integrated, runtime-tested* and *engineering-source-verified*.

## Four runtimes with one evidence contract

1. **Public static Pages** — `tsm-console` React/Vite + MapLibre. Anonymous public viewer,
   staged read-only datasets and optional direct public APIs. GitHub Pages cannot host
   FastAPI, Kafka, MQTT, a Postgres server or UE Windows binaries.
2. **Optional operator API** — `backend/app/main.py` FastAPI alongside
   `tsm-console/server` Node API. Bind locally unless the operator independently provides
   secure TLS, authorization, rate limits, permitted CORS and audited hosting.
3. **Data/science pipeline** — `backend/geospatial`, `scripts/geospatial`,
   `packages/geodesy`, `packages/hydrology`, `database/migrations` and
   `packages/data-fabric`. Validate source timestamps, acquisition metadata, CRS,
   vertical datum, license and exact content hash before publishing artifacts.
4. **Offline native viewer** — `tsm-native` Unreal 5.8, staged TSMData + checksums and
   a no-network Windows 11 x64 launch test. An API is *not* a runtime dependency.

## Architecture-to-code map

| Blueprint capability | Existing canonical TSM location | Integration/readiness boundary |
|---|---|---|
| Architecture / standards / governance | `docs/architecture`, `packages/policy`, `packages/evidence` | Many contracts exist; release evidence remains separate |
| API gateway and domain services | `tsm-console/server`, `backend/app/main.py`, `backend/api/v1` | Dual API processes, **not** a deployed mesh of ten microservices |
| Asset registry and regional twin | `packages/ontology/src/index.ts`, `packages/twin/src/index.ts`, new `backend/app/asset_registry.py` | Source-backed station locations only in first API slice |
| Ingestion / ETL / source metadata | `packages/data-fabric`, `scripts/ingest`, `backend/app/data_catalog.py` | Curated data promotion must retain provenance and quality |
| Postgres / PostGIS | `database/migrations`, `backend/db`, `docker-compose.yml` (legacy) | Optional operator environment, not a requirement for public Pages |
| GIS terrain / LiDAR / imagery | `scripts/geospatial`, `tsm-console/public/terrain_3dep`, `tsm-console/public/3d-tiles` | Full-height source reconciliation and independent terrain validation pending |
| BIM / IFC / Revit | `integrations/geospatial`, `integrations/authoring`, `integrations/registry` | A reviewed IfcOpenShell IFC-to-asset/geometry bridge is still needed |
| Telemetry and sensors | `backend/app/main.py`, `tsm-console/src/components/PagesUSGSGaugeReader.tsx` | Source observations are on demand; **no** claim of live MQTT/OPC-UA ingest |
| AI / forecasting | `packages/forecasting`, `scripts/flood-forecasting` | Cannot represent uncalibrated forecasts as operational flood predictions |
| Hydrology / hydraulics | `packages/hydrology`, `backend/solvers`, `scripts/engineering` | HEC-RAS/SWMM adapters require controlled inputs and validation |
| Web / dashboard / 3D | `tsm-console`, `apps/dashboard`, `tsm-console/src/routes/TriStateAtlasView.tsx` | Public Atlas deployed; imagery fidelity still below cinematic reference |
| Unreal + Cesium / native | `tsm-native/Source`, `tsm-native/Plugins`, `tsm-native/Content` | Separate Windows Shipping executable and headed offline proof required |
| Docker / infrastructure / monitoring | `infrastructure/docker`, `docker`, `docker-compose.yml`, `packages/observability` | No cloud deployment or secret provisioning is implied |
| Security / tests / CI | `packages/security`, `backend/tests`, `.github/workflows` | Passing code tests cannot certify external source data or native packaging |
| Transportation / water / flood / energy / governance domains | `packages`, `integrations`, `docs` | Domain completeness must be tracked by evidence-backed gates, not folder count |

## Implemented first vertical slice: geospatial station → asset → twin reference

**Input**: `tsm-console/public/data/tsm-river-gauge-locations.geojson`,
the existing *source-staged* ten-station WGS84 coordinate inventory.

**Pure deterministic projection**: `backend/app/asset_registry.py` checks
source size, GeoJSON feature/coordinate shape, WGS84 CRS, finite coordinate
ranges, unique eight-digit USGS IDs, direct official USGS station links and the
source's location-only/no-auto-poll flags. Any invalid feature rejects the entire
snapshot. A SHA-256 receipt identifies exact input bytes.

**Machine-readable export**: `schemas/regional-asset-snapshot-v1.schema.json`;
`python -m backend.app.asset_registry --output /tmp/tsm-station-assets.json`.
JSON is deterministic with no fabricated retrieval time or changing health score.
The exported file may be staged for **offline** readers, but must not be relabeled
as an observation stream, a certified vertical datum or a surveyed building.

**Read-only operator endpoints**:
- `GET /api/assets?offset=0&limit=100` — source-limited station assets.
- `GET /api/assets/USGS-03378500` — one record, EPSG:4326 location + exact receipt.
- `GET /api/twins/USGS-03378500` — typed twin *reference*, with
  `currentState=null`, `observationStatus=NOT_FETCHED`, zero invented observations,
  and no inferred river connectivity.

**Tests**: `python -m pytest backend/tests/test_asset_registry_api.py -q`.
**API**: `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8790`.
Use `curl http://127.0.0.1:8790/api/assets` on the operator workstation.
This API is *not* automatically reachable from static GitHub Pages.

## Next engineering integration gates (not implemented by this slice)

1. **True cinematic map-first experience**: validated raster DEM source/encoding,
   actual elevated terrain mesh, audited building GLB/3D Tiles with measured vs
   derived vs missing tags, source-qualified water surfaces, edge-of-domain
   imagery and GPU/VRAM profiling. Move dense engineering forms into optional HUD
   drawers; don't substitute a static generated picture for navigable terrain.
   MapLibre's terrain path requires a `raster-dem` source and `setTerrain`;
   configure source coverage before enabling it.
2. **Regional infrastructure inventory**: add vetted government bridge/road/
   utility IDs with geometries, agencies, FIPS and provenance; never use the
   prompt's imaginary Mississippi River Bridge / River County seed.
3. **IFC/BIM**: stage permitted IFC, extract GUID/IFC class, spatial CRS, units,
   placements, source hash, geometry and licensing. Use IfcOpenShell's bulk
   geometry iterator where applicable; link GUID to the same asset ID in an
   audited association table, not a guessed positional match.
4. **IoT/event stream**: optional authenticated TLS MQTT or OPC-UA adapter,
   append-only observation log, exact station+parameter+unit+datum+time+quality,
   replay/idempotency tests and event/state separation. Never expose an
   unauthenticated broker or call a missing source "stream active".
5. **State/relationships**: promote observation to the `packages/twin`
   schema only after data-fabric validation; distinguish agency-owned facts
   from derived/scenario relationships; preserve human-authority review.
6. **Release acceptance**: the 23,082-building height gate, authoritative terrain
   coverage, native `.umap`, UE5.8 Windows Shipping, Windows 11 offline startup,
   source manifest hashes, geodetic transforms, accessibility and headed
   cinematic captures each need independent evidence.

## Hard safety and deployment constraints

- **Never commit** `.env`, JWT tokens, default admin passwords, database or
  MQTT credentials. The example `tristate123`, `minio123`, `neo4j/password`
  and `change_me` credentials in the proposed generic scaffold are insecure.
- No automatic public sign-in: anonymous public reading; authenticate
  privileged writes with explicit review and authorization. Restrict PostGIS,
  Neo4j, Kafka, Mosquitto, MinIO and operator APIs to private networks.
- Do not deploy extra databases or Kubernetes merely to make the folder tree
  look complete. Add a service when a verified workload needs it.
- A checksum verifies *integrity*, not correctness. Datum, units, surveys,
  scientific calibration, approvals and privacy classification are separate.
- Preserve the public memorial route; do not confuse artistic lighting or a
  hypothetical berm sketch with real flood reduction.

## Official implementation references

- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/
- PostGIS geometry transforms: https://postgis.net/docs/ST_Transform.html
- IfcOpenShell IFC geometry/iterators: https://docs.ifcopenshell.org/ifcopenshell-python/geometry_processing.html
