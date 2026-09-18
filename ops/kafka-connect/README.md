# Kafka Connect → TSM Telemetry

TSM supports an event-driven ingress path for radar/sensor telemetry:

Kafka topic → Confluent HTTP Sink Connector → HTTPS POST /api/telemetry/events → TSM EvidenceArtifact

The HTTP Sink connector is documented by Confluent as a Kafka Connect sink that consumes Kafka records and sends them to an HTTP/HTTPS API. It supports JSON bodies, retries, and Basic/OAuth2 authentication.

## Topic contract

- Topic: `tsm.telemetry.v1`
- Required event fields: `event_id`, `event_type`, `source_id`, `observed_at`
- Optional: `schema_version`, `payload`
- Delivery: at-least-once
- Duplicate handling: TSM keeps a bounded in-process event-id cache; durable deduplication should also be configured in the backing evidence store before claiming exactly-once semantics.

## Security

1. Use HTTPS only.
2. Keep `TSM_EVENT_INGEST_USERNAME` and `TSM_EVENT_INGEST_PASSWORD` in the connector secret manager, never in Git.
3. Restrict the connector to `POST /api/telemetry/events`.
4. Restrict the TSM API ingress network path to the Kafka Connect workers or trusted reverse proxy.
5. Rotate credentials without changing topic schemas.
6. Preserve connector error/dead-letter topics.

## Installation

Install a supported version of Confluent's HTTP Sink Connector on every Kafka Connect worker. The repository does not install a third-party connector binary automatically.

Copy `tsm-telemetry-http-sink.json` to the deployment system and replace:

- `REPLACE_WITH_TSM_API_HOST`
- the credential placeholders using the deployment platform's secret/config provider.

Do not commit the resulting secret-bearing configuration.

## Important boundary

This is an event-driven ingress architecture. It does not make the incoming radar/sensor record a FEMA, USGS, NOAA, or engineering authority determination. The original source authority and provenance must travel inside the event payload.
