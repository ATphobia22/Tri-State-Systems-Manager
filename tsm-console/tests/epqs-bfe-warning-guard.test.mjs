import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const simulator = readFileSync(join(root, 'src/components/FloodSimulator.tsx'), 'utf8');
const modal = readFileSync(join(root, 'src/components/EpqsBfeWarningModal.tsx'), 'utf8');

test('FloodSimulator wires the Terrain selector through the EPQS/BFE warning', () => {
  assert.match(simulator, /EpqsBfeWarningModal/);
  assert.match(simulator, /requestTerrainModeChange/);
  assert.match(simulator, /handleTerrainModeChange/);
  // The select change must go through the guard handler, never straight to state.
  assert.match(simulator, /onChange=\{\(e\) => handleTerrainModeChange\(e\.target\.value as 'auto' \| 'live'\)\}/);
  assert.doesNotMatch(simulator, /setTerrainMode\(e\.target\.value/);
});

test('FloodSimulator renders the modal only while a change is pending', () => {
  assert.match(simulator, /<EpqsBfeWarningModal/);
  assert.match(simulator, /open=\{pendingTerrainMode != null\}/);
  assert.match(simulator, /pendingTerrainMode=\{pendingTerrainMode\}/);
  assert.match(simulator, /onAcknowledge=\{acknowledgeTerrainChange\}/);
  assert.match(simulator, /onCancel=\{cancelTerrainChange\}/);
  // No modal on mount: pending state starts null.
  assert.match(
    simulator,
    /useState<EpqsTerrainMode \| null>\(null\)/,
  );
});

test('acknowledgement applies the pending mode; cancellation keeps the current mode', () => {
  assert.match(simulator, /setTerrainMode\(pendingTerrainMode\)/);
  assert.match(simulator, /setPendingTerrainMode\(null\)/);
  assert.match(simulator, /const cancelTerrainChange = \(\) => setPendingTerrainMode\(null\)/);
  // Cancellation must not touch terrainMode.
  const cancelBlock = simulator.slice(
    simulator.indexOf('const cancelTerrainChange'),
    simulator.indexOf('const cancelTerrainChange') + 200,
  );
  assert.doesNotMatch(cancelBlock, /setTerrainMode/);
});

test('modal is a UI guard only: no fetch, no polling, no live data', () => {
  assert.doesNotMatch(modal, /\bfetch\s*\(/);
  assert.doesNotMatch(modal, /setInterval|setTimeout/);
  assert.doesNotMatch(modal, /EventSource|WebSocket/);
});

test('modal copy never states the stale BFE or the unverified interpolation method', () => {
  assert.doesNotMatch(modal, /375\.0/);
  assert.doesNotMatch(modal, /bilinear/i);
});

test('modal follows the console dialog pattern and states the grounded facts', () => {
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /369\.1 ft NAVD88/);
  assert.match(modal, /0\.53 m RMSE/);
  assert.match(modal, /±1\.04 m/);
  assert.match(modal, /0\.82 m RMSE/);
  assert.match(modal, /±1\.61 m/);
  assert.match(modal, /26-05-2022A/);
  assert.match(modal, /not a FEMA determination/);
  assert.match(modal, /not a survey certification/);
});

test('modal buttons are large touch targets for small screens', () => {
  assert.match(modal, /minHeight: 48/);
  assert.match(modal, /width: '100%'/);
});
