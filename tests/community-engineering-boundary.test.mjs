import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

test('community engineering boundary validator passes', () => {
  const script = path.join(root, 'scripts/ci/validate-community-engineering-boundaries.mjs');
  const result = JSON.parse(execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8' }));
  assert.equal(result.ok, true);
  assert.ok(result.stations >= 3);
  assert.ok(result.regulatoryGates >= 1);
});

test('regulatory gate registry uses governed statuses', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/tsm-regulatory-gates-v1.json'), 'utf8'));
  const allowed = new Set(['NOT_ASSESSED','IN_REVIEW','EVIDENCE_REQUIRED','HUMAN_REVIEW_REQUIRED','SATISFIED_BY_EVIDENCE','AGENCY_ACCEPTED']);
  for (const gate of registry.gates) assert.equal(allowed.has(gate.status), true);
});

test('river station registry preserves source-datum semantics', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/tsm-river-valley-realtime-stations-v1.json'), 'utf8'));
  assert.ok(registry.verified_observation_stations.length >= 3);
  for (const station of registry.verified_observation_stations) {
    assert.equal(typeof station.station_id, 'string');
    assert.equal(typeof station.provider, 'string');
    assert.equal(typeof station.source_uri, 'string');
  }
});
