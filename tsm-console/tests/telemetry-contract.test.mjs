import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTelemetryEnvelope, assertTelemetryEnvelope } from '../server/telemetry/contracts.mjs';
import { createWebSocketUpgradeResponse, createTelemetryWebSocketRouter } from '../server/telemetry/websocket-router.mjs';

test('canonical telemetry envelope preserves observation and provenance semantics', () => {
  const envelope = createTelemetryEnvelope({
    source: { provider: 'USGS Water Data API', sourceId: 'USGS-NWIS-03378500-00065', sourceUri: 'https://api.waterdata.usgs.gov/' },
    station: { id: '03378500', name: 'Wabash River at New Harmony' },
    parameter: { code: '00065', name: 'gage height', unit: 'ft' },
    value: 4.5,
    observedAt: '2026-09-14T15:00:00Z',
    temporalClass: 'OBSERVED',
    gageDatum: 'GAGE_DATUM',
    quality: 'PROVISIONAL',
    freshnessState: 'LIVE',
  });
  assertTelemetryEnvelope(envelope);
  assert.equal(envelope.observation.temporalClass, 'OBSERVED');
  assert.equal(envelope.quality.status, 'PROVISIONAL');
  assert.match(envelope.provenance.contentHashSha256, /^[0-9a-f]{64}$/);
});

test('websocket handshake emits a valid 101 response', () => {
  const response = createWebSocketUpgradeResponse('dGhlIHNhbXBsZSBub25jZQ==');
  assert.match(response, /^HTTP\/1\.1 101 Switching Protocols/m);
  assert.match(response, /Sec-WebSocket-Accept:/);
});

test('websocket router enforces envelope validation before publication', () => {
  const router = createTelemetryWebSocketRouter();
  assert.equal(router.size(), 0);
  assert.throws(() => router.publish({ schemaVersion: '0.0' }), /unsupported telemetry schemaVersion/);
});
