#!/usr/bin/env node
/**
 * Cross-plane consistency gate for the Bonebank / Posey NFIP anchor.
 * This checks that independently maintained runtime constants agree on the
 * geodetic anchor and FIRM panel identity. It does not assert that any value
 * is legally authoritative; regulatory determinations remain human-controlled.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = {
  frontendSite: path.join(repoRoot, 'tsm-console/src/lib/siteConstants.ts'),
  firmSsot: path.join(repoRoot, 'tsm-console/src/lib/firm-panel-ssot.ts'),
  backendSite: path.join(repoRoot, 'backend/gov/site_constants.py'),
  backendApi: path.join(repoRoot, 'backend/api/server.py'),
  packageJson: path.join(repoRoot, 'tsm-console/package.json'),
  consoleCompose: path.join(repoRoot, 'tsm-console/docker-compose.yml'),
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
const ssot = read('firmSsot');
const backendSite = read('backendSite');
const backendApi = read('backendApi');
const packageJson = read('packageJson');
const compose = read('consoleCompose');

function requireLiteral(source, literal, label) {
  if (!source.includes(literal)) failures.push(`${label}: missing literal ${literal}`);
}

requireLiteral(frontend, 'firm_panel_effective: "18129C0300C"', 'frontend site constants');
requireLiteral(frontend, 'firm_verification_status: "NFHL_REST_VERIFIED"', 'frontend site constants');
requireLiteral(frontend, 'lat: 37.84589', 'frontend site constants');
requireLiteral(frontend, 'lon: -88.0051', 'frontend site constants');

requireLiteral(ssot, "effectivePanelId: '18129C0300C'", 'FIRM SSOT');
requireLiteral(ssot, "verificationStatus: 'NFHL_REST_VERIFIED'", 'FIRM SSOT');
requireLiteral(ssot, 'lat: 37.84589', 'FIRM SSOT');
requireLiteral(ssot, 'lon: -88.0051', 'FIRM SSOT');

requireLiteral(backendSite, 'FIRM_PANEL: Final[str] = "18129C0300C"', 'backend site constants');
requireLiteral(backendApi, '"coordinates": [-88.0051, 37.84589]', 'backend API');

try {
  const pkg = JSON.parse(packageJson);
  const forbiddenScripts = ['scan:loma', 'etl:posey'];
  for (const name of forbiddenScripts) {
    if (name in pkg.scripts) failures.push(`tsm-console/package.json: stale script remains: ${name}`);
  }
  if (!pkg.engines?.node || !pkg.engines.node.includes('22')) {
    failures.push('tsm-console/package.json: Node.js >=22 engine requirement missing');
  }
} catch (error) {
  failures.push(`tsm-console/package.json: invalid JSON: ${error.message}`);
}

if (!/image:\s*node:22-alpine/.test(compose)) {
  failures.push('tsm-console/docker-compose.yml: console runtime must use node:22-alpine');
}
if (!/condition:\s*service_healthy/.test(compose)) {
  failures.push('tsm-console/docker-compose.yml: web service must wait for healthy API');
}

const bboxMatch = frontend.match(/bbox:\s*\[([^\]]+)\]/);
if (bboxMatch) {
  const bbox = bboxMatch[1].split(',').map((value) => Number(value.trim()));
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lon = -88.0051;
  const lat = 37.84589;
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
    failures.push('frontend site constants: bbox contains a non-numeric value');
  } else if (!(minLon <= lon && lon <= maxLon && minLat <= lat && lat <= maxLat)) {
    failures.push('frontend site constants: operational bbox does not contain the site anchor');
  }
} else {
  failures.push('frontend site constants: operational bbox is missing');
}

for (const relative of [
  'tsm-data-contract-schema-v1.0.0.json',
  'tsm-evidence-artifact-schema-v1.0.0.json',
  'tsm-four-plane-architecture-v1.json',
  'tsm-indiana-data-catalog-v1.json',
  'tsm-site-constants-13101-bonebank.json',
]) {
  if (fs.existsSync(path.join(repoRoot, relative))) {
    failures.push(`${relative}: stale root schema copy remains; use data/schemas/`);
  }
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
  if (path.extname(file).toLowerCase() === '.docx') {
    failures.push(`${path.relative(repoRoot, file)}: binary architecture document must not be tracked`);
  }
}

if (failures.length) {
  console.error('[tsm] FAIL-CLOSED site consistency gate');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[tsm] site consistency gate passed');
