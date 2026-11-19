import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate5dManifest } from '../../scripts/ci/validate-5d-scene-manifest.mjs';

const example = JSON.parse(readFileSync(new URL('../../data/schemas/examples/tsm-5d-scene-manifest-v1.example.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(example);

test('source-only example is valid but never promoted', () => {
  assert.deepEqual(validate5dManifest(example), []);
  assert.equal(example.releaseGate, 'NOT_VALIDATED');
  assert.ok(example.layers.every(l => l.state === 'SOURCE_DISCOVERED'));
});
test('rejects a simulated engineering validated layer without raw bytes and exact county evidence', () => {
  const m = copy();
  m.layers[0].state = 'ENGINEERING_VALIDATED';
  const errors = validate5dManifest(m).join(' ');
  assert.match(errors, /SHA-256/);
  assert.match(errors, /exact county polygon/);
  assert.match(errors, /validation evidence/);
});
test('rejects fictional overall completion', () => {
  const m = copy();
  m.releaseGate = 'ENGINEERING_VALIDATED';
  assert.match(validate5dManifest(m).join(' '), /every nonempty layer/);
});
test('rejects duplicate source IDs and out-of-scope counties', () => {
  const m = copy();
  m.countyGeoids = ['18129','99999'];
  m.layers[1].id = m.layers[0].id;
  const errors = validate5dManifest(m).join(' ');
  assert.match(errors, /countyGeoids/);
  assert.match(errors, /duplicate id/);
});
test('rejects regulatory effective status without validation', () => {
  const m = copy();
  m.layers[0].regulatoryStatus = 'VERIFIED_EFFECTIVE';
  assert.match(validate5dManifest(m).join(' '), /regulatory claim/);
});
