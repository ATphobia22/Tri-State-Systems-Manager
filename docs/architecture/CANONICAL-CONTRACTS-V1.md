# TSM Canonical Contracts v1.0.0 — Proposed

**Scope:** schema-first foundation; no service or storage migrations in this PR.
This is an AAS-inspired asset shell, not an IEC 63278-compliant AAS implementation.

## Contract order
Canonical schemas → events → service contracts → storage → implementations.

## Invariants
- Government sources retain authority over original observations, elevation, flood maps and legal determinations. The TSM event store is the authoritative record of **accepted TSM events** only.
- Event `version` is the monotonically increasing aggregate sequence number; `schemaVersion` is the wire contract version. A producer must not silently reorder, rewrite or reuse aggregate versions.
- Producers supply stable `eventId`; consumers deduplicate by `eventId` and by `(aggregateType, aggregateId, version)`. Enforce these independently in database unique constraints.
- `occurredAt` denotes source event time; `recordedAt` is ingestion time. Replay must use persisted event order and version, not sort by source timestamps alone.
- An observation's `verticalDatum` is descriptive evidence, not an implicit conversion. Gage datum and NAVD88 are distinct; derived elevations require an independently verified gage zero, geoid model and coordinate epoch.
- An `evidenceId` references immutable raw bytes with an independently computed SHA-256. Review status is distinct from raw source validity; retain rejected evidence.
- Simulation outputs are derived events, never observational authority; no HEC-RAS direct event-store writes.
- The public viewer uses read projections only. Windows 11 native offline uses packaged, hash-verified snapshots; no WebSocket, localhost or server dependency.
- Breaking contract changes require a new major schema path and explicit migration/compatibility tests. Do not repurpose a field.

## API boundary proposals (not implemented)
- Private write: `POST /ingest/observation`, `POST /ingest/forecast`, `POST /event`
- Private replay/control: `POST /rebuild`, `GET /replay/jobs`
- Public read: `GET /hydrology/current`, `GET /assets/current`, `GET /evidence/{id}`, `GET /stac/collections`
- Tiles: `GET /tiles/buildings`, `GET /tiles/terrain`; these must resolve to immutable, versioned manifests, not imply all features are engineering-validated.
- Optional connected live stream: `/ws/twin` (never required by the native offline executable).

## MVP acceptance
Official USGS response → immutable raw evidence → normalized observation → validated ObservationReceived event → idempotent event store → deterministic projection → Cesium read model → STAC reference → historical query → replay and rebuild with identical hash receipts.

## Validation
`python -m pip install 'jsonschema[format]>=4.22,<5'`
`python -m unittest discover -s tests -p test_canonical_contracts.py -v`

This PR only provides schemas, examples and tests. It does **not** establish deployed Kafka, PostGIS, pgSTAC, live USGS capture, UE Shipping, or end-to-end MVP acceptance.
