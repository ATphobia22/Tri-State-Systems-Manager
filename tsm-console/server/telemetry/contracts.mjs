import { createHash, randomUUID } from 'node:crypto';

const TEMPORAL_CLASSES = new Set(['OBSERVED', 'FORECAST', 'DERIVED', 'MODEL_OUTPUT']);
const QUALITY_STATUS = new Set(['CURRENT', 'PROVISIONAL', 'APPROVED', 'ESTIMATED', 'UNAVAILABLE']);
const FRESHNESS = new Set(['LIVE', 'FRESH', 'STALE', 'SOURCE_UNAVAILABLE']);

export function sha256Canonical(value) {
  const canonical = JSON.stringify(value, Object.keys(value).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export function createTelemetryEnvelope({ source, station, parameter, value, observedAt, receivedAt = new Date().toISOString(), temporalClass = 'OBSERVED', gageDatum = null, verticalDatum = null, horizontalCrs = 'EPSG:4326', quality = 'CURRENT', freshnessState = 'LIVE', qualifiers = [], upstreamLastModified = null }) {
  if (!source?.provider || !source?.sourceId || !source?.sourceUri) throw new TypeError('telemetry source identity is required');
  if (!station?.id || !parameter?.code || !parameter?.name || !parameter?.unit) throw new TypeError('station and parameter identity are required');
  if (!Number.isFinite(Number(value))) throw new TypeError('telemetry value must be finite');
  if (!TEMPORAL_CLASSES.has(temporalClass) || !QUALITY_STATUS.has(quality) || !FRESHNESS.has(freshnessState)) throw new TypeError('invalid telemetry enum');
  const observation = { value: Number(value), observedAt: new Date(observedAt).toISOString(), receivedAt: new Date(receivedAt).toISOString(), temporalClass, gageDatum, verticalDatum, horizontalCrs };
  const envelope = {
    schemaVersion: '1.0', source, station, parameter, observation,
    provenance: { retrievalId: randomUUID(), retrievedAt: observation.receivedAt, contentHashSha256: '', upstreamLastModified },
    quality: { status: quality, freshnessState, qualifiers: [...qualifiers] },
  };
  envelope.provenance.contentHashSha256 = sha256Canonical({ source, station, parameter, observation, quality: envelope.quality });
  return Object.freeze(envelope);
}

export function assertTelemetryEnvelope(envelope) {
  if (!envelope || envelope.schemaVersion !== '1.0') throw new TypeError('unsupported telemetry schemaVersion');
  if (!envelope.provenance?.contentHashSha256 || !/^[0-9a-f]{64}$/.test(envelope.provenance.contentHashSha256)) throw new TypeError('invalid telemetry provenance hash');
  if (!TEMPORAL_CLASSES.has(envelope.observation?.temporalClass)) throw new TypeError('invalid telemetry temporalClass');
  if (!QUALITY_STATUS.has(envelope.quality?.status) || !FRESHNESS.has(envelope.quality?.freshnessState)) throw new TypeError('invalid telemetry quality state');
  if (!Number.isFinite(envelope.observation?.value)) throw new TypeError('telemetry value must be finite');
  return envelope;
}
