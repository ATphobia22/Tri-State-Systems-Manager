import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/lib/hec-ras-contracts.ts', import.meta.url), 'utf8');

test('HEC-RAS contract contains approved mesh refinement bands', () => {
  for (const band of ['25, max: 50', '25, max: 40', '50, max: 100', '100, max: 200']) assert.match(source, new RegExp(`min: ${band.replace(', max: ', ', max: ')}`));
});

test('HEC-RAS contract requires hydro-enforced NAVD88 terrain and breaklines', () => {
  assert.match(source, /hydro_enforced: true/);
  assert.match(source, /vertical_datum: 'NAVD88'/);
  for (const breakline of ['channel_centerline', 'left_bank', 'right_bank', 'berm_crest']) assert.match(source, new RegExp(breakline));
});

test('HEC-RAS contract labels outputs simulation-only and human review', () => {
  assert.match(source, /authority_class: 'SIMULATION_DEMO'/);
  assert.match(source, /governance_status: 'human_review_required'/);
  assert.match(source, /is_simulation_demo: true/);
});
