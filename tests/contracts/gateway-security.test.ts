import assert from 'node:assert/strict';
import test from 'node:test';
import type { IncomingMessage } from 'node:http';
import { authenticateGatewayRequest, createGatewaySecurityConfig } from '../../apps/uacf-gateway/src/security.ts';

function request(authorization?: string): IncomingMessage {
  return { headers: authorization ? { authorization } : {} } as IncomingMessage;
}

test('gateway refuses non-loopback binding without a strong bearer token', () => {
  assert.throws(() => createGatewaySecurityConfig('0.0.0.0', undefined, ''), /required when binding beyond loopback/);
  assert.throws(() => createGatewaySecurityConfig('0.0.0.0', 'short-token', ''), /at least 32 characters/);
  assert.doesNotThrow(() => createGatewaySecurityConfig('0.0.0.0', 'a'.repeat(40), 'tsm:engineering'));
});

test('gateway never trusts client-provided permission claims', () => {
  const local = createGatewaySecurityConfig('127.0.0.1', undefined, 'tsm:engineering');
  assert.deepEqual(authenticateGatewayRequest(request(), local), { allow: [] });
  const remote = createGatewaySecurityConfig('127.0.0.1', 's'.repeat(40), 'tsm:engineering,tsm:geospatial');
  assert.equal(authenticateGatewayRequest(request(), remote), null);
  assert.equal(authenticateGatewayRequest(request('Bearer wrong'), remote), null);
  assert.deepEqual(authenticateGatewayRequest(request(`Bearer ${'s'.repeat(40)}`), remote), {
    allow: ['tsm:engineering', 'tsm:geospatial'],
  });
});

test('gateway permission configuration is normalized and deduplicated', () => {
  const config = createGatewaySecurityConfig('localhost', 't'.repeat(40), 'tsm:engineering, tsm:engineering,,tsm:hydrologic');
  assert.deepEqual(config.permissions, ['tsm:engineering', 'tsm:hydrologic']);
});
