# Ohio–Wabash living twin runtime

This connected runtime stores state revisions as sparse PostGIS entities. It provides versioned Kafka ingestion, an append-only evidence graph, a retryable transaction outbox, pgSTAC publication, temporal snapshots, and a read-only Cesium change feed. Deploy it separately from the offline Windows desktop.

```mermaid
flowchart TD
    A["Source adapters"] --> B["Redpanda Avro ingress"]
    B --> C["Validate and ingest"]
    C --> D["PostGIS revision, audit and outbox"]
    D --> E["Retryable relay"]
    E --> F["pgSTAC assets"]
    E --> G["Redpanda change events"]
    D --> H["Temporal and live API"]
    H --> I["Cesium"]
```

## Matrix identifiers

| Matrix | Identity and state |
|---|---|
| S | Spatial cell or feature ID, optional GeoJSON position, state class and attributes |
| O | Observation identity, sensor, parameter, value, unit, quality and vertical reference |
| H | Reach identity, optional stage, discharge, velocity, depth, width or volume |
| T | Tile or terrain identity, horizontal CRS, vertical datum and units |
| I | Infrastructure identity and asset type |
| B | Building identity and source OBJECTID |
| R | Reality-capture mission identity and capture ID |
| M | Simulation identity, model engine and revision |
| V | Validation identity, metric, sample count, units, withheld/fit/unknown and lineage |
| P | Provenance statement identity and artifact lineage |
| U | Uncertainty estimate identity, method and units |
| E | Evidence artifact or review identity and associated source |
| TT | Temporal context identity; all entities also use effective and knowledge time |
| RR | Community metric identity, community ID and method |
| SYNC | Source synchronization status identity and adapter cadence metadata |
| D | Human decision identity, reviewer, review time, disposition and evidence link |

Every record has an entity ID, matrix, timeline, branch, effective timestamp, source authority, source URI, retrieval timestamp and SHA-256. Geometry uses longitude and latitude in EPSG:4326. The state document gives the reference for any vertical measurements. Unknown states stay null or absent. A gauge stage is specific to its gauge reference and requires reviewed datum conversion before comparison to NAVD88 elevation. Assets and decisions enter from trusted, reviewed publishers. The runtime records their claims and never grants engineering or regulatory approval.

## Run and test

Use Docker with Compose v2. From this directory:

```sh
docker compose up --build -d
docker compose --profile test run --rm tests
```

The default development services bind exposed ports to loopback. The API is at `http://localhost:18000/docs`, Schema Registry at `http://localhost:18081` and Grafana at `http://localhost:13000/d/tsm-living-twin`. Prometheus scrapes bounded-cardinality service metrics. Tempo receives OTLP traces for API, ingestion and relay spans. W3C trace headers flow through Kafka and the outbox. Compose is a single-broker local deployment with fixed development credentials. For wider deployment, provide organizational TLS, network policy, credentials, Kafka ACLs, backups and a publication review before exposing any data.

Publish a validated JSON file with local Python dependencies and the default host ports:

```sh
python -m pip install -r requirements.txt
python -m twin.publish ./update.json
```

To replay an existing river pilot capture into the observation matrix, pass its extracted snapshot directory containing `manifest.json` and station GeoJSON files:

```sh
python -m twin.import_usgs ./river-snapshot
```

This importer verifies each source hash and preserves series, observation time, units and approval status. It preserves gauge-relative stage and emits stable UUIDs when replaying the same capture. Schedule it alongside the capture workflow when running a connected deployment.

Schema files are in `schemas/`. The wire codec validates with the JSON Schema and Avro schema, then uses Redpanda's registry and the Confluent wire format. The ingress and change subjects are `tsm.twin.state-update.v1-value` and `tsm.twin.state-change.v1-value`. Both use `FULL_TRANSITIVE`. Compatible wire changes add fields with defaults and preserve old names and types. Validate proposed changes against all deployed readers and writers. New timeline, matrix or operation semantics require a coordinated version bump when existing readers would reject them. Breaking changes use new topics, subjects and a documented migration.

The key is `timeline/branch/matrix/entity_id`. Ingress uses one partition in v1. Submit referenced evidence first so causal relationships have a deterministic ordering. The producer must reuse the same UUID and body on an ambiguous retry. Reuse of an ID with different content is rejected. The consumer acknowledges offsets after the database transaction or acknowledged dead-letter publication. A transient failure leaves the offset replayable. The JSON dead-letter contract preserves original topic, partition, offset and SHA-256 without copying source data.

Outbox dispatch is at least once. Consumers deduplicate change events by event ID. Outbox retries can reorder Kafka publication, so use the API's committed sequence for ordered replay. pgSTAC uses the event UUID as the immutable item ID and upserts the catalog item and delivery receipt together. The asset URI is retained as a locator. Publication does not download it or independently verify its asset hash. Separate delivery rows keep a Kafka failure from discarding pgSTAC work.

