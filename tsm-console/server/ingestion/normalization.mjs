import { assertSourceRecord } from './source-contracts.mjs';

export function normalizeSourceRecord(input) {
  const record = {
    ...input,
    sourceId: String(input.sourceId),
    sourceUri: String(input.sourceUri),
    // Preserve the provider's timestamp representation for provenance fidelity.
    // Date.parse validation remains enforced by assertSourceRecord.
    observedAt: String(input.observedAt),
    retrievedAt: new Date(input.retrievedAt).toISOString(),
  };
  assertSourceRecord(record);
  return Object.freeze(record);
}

export function normalizeUnavailableSource({ sourceId, sourceUri, retrievedAt = new Date().toISOString(), reason }) {
  return normalizeSourceRecord({
    sourceId,
    sourceUri,
    observedAt: retrievedAt,
    retrievedAt,
    status: 'unavailable',
    dataClass: 'observation',
    unit: 'unknown',
    crs: 'unknown',
    verticalDatum: 'unknown',
    provenance: { provider: sourceId.split('-')[0] || 'unknown', reason },
  });
}
