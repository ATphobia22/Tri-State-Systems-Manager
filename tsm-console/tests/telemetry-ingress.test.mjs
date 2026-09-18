import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTelemetryEvent } from '../server/telemetry/inbound.mjs';

test('telemetry ingress normalizes and validates event identity', () => {
  const event = normalizeTelemetryEvent({
    event_id: 'evt-1',
    event_type: 'weather_radar',
    source_id: 'radar-KVWX',
    observed_at: '2026-09-18T00:00:00Z',
    payload: { reflectivity_dbz: 42 },
  });
  assert.equal(event.schema_version, 'tsm.telemetry.v1');
  assert.equal(event.observed_at, '2026-09-18T00:00:00.000Z');
  assert.equal(event.payload.reflectivity_dbz, 42);
});

test('telemetry ingress rejects missing event identity', () => {
  assert.throws(() => normalizeTelemetryEvent({ event_type: 'weather_radar' }));
});
