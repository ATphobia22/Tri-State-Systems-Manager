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
  if (!fs.existsSync(path.join(root, relative))) {
    failures.push('missing required boundary file: ' + relative);
  }
}

// Private residence/site anchors must never appear in the public/runtime plane.
// The corresponding case evidence is operator-retained and belongs under the
// restricted evidence boundary, not in public application assets or documentation.
const privatePatterns = [
  /13101\s+Bonebank\s+(?:Road|Rd)\b/i,
  /\bBonebank\s+(?:Road|Rd)\b/i,
  /\bBonebank\b/i,
  /37\.845887/,
  /-88\.005075/,
  /BONEBANK_(?:SITE|LOOKUP)/i,
];

const publicRoots = [
  'backend',
  'artifacts',
  'docs',
  'scripts',
  'tsm-console/src',
  'tsm-console/server',
  'tsm-console/data',
  'data/engineering',
  'data/fabrics',
  'data/fema',
  'data/geospatial',
  'data/grants',
  'data/registries',
  'data/regulatory',
  'data/schemas',
  'README.md',
  'SECURITY.md',
  'COMPLIANCE.md',
];

const restrictedRoots = ['data/evidence'];

const textExtensions = /\.(?:mjs|ts|tsx|py|json|sql|yml|yaml|md|txt|csv|sh)$/i;

function scanFile(relative) {
  const full = path.join(root, relative);
  let text;
  try {
    text = fs.readFileSync(full, 'utf8');
  } catch (error) {
    failures.push('unable to read public boundary file: ' + relative + ' (' + error.message + ')');
    return;
  }

  for (const pattern of privatePatterns) {
    if (pattern.test(text)) {
      failures.push('private site anchor detected in public/runtime path: ' + relative);
      break;
    }
  }
}

function walkPublicPath(relative) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return;

  const stat = fs.statSync(full);
  if (stat.isFile()) {
    if (textExtensions.test(relative) && relative !== path.relative(root, import.meta.filename)) {
      scanFile(relative);
    }
    return;
  }

  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) walkPublicPath(child);
    else if (textExtensions.test(entry.name)) scanFile(child);
  }
}

for (const relative of publicRoots) walkPublicPath(relative);

// Restricted evidence is deliberately not scanned as public/runtime data.
// Its existence is itself permitted; public code may not depend on its path.
const restrictedReferencePattern = /(?:data[\\/]+evidence|evidence[\\/]+layer2)/i;
for (const relative of publicRoots) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;
  const stack = [full];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) continue;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(child);
      else if (textExtensions.test(entry.name)) {
        const relativePath = path.relative(root, child);
        if (relativePath === path.relative(root, import.meta.filename)) continue;
        const text = fs.readFileSync(child, 'utf8');
        if (restrictedReferencePattern.test(text)) {
          failures.push('public/runtime file references restricted evidence plane: ' + relativePath);
        }
      }
    }
  }
}

const stations = JSON.parse(
  fs.readFileSync(path.join(root, 'artifacts/tsm-river-valley-realtime-stations-v1.json'), 'utf8'),
);
const stationIds = new Set();
for (const station of stations.verified_observation_stations ?? []) {
  if (!station.station_id || !station.provider || !station.name || !station.source_uri) {
    failures.push('incomplete verified river station record');
  }
  if (stationIds.has(station.station_id)) {
    failures.push('duplicate river station: ' + station.station_id);
  }
  stationIds.add(station.station_id);
  if (station.vertical_datum === 'NAVD88' && station.provider === 'USGS') {
    failures.push(
      'USGS station ' +
        station.station_id +
        ' asserts NAVD88 without product-matched conversion metadata',
    );
  }
}

const gates = JSON.parse(
  fs.readFileSync(path.join(root, 'artifacts/tsm-regulatory-gates-v1.json'), 'utf8'),
);
const allowed = new Set([
  'NOT_ASSESSED',
  'IN_REVIEW',
  'EVIDENCE_REQUIRED',
  'HUMAN_REVIEW_REQUIRED',
  'SATISFIED_BY_EVIDENCE',
  'AGENCY_ACCEPTED',
]);

for (const gate of gates.gates ?? []) {
  if (!allowed.has(gate.status)) failures.push('invalid regulatory gate status: ' + gate.gate_id);
  if (!gate.authority) failures.push('regulatory gate missing authority: ' + gate.gate_id);
  if (!Array.isArray(gate.required_evidence)) {
    failures.push('regulatory gate missing evidence requirements: ' + gate.gate_id);
  }
}

if (!/No calculation.*AGENCY_ACCEPTED/i.test(gates.software_policy ?? '')) {
  failures.push('regulatory gate software policy does not prohibit software-only agency acceptance');
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      gate: 'community-engineering-boundaries',
      stations: stationIds.size,
      regulatoryGates: gates.gates.length,
      restrictedEvidencePlane: restrictedRoots,
    },
    null,
    2,
  ),
);
