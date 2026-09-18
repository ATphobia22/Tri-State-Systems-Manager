import assert from 'node:assert/strict';
import test from 'node:test';
import { eventBusStatus, publishTelemetryEvent } from '../server/telemetry/event-bus.mjs';

test('event bus is fail-closed when disabled', async () => {
  const previous = process.env.TSM_EVENT_BUS_ENABLED;
  delete process.env.TSM_EVENT_BUS_ENABLED;
  const result = await publishTelemetryEvent({ type: 'test' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DISABLED');
  if (previous === undefined) delete process.env.TSM_EVENT_BUS_ENABLED;
  else process.env.TSM_EVENT_BUS_ENABLED = previous;
});

test('event bus reports configuration without exposing credentials', () => {
  process.env.TSM_EVENT_BUS_ENABLED = 'true';
  process.env.TSM_KAFKA_REST_URL = 'https://kafka.example.invalid';
  process.env.TSM_KAFKA_TOPIC = 'tsm.telemetry.v1';
  process.env.TSM_KAFKA_USERNAME = 'user';
  process.env.TSM_KAFKA_PASSWORD = 'secret';
  const status = eventBusStatus();
  assert.deepEqual(status, { enabled: true, configured: true, topic: 'tsm.telemetry.v1', authentication: true });
  delete process.env.TSM_EVENT_BUS_ENABLED;
  delete process.env.TSM_KAFKA_REST_URL;
  delete process.env.TSM_KAFKA_TOPIC;
  delete process.env.TSM_KAFKA_USERNAME;
  delete process.env.TSM_KAFKA_PASSWORD;
});

test('event bus publishes Kafka REST Proxy compatible JSON envelope', async () => {
  process.env.TSM_EVENT_BUS_ENABLED = 'true';
  process.env.TSM_KAFKA_REST_URL = 'https://kafka.example.invalid';
  process.env.TSM_KAFKA_TOPIC = 'tsm.telemetry.v1';
  let captured;
  const result = await publishTelemetryEvent({ type: 'stage', value: 12.3 }, {
    request: async (url, options) => { captured = { url, options }; return { offsets: [{ partition: 0, offset: 1 }] }; },
  });
  assert.equal(result.ok, true);
  assert.equal(captured.url, 'https://kafka.example.invalid/topics/tsm.telemetry.v1');
  assert.match(captured.options.headers['content-type'], /application\/vnd\.kafka\.json\.v2\+json/);
  assert.deepEqual(JSON.parse(captured.options.body), { records: [{ value: { type: 'stage', value: 12.3 } }] });
  delete process.env.TSM_EVENT_BUS_ENABLED;
  delete process.env.TSM_KAFKA_REST_URL;
  delete process.env.TSM_KAFKA_TOPIC;
});
