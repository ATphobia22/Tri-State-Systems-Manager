import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const simulatorSource = readFileSync(
  new URL('../src/components/FloodSimulator.tsx', import.meta.url),
  'utf8',
);

test('production FloodSimulator remains implemented rather than a placeholder shim', () => {
  assert.match(simulatorSource, /export default function FloodSimulator/);
  assert.match(simulatorSource, /createFloodRenderer/);
  assert.match(simulatorSource, /if\s*\(!renderer\)/);
  assert.doesNotMatch(
    simulatorSource,
    /PLACEHOLDER_WILL_REPLACE|PLACEHOLDER_FULL|Loading full flood simulator|full UI in follow-up|FloodSimulator\.full/i,
  );
});
