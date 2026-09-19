import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const renderer = readFileSync(
  new URL('../src/gpu/open-world-raytracer.ts', import.meta.url),
  'utf8',
);
const shader = readFileSync(
  new URL('../src/gpu/photorealTerrain.wgsl', import.meta.url),
  'utf8',
);

test('WebGPU renderer is source-bound and has no fabricated texture fallback', () => {
  assert.match(renderer, /WebGpuTerrainSource/);
  assert.match(renderer, /provenanceHashSha256/);
  assert.doesNotMatch(renderer, /createDummyTexture/);
  assert.doesNotMatch(renderer, /375\.0/);
  assert.doesNotMatch(renderer, /379\.8/);
});

test('WebGPU shader does not embed project elevations or datum assumptions', () => {
  assert.doesNotMatch(shader, /375\.0/);
  assert.doesNotMatch(shader, /377\.2/);
  assert.doesNotMatch(shader, /382\.5/);
  assert.match(shader, /vertical datum/i);
});

test('WebGPU shader keeps rendering transient and parameterized', () => {
  assert.match(shader, /waterScaleOffsetMaxDistance/);
  assert.match(shader, /resolution/);
  assert.doesNotMatch(shader, /storage/);
});
