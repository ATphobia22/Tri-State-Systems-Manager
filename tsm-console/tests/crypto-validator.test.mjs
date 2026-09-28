import test from 'node:test';
import assert from 'node:assert/strict';
import { signTelemetryPacket, verifyTelemetryPacket, ZERO_HASH } from '../server/compliance/crypto-validator.mjs';

test('telemetry packet signs and verifies deterministically', () => {
  const packet = signTelemetryPacket({
    station_id: 'USGS_03378500',
    value: 4.5,
    operator_id: 'service:test',
    timestamp: '2026-09-27T20:00:00Z',
  }, ZERO_HASH);
  assert.equal(verifyTelemetryPacket(packet), true);
  assert.equal(packet.parent_hash, ZERO_HASH);
  assert.match(packet.sha256_hash, /^[a-f0-9]{64}$/);
});

test('tampering invalidates telemetry signature', () => {
  const packet = signTelemetryPacket({
    station_id: 'USGS_03378500',
    value: 4.5,
    operator_id: 'service:test',
    timestamp: '2026-09-27T20:00:00Z',
  });
  assert.equal(verifyTelemetryPacket({ ...packet, value: 5.5 }), false);
});
