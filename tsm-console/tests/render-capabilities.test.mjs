import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/lib/render-capabilities.ts'), 'utf8');

test('renderer capability contract prefers WebGPU then WebGL2 then Canvas 2D', () => {
  assert.match(source, /preferred:\s*webgpu \? 'WEBGPU' : webgl2 \? 'WEBGL2' : 'CANVAS_2D'/);
  assert.match(source, /export type RenderBackend = 'WEBGPU' \| 'WEBGL2' \| 'CANVAS_2D'/);
});

test('renderer capability contract exposes explicit fallback messaging', () => {
  assert.match(source, /WebGPU unavailable; using WebGL2-compatible rendering/);
  assert.match(source, /WebGPU and WebGL2 unavailable; using 2D fallback rendering/);
});
