import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/components/FacilityStatusDashboard.tsx'), 'utf8');
assert.match(src, /Not SCADA/);
assert.match(src, /SIMULATION_DEMO/);
assert.match(src, /buildFacilityRows/);
assert.match(src, /Refresh nearest stages/);
assert.equal(existsSync(join(root, 'src/routes/FacilityStatusView.tsx')), true);
console.log('facility-status-dashboard-contract: OK');
