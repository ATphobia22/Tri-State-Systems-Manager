import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/lib/scenario-evidence-export.ts'), 'utf8');
assert.match(src, /exportScenarioStudioEvidence/);
assert.match(src, /SIMULATION_DEMO/);
assert.match(src, /authorityClass: 'SCENARIO'/);
assert.match(src, /scenario_export/);
assert.match(src, /Does not claim OBSERVED or REGULATORY/);
assert.doesNotMatch(src, /authorityClass: 'REGULATORY'/);
assert.equal(existsSync(join(root, 'public/data/critical-facilities-posey-screening.json')), true);
console.log('scenario-evidence-export-contract: OK');
