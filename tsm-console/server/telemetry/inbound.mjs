import crypto from 'node:crypto';

function expectedAuthorization() {
  const username = process.env.TSM_EVENT_INGEST_USERNAME;
  const password = process.env.TSM_EVENT_INGEST_PASSWORD;
  if (!username || !password) return null;
  return 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
}

export function validateTelemetryIngress(req) {
  const expected = expectedAuthorization();
  if (!expected) return { ok: false, status: 503, code: 'EVENT_INGEST_NOT_CONFIGURED' };
  const actual = String(req.headers.authorization || '');
  const valid = actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  if (!valid) return { ok: false, status: 401, code: 'EVENT_INGEST_UNAUTHORIZED' };
  return { ok: true };
}

export function normalizeTelemetryEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('telemetry event must be an object');
  const eventId = typeof body.event_id === 'string' ? body.event_id : '';
  const eventType = typeof body.event_type === 'string' ? body.event_type : '';
  const sourceId = typeof body.source_id === 'string' ? body.source_id : '';
  const observedAt = typeof body.observed_at === 'string' ? body.observed_at : '';
  if (!eventId || !eventType || !sourceId || !observedAt) throw new Error('event_id, event_type, source_id and observed_at are required');
  const parsedTime = Date.parse(observedAt);
  if (!Number.isFinite(parsedTime)) throw new Error('observed_at must be an ISO-8601 timestamp');
  return {
    schema_version: typeof body.schema_version === 'string' ? body.schema_version : 'tsm.telemetry.v1',
    event_id: eventId,
    event_type: eventType,
    source_id: sourceId,
    observed_at: new Date(parsedTime).toISOString(),
    received_at: new Date().toISOString(),
    payload: body.payload && typeof body.payload === 'object' ? body.payload : body,
  };
}
