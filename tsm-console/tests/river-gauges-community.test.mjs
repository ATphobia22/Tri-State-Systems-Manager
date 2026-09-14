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
  assert.match(source, /status: 'unavailable'/);
  assert.match(source, /status: isFresh/);
});

test('elder-friendly board clearly separates observations from predictions', () => {
  assert.match(board, /Real-time government observations/);
  assert.match(board, /not predictions/);
  assert.match(board, /STALE/);
  assert.match(board, /SOURCE UNAVAILABLE/);
  assert.match(board, /aria-labelledby/);
});
