import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/river-gauges.ts', import.meta.url), 'utf8');
const board = await readFile(new URL('../src/components/RiverGaugeBoard.tsx', import.meta.url), 'utf8');

test('community gauge registry includes the primary Wabash and Ohio observations', () => {
  assert.match(source, /03378500/);
  assert.match(source, /03322000/);
  assert.match(source, /03399800/);
  assert.match(source, /03303280/);
  assert.match(source, /03612600/);
});

test('runtime gauge client preserves provenance and fails closed', () => {
  assert.match(source, /observedAt/);
  assert.match(source, /retrievedAt/);
  assert.match(source, /provisional/);
  assert.match(source, /status: definition\.status === 'active' \? 'unavailable' : 'candidate'/);
  assert.match(source, /isFresh\(observedAt, nowMs, maxAgeMs\) \? 'current' : 'stale'/);
});

test('river gauge board uses explicit on-demand snapshots and never polls', () => {
  assert.match(board, /on-demand live snapshots/);
  assert.match(board, /No automatic polling/);
  assert.match(board, /Fetch live snapshot/);
  assert.match(board, /const fetchSnapshot = useCallback/);
  assert.match(board, /nothing is\s*\n?\s*fabricated/);
  assert.match(board, /aria-labelledby/);
  assert.doesNotMatch(board, /setInterval/);
});
