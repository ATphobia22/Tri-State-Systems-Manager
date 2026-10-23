import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWebGPUCapabilityLabel, probeWebGPU } from '../src/lib/webgpu-capabilities.ts';

test('WebGPU probe reports unsupported when API is absent', async () => {
  const result = await probeWebGPU(null);
  assert.equal(result.status, 'unsupported');
  assert.deepEqual(result.features, []);
  assert.match(result.reason ?? '', /unavailable/i);
});

test('WebGPU probe distinguishes missing adapter from unsupported API', async () => {
  const result = await probeWebGPU({
    requestAdapter: async () => null,
  } as unknown as GPU);
  assert.equal(result.status, 'adapter-unavailable');
});

test('WebGPU probe catches adapter acquisition errors', async () => {
  const result = await probeWebGPU({
    requestAdapter: async () => { throw new Error('adapter blocked'); },
  } as unknown as GPU);
  assert.equal(result.status, 'adapter-unavailable');
  assert.match(result.reason ?? '', /adapter blocked/);
});

test('WebGPU probe reports device creation failure and adapter features', async () => {
  const result = await probeWebGPU({
    requestAdapter: async () => ({
      features: new Set(['timestamp-query']),
      requestDevice: async () => { throw new Error('device denied'); },
    }),
  } as unknown as GPU);
  assert.equal(result.status, 'device-unavailable');
  assert.deepEqual(result.features, ['timestamp-query']);
  assert.match(result.reason ?? '', /device denied/);
});

test('WebGPU ready label does not claim terrain workload completion', () => {
  assert.match(getWebGPUCapabilityLabel('ready'), /workload support must be validated/i);
});
