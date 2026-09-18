import { requestJson } from '../ingestion/http-client.mjs';

const DEFAULT_TOPIC = 'tsm.telemetry.v1';

function config() {
  return {
    enabled: process.env.TSM_EVENT_BUS_ENABLED === 'true',
    restUrl: String(process.env.TSM_KAFKA_REST_URL || '').replace(/\/$/, ''),
    topic: process.env.TSM_KAFKA_TOPIC || DEFAULT_TOPIC,
    username: process.env.TSM_KAFKA_USERNAME || '',
    password: process.env.TSM_KAFKA_PASSWORD || '',
  };
}

export function eventBusStatus() {
  const value = config();
  return {
    enabled: value.enabled,
    configured: Boolean(value.restUrl),
    topic: value.topic,
    authentication: Boolean(value.username && value.password),
  };
}

export async function publishTelemetryEvent(event, { request = requestJson } = {}) {
  const value = config();
  if (!value.enabled) return { ok: false, code: 'DISABLED' };
  if (!value.restUrl) return { ok: false, code: 'NOT_CONFIGURED' };
  if (!event || typeof event !== 'object') throw new TypeError('telemetry event must be an object');

  const headers = {
    'content-type': 'application/vnd.kafka.json.v2+json',
    ...(value.username && value.password
      ? { authorization: 'Basic ' + Buffer.from(value.username + ':' + value.password).toString('base64') }
      : {}),
  };
  const response = await request(
    value.restUrl + '/topics/' + encodeURIComponent(value.topic),
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ records: [{ value: event }] }),
      sourceId: 'kafka-rest-telemetry',
      timeoutMs: 5000,
      maxBytes: 500_000,
      retries: 1,
    },
  );
  return { ok: true, topic: value.topic, response };
}
