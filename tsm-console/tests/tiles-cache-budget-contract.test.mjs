import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TSM_TILES_CACHE_POLICY } from '../src/lib/tiles-cache-policy.ts';

const rendererSource = readFileSync(new URL('../src/components/OpenWorld3DTilesRenderer.tsx', import.meta.url), 'utf8');
const policySource = readFileSync(new URL('../src/lib/tiles-cache-policy.ts', import.meta.url), 'utf8');

test('3D Tiles LRU cache has explicit byte eviction thresholds', () => {
  assert.equal(TSM_TILES_CACHE_POLICY.maxCacheBytes, 512 * 1024 * 1024);
  assert.equal(TSM_TILES_CACHE_POLICY.minCacheBytes, 384 * 1024 * 1024);
  assert.ok(TSM_TILES_CACHE_POLICY.minCacheBytes < TSM_TILES_CACHE_POLICY.maxCacheBytes);
  assert.match(rendererSource, /lruCache-maxBytesSize=\{lruMaxBytes\}/);
  assert.match(rendererSource, /lruCache-minBytesSize=\{lruMinBytes\}/);
  assert.match(rendererSource, /lruMaxBytes = TSM_TILES_CACHE_POLICY\.maxCacheBytes/);
  assert.match(rendererSource, /lruMinBytes = TSM_TILES_CACHE_POLICY\.minCacheBytes/);
});

test('cache policy does not overstate byte thresholds as a hard process or GPU memory cap', () => {
  assert.match(policySource, /not a hard process or GPU-VRAM/i);
  assert.match(rendererSource, /not a hard/i);
  assert.match(rendererSource, /active tiles can remain resident over budget/i);
});
