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
  const result = await probeWebGPU({ requestAdapter: async () => null });
  assert.equal(result.status, 'adapter-unavailable');
});

test('WebGPU probe catches adapter acquisition errors', async () => {
  const result = await probeWebGPU({
    requestAdapter: async () => { throw new Error('adapter blocked'); },
  });
  assert.equal(result.status, 'adapter-unavailable');
  assert.match(result.reason ?? '', /adapter blocked/);
});

test('WebGPU probe reports device creation failure and adapter features', async () => {
  const result = await probeWebGPU({
    requestAdapter: async () => ({
      features: new Set(['timestamp-query']),
      requestDevice: async () => { throw new Error('device denied'); },
    }),
  });
  assert.equal(result.status, 'device-unavailable');
  assert.deepEqual(result.features, ['timestamp-query']);
  assert.match(result.reason ?? '', /device denied/);
});

test('WebGPU probe reports adapter metadata, device features, and limits on success', async () => {
  const device = {
    features: new Set(['timestamp-query']),
    limits: {
      maxBufferSize: 1024,
      maxStorageBufferBindingSize: 512,
      maxTextureDimension2D: 2048,
      maxTextureDimension3D: 256,
      maxComputeWorkgroupsPerDimension: 65535,
    },
    lost: new Promise(() => {}),
  };
  const result = await probeWebGPU({
    requestAdapter: async () => ({
      info: { vendor: 'test-vendor', architecture: 'test-arch', device: 'test-device', description: 'mock' },
      features: new Set(['timestamp-query']),
      requestDevice: async () => device,
    }),
  });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.features, ['timestamp-query']);
  assert.equal(result.adapterInfo?.vendor, 'test-vendor');
  assert.equal(result.limits?.maxTextureDimension3D, 256);
  assert.equal(result.device, device);
});

test('WebGPU ready label does not claim terrain workload completion', () => {
  assert.match(getWebGPUCapabilityLabel('ready'), /workload support must be validated/i);
});
