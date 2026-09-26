#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const failures = [];
const requiredFiles = [
  'artifacts/tsm-river-valley-realtime-stations-v1.json',
  'artifacts/tsm-regulatory-gates-v1.json',
  'data/schemas/regulatory-gate.schema.json',
  'backend/river-network-api.ts',
  'tsm-console/src/lib/jurisdiction-rules.ts',
  'tests/privacy-community-scope.test.mjs',
];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) failures.push('missing required boundary file: ' + relative);
}

const privatePatterns = [/13101\s+Bonebank\s+Road/i, /Bonebank\s+Road/i, /BONEBANK_(?:SITE|LOOKUP)/];
const publicRoots = [
  'backend',
  'artifacts',
  'scripts',
  'tsm-console/src',
  'tsm-console/server',
  'data/engineering',
  'data/fabrics',
  'data/fema',
  'data/geospatial',
  'data/grants',
  'data/registries',
  'data/regulatory',
  'data/schemas',
];
const restrictedRoots = ['data/evidence'];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:mjs|ts|tsx|py|json|md|sql|yml|yaml)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      for (const pattern of privatePatterns) {
        if (pattern.test(text)) failures.push('private site anchor detected in public/runtime path: ' + path.relative(root, full));
      }
    }
  }
}
for (const relative of publicRoots) walk(path.join(root, relative));

// Evidence is a restricted provenance plane. It must not be traversed as public/runtime data.
for (const relative of restrictedRoots) {
  if (!fs.existsSync(path.join(root, relative))) continue;
}

for (const relative of publicRoots) walk(path.join(root, relative));

const publicFiles = [];
for (const relative of publicRoots) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) continue;
  const stack = [absolute];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(?:mjs|ts|tsx|py|json|md|sql|yml|yaml)$/.test(entry.name)) publicFiles.push(path.relative(root, full));
    }
  }
}
const restrictedReferencePattern = /(?:data[\\/]+evidence|evidence[\\/]+layer2)/i;
for (const relative of publicFiles) {
  if (relative === 'scripts/ci/validate-community-engineering-boundaries.mjs') continue;
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  if (restrictedReferencePattern.test(text)) {
    failures.push('public/runtime file references restricted evidence plane: ' + relative);
  }
}


const stations = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/tsm-river-valley-realtime-stations-v1.json'), 'utf8'));
const stationIds = new Set();
for (const station of stations.verified_observation_stations ?? []) {
  if (!station.station_id || !station.provider || !station.name || !station.source_uri) failures.push('incomplete verified river station record');
  if (stationIds.has(station.station_id)) failures.push('duplicate river station: ' + station.station_id);
  stationIds.add(station.station_id);
  if (station.vertical_datum === 'NAVD88' && station.provider === 'USGS') {
    failures.push('USGS station ' + station.station_id + ' asserts NAVD88 without product-matched conversion metadata');
  }
}

const gates = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/tsm-regulatory-gates-v1.json'), 'utf8'));
const allowed = new Set(['NOT_ASSESSED','IN_REVIEW','EVIDENCE_REQUIRED','HUMAN_REVIEW_REQUIRED','SATISFIED_BY_EVIDENCE','AGENCY_ACCEPTED']);
for (const gate of gates.gates ?? []) {
  if (!allowed.has(gate.status)) failures.push('invalid regulatory gate status: ' + gate.gate_id);
  if (!gate.authority) failures.push('regulatory gate missing authority: ' + gate.gate_id);
  if (!Array.isArray(gate.required_evidence)) failures.push('regulatory gate missing evidence requirements: ' + gate.gate_id);
}
if (!/No calculation.*AGENCY_ACCEPTED/i.test(gates.software_policy ?? '')) {
  failures.push('regulatory gate software policy does not prohibit software-only agency acceptance');
}
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, gate: 'community-engineering-boundaries', stations: stationIds.size, regulatoryGates: gates.gates.length }, null, 2));