## Replay and spatial rendering

- `GET /v1/snapshot` resolves the latest visible revision for each identity at `valid_at` and `known_at`. Use the returned timestamps, watermark and pagination keys for subsequent pages. Late corrections preserve the earlier state at its original knowledge time. Retire events remove the entity from snapshots at and after the effective timestamp.
- `GET /v1/changes?after=0` pages the commit-ordered history. `WS /v1/live?after=<cursor>` resumes the same feed after a disconnect. Consumers store the last applied sequence. These APIs expose submitted data, so feed only public-authorized records to this instance.
- `GET /v1/cesium?bbox=-88.2,37.6,-87.4,38.4` returns GeoJSON for the observed timeline, with pagination and source provenance. `cesium-live.mjs` can bind an existing viewer to the feed. Set `CESIUM_ORIGINS` to the viewer origin when cross-origin access is required.
- The relay refreshes the indexed `twin.current_state` and `twin.matrix_counts` materialized views about every 15 seconds. The snapshot endpoint reads revision history directly.

The regional state schema can accept evidence from USGS, NOAA, FEMA, USACE, state agencies and reality capture. Continuous agency adapters, calibrated models, exact regional coverage and review policy remain separate inputs. A single health score is intentionally left to a reviewed metric definition with valid sample coverage and normalization.

## Schema changes and rollback

Run `alembic upgrade head` with `DATABASE_URL` set. The SQL sources are in `migrations/sql`. Use `alembic upgrade head --sql` to inspect the upgrade without connecting. `alembic downgrade base` removes the twin schema and its history while retaining shared PostGIS and pgSTAC. Run only on a database you intend to reset, or after backing up the twin schema. The integration suite tests downgrade on an isolated database.

## Twin State API and replay

The CQRS API runs separately at `http://127.0.0.1:18001/docs`. The original port 18000 API still serves raw event history. The kernel advances the current projection from committed PostGIS sequences. Kafka delivery timing is independent of that checkpoint.

| Endpoint | Read model |
| --- | --- |
| `GET /twin/current/hydrology` | Current reach revisions and a separate list of latest gauge observations by sensor, parameter and series |
| `GET /twin/current/buildings`, `GET /twin/current/terrain` | Current entity revisions with optional EPSG:4326 bounding box |
| `GET /twin/current?matrix=V` | Current records by matrix, including validation and simulation results |
| `GET /twin/time/{valid_at}` | Effective-time replay with optional knowledge time, timeline, branch and bounds |
| `GET /cesium/live/{layer}?bbox=...` | Projected GeoJSON for buildings, hydrology or infrastructure |
| `WS /twin/live?after={seq}` | Ordered commit notifications through the projection watermark |

Current responses include `watermark`, `view_version` and `next_after`. Send both `next_after` as `after` and `view_version` on the next request. A 409 means the view changed, so restart from page one. The WebSocket sends committed revisions as invalidations. Reload the appropriate projection after an update because a late historical revision may leave current state unchanged. Redis caches results by the projection instance, generation, and sequence. The state API reads from PostGIS if Redis is unavailable.

The projection is idempotent by committed event sequence. Within each observed identity, later effective time wins and the higher commit sequence breaks effective-time ties. Tombstones prevent a late older record from resurrecting a retired entity. Forecast and scenario results remain queryable through time travel in their own timelines. Gauge observations retain their original units, quality, and datum reference.

For local rebuild operations, set a secret `TWIN_REBUILD_TOKEN` before starting Compose. Rebuild endpoints are disabled when it is unset. The admin POST and status requests require `Authorization: Bearer ...`. A POST also requires an `Idempotency-Key` header containing a UUID.

```sh
curl --fail -X POST http://127.0.0.1:18001/rebuild/projections \
  -H "Authorization: Bearer $TWIN_REBUILD_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)"
```

Poll `GET /rebuild/jobs/{job_id}` with the same authorization. Projection rebuilds replace the projection and checkpoint in one transaction. Readers see the previous complete state until the rebuild commits. `POST /rebuild/stac` requeues the existing asset revisions for pgSTAC via the existing outbox. A completed STAC rebuild job means requeueing committed. The relay performs catalog delivery asynchronously. Rebuilds do not write source events or create Kafka messages. Use a fresh UUID for a new rebuild and reuse the original UUID for request retries.

The kernel coordinates replay and projection. The existing ingress consumer owns event writes, and the existing relay owns Kafka and pgSTAC delivery. Simulation and validation workers can publish results through the existing event contract. This service does not launch HEC-RAS or adjudicate engineering decisions.
