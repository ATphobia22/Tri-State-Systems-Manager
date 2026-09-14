const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function classifyFreshness(observedAt, nowMs = Date.now(), maxAgeSeconds = 900) {
  if (typeof observedAt !== 'string' || !ISO_INSTANT.test(observedAt)) return 'stale';
  const ageMs = nowMs - Date.parse(observedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'stale';
  return ageMs <= maxAgeSeconds * 1000 ? 'current' : 'stale';
}

export function normalizeRiverObservation(input) {
  if (!input || typeof input !== 'object') throw new TypeError('observation must be an object');
  if (typeof input.stationId !== 'string' || input.stationId.length === 0) throw new TypeError('stationId is required');
  if (typeof input.provider !== 'string' || input.provider.length === 0) throw new TypeError('provider is required');
  if (typeof input.sourceUri !== 'string' || !input.sourceUri.startsWith('https://')) throw new TypeError('sourceUri is required');
  if (typeof input.unit !== 'string' || input.unit.length === 0) throw new TypeError('unit is required');
  if (!Number.isFinite(input.value)) throw new TypeError('value must be finite');
  if (typeof input.observedAt !== 'string' || !ISO_INSTANT.test(input.observedAt)) throw new TypeError('observedAt must be an ISO UTC instant');
  if (typeof input.retrievedAt !== 'string' || !ISO_INSTANT.test(input.retrievedAt)) throw new TypeError('retrievedAt must be an ISO UTC instant');

  return Object.freeze({
    stationId: input.stationId,
    provider: input.provider,
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    value: input.value,
    unit: input.unit,
    parameterCode: typeof input.parameterCode === 'string' ? input.parameterCode : null,
    qualifier: typeof input.qualifier === 'string' ? input.qualifier : null,
    provisional: input.qualifier === 'P' || input.provisional === true,
    verticalDatum: typeof input.verticalDatum === 'string' ? input.verticalDatum : null,
    sourceUri: input.sourceUri,
  });
}
