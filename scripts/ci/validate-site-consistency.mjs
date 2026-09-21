#!/usr/bin/env node
/**
 * Cross-plane consistency gate for the community engineering scope.
 * Private residence, parcel and house-specific identifiers are prohibited.
 * Regulatory determinations remain human-controlled.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = {
  frontendSite: path.join(repoRoot, 'tsm-console/src/types/site.ts'),
  backendSite: path.join(repoRoot, 'backend/gov/site_constants.py'),
  packageJson: path.join(repoRoot, 'tsm-console/package.json'),
  consoleCompose: path.join(repoRoot, 'tsm-console/docker-compose.yml'),
  riverRegistry: path.join(repoRoot, 'artifacts/tsm-river-valley-realtime-stations-v1.json'),
  historicalEvidence: path.join(repoRoot, 'artifacts/historical/point-township-community-flood-evidence-v1.json'),
};

const failures = [];
const read = (key) => {
  const file = files[key];
  if (!fs.existsSync(file)) {
    failures.push(`${path.relative(repoRoot, file)}: required file is missing`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
};

const frontend = read('frontendSite');
const backendSite = read('backendSite');
const packageJson = read('packageJson');
const compose = read('consoleCompose');
const riverRegistry = read('riverRegistry');
const historicalEvidence = read('historicalEvidence');

for (const forbidden of ['13101 Bonebank Road', '13101 Bonebank', '65-19-08-100-008.001-010', 'BONEBANK_SITE', 'tsm-site-constants-13101-bonebank']) {
  for (const [label, source] of Object.entries({ frontend, backendSite, riverRegistry, historicalEvidence })) {
    if (source.includes(forbidden)) failures.push(`${label}: private identifier leaked: ${forbidden}`);
  }
}

for (const required of [
  'Lower Wabash-Ohio Confluence Community',
  'COMMUNITY_SCOPE',
  'LEGACY_SCENARIO_REQUIRES_PROJECT_EVIDENCE',
]) {
  if (!frontend.includes(required)) failures.push(`frontend community scope: missing ${required}`);
}

for (const required of ['USGS', 'NOAA_NWS', 'John T. Myers Locks and Dam', 'Smithland Locks and Dam', 'Olmsted Locks and Dam']) {
  if (!riverRegistry.includes(required)) failures.push(`river registry: missing ${required}`);
}

if (!historicalEvidence.includes('HISTORICAL_COMMUNITY_EVIDENCE') || !historicalEvidence.includes('privacyRedacted')) {
  failures.push('historical evidence: privacy-safe provenance contract missing');
}

try {
  const pkg = JSON.parse(packageJson);
  for (const name of ['scan:loma', 'etl:posey']) {
    if (name in pkg.scripts) failures.push(`tsm-console/package.json: stale script remains: ${name}`);
  }
  if (!pkg.engines?.node || !pkg.engines.node.includes('22')) failures.push('tsm-console/package.json: Node.js >=22 engine requirement missing');
} catch (error) {
  failures.push(`tsm-console/package.json: invalid JSON: ${error.message}`);
}

if (!/build:\s*\n\s+context:\s+\./.test(compose) || !/dockerfile:\s+Dockerfile/.test(compose)) failures.push('tsm-console/docker-compose.yml: canonical services must build the checked-in Dockerfile');
if (!fs.existsSync(path.join(repoRoot, 'tsm-console/Dockerfile'))) failures.push('tsm-console/Dockerfile: production runtime Dockerfile missing');
if (/POSTGRES_PASSWORD:\s*(tsm|sovereign|sovereign_pass)\b/.test(compose)) failures.push('tsm-console/docker-compose.yml: plaintext database credential detected');
if (!/condition:\s*service_healthy/.test(compose)) failures.push('tsm-console/docker-compose.yml: web service must wait for healthy API');

for (const relative of [
  'tsm-data-contract-schema-v1.0.0.json',
  'tsm-evidence-artifact-schema-v1.0.0.json',
  'tsm-four-plane-architecture-v1.json',
  'tsm-indiana-data-catalog-v1.json',
  'tsm-site-constants-13101-bonebank.json',
]) {
  if (fs.existsSync(path.join(repoRoot, relative))) failures.push(`${relative}: stale root schema copy remains; use data/schemas/`);
}

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

for (const file of walk(repoRoot)) {
  if (path.extname(file).toLowerCase() === '.docx') failures.push(`${path.relative(repoRoot, file)}: binary architecture document must not be tracked`);
}

if (failures.length) {
  console.error('[tsm] FAIL-CLOSED community engineering consistency gate');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[tsm] community engineering consistency gate passed');
