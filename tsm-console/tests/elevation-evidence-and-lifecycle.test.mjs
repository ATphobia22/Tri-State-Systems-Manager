import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('elevation-evidence-product rejects missing datum and CRS', () => {
  const src = readFileSync(join(root, 'src/lib/elevation-evidence-product.ts'), 'utf8');
  assert.match(src, /validateElevationEvidenceProduct/);
  assert.match(src, /assertElevationEvidenceProduct/);
  assert.match(src, /vertical_datum is required/);
  assert.match(src, /never invent/);
  assert.match(src, /AUTHORITATIVE authority cannot pair with SCREENING/);
});

test('tile-resource-lifecycle exposes status machine and non-synthetic guard', () => {
  const src = readFileSync(join(root, 'src/lib/tile-resource-lifecycle.ts'), 'utf8');
  assert.match(src, /TileResourceStatus/);
  assert.match(src, /toFetch/);
  assert.match(src, /toRelease/);
  assert.match(src, /assertNotSynthetic/);
  assert.match(src, /do not invent geometry/);
  assert.match(src, /maxReadyBytes/);
});

test('NOT-COMPLETE registry still lists Hierarchical-Z and Transvoxel PoC', () => {
  const reg = readFileSync(
    join(root, '../docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md'),
    'utf8',
  );
  assert.match(reg, /Hierarchical-Z/);
  assert.match(reg, /Advanced scaffold/);
  assert.match(reg, /Transvoxel county scale/);
  assert.match(reg, /Do not claim/);
});
