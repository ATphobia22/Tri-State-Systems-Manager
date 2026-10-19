import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/lib/scenario-studio.ts'), 'utf8');

assert.match(src, /SIMULATION_DEMO/);
assert.match(src, /authorityClass: 'SCENARIO'/);
assert.match(src, /runScenarioStudio/);
assert.match(src, /Human authority remains final/);
assert.match(src, /resilient/i);
assert.doesNotMatch(src, /gageZeroNavd88\s*=\s*[0-9]/);
assert.match(src, /residualFactor: 1/);
assert.match(src, /intensity: 0\.55/);

const panel = join(root, 'src/components/ScenarioStudioPanel.tsx');
assert.equal(existsSync(panel), true);
const panelSrc = readFileSync(panel, 'utf8');
assert.match(panelSrc, /Run scenario \(human-triggered\)/);
assert.match(panelSrc, /onResult/);

console.log('scenario-studio.test.mjs: lib + panel contracts OK');
