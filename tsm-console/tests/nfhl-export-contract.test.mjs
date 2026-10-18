import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CANONICAL = [28, 27, 16, 23, 34, 3, 22, 32];

test('nfhl-export builds MapServer export with priority show layers', () => {
  const src = readFileSync(
    join(root, 'tsm-console/src/lib/nfhl/nfhl-export.ts'),
    'utf8',
  );
  assert.match(src, /buildNfhlExportImageUrl/);
  assert.match(src, /poseyNfhlPriorityExportUrl/);
  assert.match(src, /POSEY_BBOX_WGS84/);
  assert.match(src, /NFHL_PRIORITY_IDS/);
  assert.match(src, /MapServer\/export/);
  assert.match(src, /show:/);
  assert.match(src, /bboxSR.*4326/);
});

test('map-layers fema-nfhl uses registry priority ids', () => {
  const src = readFileSync(
    join(root, 'tsm-console/src/lib/map-layers.ts'),
    'utf8',
  );
  assert.match(src, /from '\.\/nfhl\/NfhlLayerRegistry'/);
  assert.match(src, /NFHL_PRIORITY_IDS/);
  assert.match(src, /fema-nfhl-zones/);
  assert.match(src, /arcgisLayerId: 28/);
  assert.match(src, /arcgisLayerId: 27/);
  assert.match(src, /arcgisLayerId: 16/);
  assert.match(src, /arcgisLayerId: 23/);
  assert.match(src, /arcgisLayerId: 34/);
});

test('priority show param string matches canonical order', () => {
  const reg = readFileSync(
    join(root, 'tsm-console/src/lib/nfhl/NfhlLayerRegistry.ts'),
    'utf8',
  );
  const m = reg.match(/NFHL_PRIORITY_IDS[^=]*=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(m);
  const nums = m[1].match(/\d+/g)?.map(Number) ?? [];
  assert.deepEqual(nums, CANONICAL);
  assert.equal(nums.join(','), '28,27,16,23,34,3,22,32');
});
