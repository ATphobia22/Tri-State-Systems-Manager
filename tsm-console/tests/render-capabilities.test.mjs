import assert from 'node:assert/strict';
import test from 'node:test';

test('renderer capability contract selects WebGPU first', async () => {
  const source = await import('../src/lib/render-capabilities.ts');
  const capabilities = source.detectRenderCapabilities({ gpu: {}, getContext: () => ({}) });
  assert.equal(capabilities.preferred, 'WEBGPU');
});

test('renderer capability contract falls back to WebGL2', async () => {
  const source = await import('../src/lib/render-capabilities.ts');
  const capabilities = source.detectRenderCapabilities({ getContext: (id) => id === 'webgl2' ? {} : null });
  assert.equal(capabilities.preferred, 'WEBGL2');
});

test('renderer capability contract falls back to Canvas 2D', async () => {
  const source = await import('../src/lib/render-capabilities.ts');
  const capabilities = source.detectRenderCapabilities({ getContext: () => null });
  assert.equal(capabilities.preferred, 'CANVAS_2D');
});
