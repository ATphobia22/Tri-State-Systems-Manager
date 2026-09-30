import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(relative) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));
}

test('spatial runtime fabric defines vendor-neutral render planes', () => {
  const c = load('architecture/contracts/spatial-runtime-fabric-v1.json');
  assert.deepEqual(c.renderPlanes.model3d.formats, ['3D Tiles', 'glTF', 'GLB']);
  assert.equal(c.simulationBoundary.orchestrator, 'deterministic');
});

test('AWS adapter remains reference-only and non-authoritative', () => {
  const c = load('architecture/contracts/aws-spatial-capability-adapter-v1.json');
  assert.equal(c.status, 'REFERENCE_ADAPTER');
  assert.ok(Array.isArray(c.nonGoals));
});

test('spatial layer manifest prevents visualization from becoming evidence', () => {
  const c = load('architecture/contracts/spatial-layer-manifest-v1.json');
  assert.equal(c.authorityRules.visualizationCannotPromoteToEvidence, true);
  assert.equal(c.authorityRules.simulationOutputRequiresInputAndResultHashes, true);
});
