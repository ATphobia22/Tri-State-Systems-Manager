#!/usr/bin/env node
/**
 * Enforce the npm high-severity audit gate, with one narrowly scoped exception
 * for the unpatched GHSA-vfj7-8cjw-p6xm advisory in dev-only glTF tooling.
 *
 * This does NOT mark braces as patched. The exception expires by behavior:
 * version/path/advisory changes fail closed and require a fresh review.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_ADVISORY = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const EXPECTED_FINDINGS = new Set(['@gltf-transform/cli', 'braces', 'micromatch']);
const EXPECTED_NODES = new Map([
  ['@gltf-transform/cli', 'node_modules/@gltf-transform/cli'],
  ['braces', 'node_modules/braces'],
  ['micromatch', 'node_modules/micromatch'],
]);
const EXPECTED_VERSIONS = new Map([
  ['@gltf-transform/cli', '4.5.1'],
  ['braces', '3.0.3'],
  ['micromatch', '4.0.8'],
]);

// Time-limited, exact dev-only scope for the unpatched 2026 picomatch advisory.
// Do not infer that the vulnerable code is fixed from a passing audit-policy gate.
const PICOMATCH_ADVISORY = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const PICOMATCH_REVIEW_EXPIRES_AT = Date.parse('2026-12-15T00:00:00Z');
const PICOMATCH_FINDINGS = new Map([
  ['@gltf-transform/cli', '4.5.1'],
  ['@vitejs/plugin-react', '6.2.1'],
  ['anymatch', '3.1.3'],
  ['chokidar', '3.6.0'],
  ['fdir', '6.5.0'],
  ['micromatch', '4.0.8'],
  ['picomatch', '4.0.7'],
  ['readdirp', '3.6.0'],
  ['tinyglobby', '0.2.17'],
  ['vite', '8.3.8'],
  ['vite-plugin-static-copy', '4.1.1'],
  ['vitest', '5.1.0'],
]);
const PICOMATCH_NESTED_NODES = [
  'node_modules/anymatch/node_modules/picomatch',
  'node_modules/micromatch/node_modules/picomatch',
  'node_modules/picomatch',
  'node_modules/readdirp/node_modules/picomatch',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectAdvisories(name, vulnerabilities, visiting = new Set()) {
  const finding = vulnerabilities[name];
  assert(finding, `Audit finding ${name} references a package missing from the audit report.`);
  assert(!visiting.has(name), `Circular audit dependency reference detected at ${name}.`);

  const nextVisiting = new Set(visiting);
  nextVisiting.add(name);
  const advisoryUrls = [];

  for (const via of finding.via ?? []) {
    if (typeof via === 'string') {
      advisoryUrls.push(...collectAdvisories(via, vulnerabilities, nextVisiting));
      continue;
    }

    assert(via && typeof via === 'object' && typeof via.url === 'string',
      `Unsupported audit reference in ${name}; cannot safely evaluate it.`);
    advisoryUrls.push(via.url);
  }

  return [...new Set(advisoryUrls)];
}

function collectHighSeverityAdvisories(name, vulnerabilities, visiting = new Set()) {
  const finding = vulnerabilities[name];
  assert(finding && typeof finding === 'object', 'Missing audit dependency: ' + name);
  assert(!visiting.has(name), 'Circular audit dependency reference detected at ' + name);
  const next = new Set(visiting);
  next.add(name);
  const sources = [];
  assert(Array.isArray(finding.via), 'Missing audit references for ' + name);
  for (const via of finding.via) {
    if (typeof via === 'string') {
      const transit = vulnerabilities[via];
      assert(transit && typeof transit === 'object', 'Missing audit dependency: ' + via);
      // Moderate findings remain visible in npm audit but do not block --audit-level=high.
      if (transit.severity === 'high' || transit.severity === 'critical') {
        sources.push(...collectHighSeverityAdvisories(via, vulnerabilities, next));
      }
    } else {
      assert(via && typeof via.url === 'string', 'Malformed direct advisory for ' + name);
      sources.push(via.url);
    }
  }
  return [...new Set(sources)];
}

function validateUnpatchedPicomatchDevOnlyException(report, auditStatus, lockfile, now) {
  const counts = report.metadata.vulnerabilities;
  assert(counts.high === 12 && counts.critical === 0,
    'Unexpected high/critical severity counts; picomatch exception cannot accept critical findings.');
  assert(auditStatus === 1, 'Expected npm audit exit status 1 for known picomatch risk.');
  assert(now instanceof Date && Number.isFinite(now.getTime()), 'Valid review timestamp required.');
  assert(now.getTime() < PICOMATCH_REVIEW_EXPIRES_AT,
    'Temporary picomatch exception expired; new security re-review required.');

  const packages = lockfile?.packages;
  assert(packages && typeof packages === 'object',
    'Missing npm lock packages for picomatch exception.');
  for (const [name, expectedVersion] of PICOMATCH_FINDINGS) {
    const finding = report.vulnerabilities[name];
    assert(finding && finding.severity === 'high', 'Missing expected high finding: ' + name);
    const expectedNodes = name === 'picomatch'
      ? PICOMATCH_NESTED_NODES : ['node_modules/' + name];
    const actualNodes = finding.nodes;
    assert(Array.isArray(actualNodes) && actualNodes.length === expectedNodes.length
      && new Set(actualNodes).size === expectedNodes.length
      && expectedNodes.every((node) => actualNodes.includes(node)),
    'Unexpected install path for ' + name + ': ' + JSON.stringify(actualNodes));
    for (const node of expectedNodes) {
      const info = packages[node];
      assert(info && info.dev === true,
        'All acknowledged picomatch advisory packages must remain dev-only: ' + node);
      const nodeVersion = name === 'picomatch' && node !== 'node_modules/picomatch'
        ? '2.3.2' : expectedVersion;
      assert(info.version === nodeVersion,
        'Version drift for ' + name + ': expected ' + nodeVersion + ', got ' + info.version);
    }
    const urls = collectHighSeverityAdvisories(name, report.vulnerabilities);
    assert(urls.length === 1 && urls[0] === PICOMATCH_ADVISORY,
      'Unexpected advisory chain for ' + name + ': ' + JSON.stringify(urls));
  }
  const vite = packages['node_modules/vite'];
  const rolldown = packages['node_modules/rolldown'];
  assert(packages['']?.devDependencies?.vite === '8.3.8'
    && vite?.version === '8.3.8'
    && vite?.dependencies?.rolldown === '~1.2.18',
  'The picomatch exception requires patched Vite 8.3.8 and its Rolldown dependency.');
  assert(rolldown?.dev === true && /^1\.2\.(?:1[7-9]|[2-9]\d)$/.test(rolldown.version),
    'The picomatch exception requires patched Rolldown 1.2.17 or newer in its reviewed release line.');

  return {
    ok: true,
    blockingFindings: PICOMATCH_FINDINGS.size,
    waiverApplied: true,
    acknowledgedAdvisory: 'GHSA-fc5q-39xc-vjpf',
    scope: 'Exact twelve dev-only transitive npm findings from picomatch; patched Vite/Rolldown required',
    expiresAtUtc: '2026-12-15T00:00:00Z',
    note: 'Known unpatched ReDoS advisory is NOT fixed or removed; bounded risk acceptance requires re-review.',
  };
}

function validateAllowedDevOnlyAdvisory(report, auditStatus, lockfile, now = new Date()) {
  const vulnerabilities = report?.vulnerabilities;
  const counts = report?.metadata?.vulnerabilities;

  assert(vulnerabilities && typeof vulnerabilities === 'object' && !Array.isArray(vulnerabilities),
    'npm audit report has no vulnerabilities object; fail closed.');
  assert(counts && Number.isInteger(counts.high) && Number.isInteger(counts.critical),
    'npm audit report has incomplete severity counts; fail closed.');

  const blocking = Object.entries(vulnerabilities)
    .filter(([, item]) => item?.severity === 'high' || item?.severity === 'critical');

  assert(Number.isInteger(auditStatus) && (auditStatus === 0 || auditStatus === 1),
    `npm audit returned an unexpected status ${auditStatus}; fail closed.`);

  if (blocking.length === 0) {
    assert(auditStatus === 0, 'npm audit returned a failure without high/critical findings.');
    return { ok: true, blockingFindings: 0, waiverApplied: false };
  }

  const approvedPicomatchSet = new Set(blocking.map(([name]) => name));
  if (blocking.length === PICOMATCH_FINDINGS.size
      && [...PICOMATCH_FINDINGS.keys()].every((name) => approvedPicomatchSet.has(name))) {
    return validateUnpatchedPicomatchDevOnlyException(report, auditStatus, lockfile, now);
  }

  const actualNames = new Set(blocking.map(([name]) => name));
  assert(actualNames.size === EXPECTED_FINDINGS.size &&
    [...EXPECTED_FINDINGS].every((name) => actualNames.has(name)),
  `Unexpected high/critical npm audit findings: ${[...actualNames].join(', ')}.`);
  assert(counts.high === 3 && counts.critical === 0,
    `Audit severity totals changed (high=${counts.high}, critical=${counts.critical}); review required.`);
  assert(auditStatus === 1, `Expected npm audit exit status 1 for the documented advisory, received ${auditStatus}.`);

  const lockPackages = lockfile?.packages;
  assert(lockPackages && typeof lockPackages === 'object',
    'package-lock.json has no packages map; fail closed.');

  for (const [name, item] of blocking) {
    assert(item.severity === 'high', `Unexpected severity for ${name}: ${item.severity}.`);
    const expectedNode = EXPECTED_NODES.get(name);
    assert(Array.isArray(item.nodes) && item.nodes.length === 1 && item.nodes[0] === expectedNode,
      `Unexpected install path for ${name}: ${JSON.stringify(item.nodes)}.`);

    const packageInfo = lockPackages[expectedNode];
    assert(packageInfo && packageInfo.dev === true,
      `The acknowledged advisory must remain dev-only; ${expectedNode} is missing or not marked dev.`);
    assert(packageInfo.version === EXPECTED_VERSIONS.get(name),
      `Version drift for ${name}: expected ${EXPECTED_VERSIONS.get(name)}, received ${packageInfo.version}. Review the waiver.`);

    const advisoryUrls = collectAdvisories(name, vulnerabilities);
    assert(advisoryUrls.length === 1 && advisoryUrls[0] === ALLOWED_ADVISORY,
      `Unexpected advisory chain for ${name}: ${JSON.stringify(advisoryUrls)}.`);
  }

  return {
    ok: true,
    blockingFindings: blocking.length,
    waiverApplied: true,
    acknowledgedAdvisory: 'GHSA-vfj7-8cjw-p6xm',
    scope: 'dev-only @gltf-transform/cli -> micromatch -> braces chain',
    note: 'Upstream advisory has no listed patched version as of 2026-10-18; this is a documented exception, not a claim that the vulnerable package is fixed.',
  };
}

function main() {
  const [reportArgument, statusArgument] = process.argv.slice(2);
  assert(reportArgument && statusArgument !== undefined,
    'Usage: node scripts/ci/validate-npm-audit.mjs <audit-report.json> <npm-audit-exit-code>');

  const reportPath = resolve(reportArgument);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
  const lockfilePath = resolve(repositoryRoot, 'tsm-console/package-lock.json');
  const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
  const auditStatus = Number(statusArgument);
  const result = validateAllowedDevOnlyAdvisory(report, auditStatus, lockfile);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export { validateAllowedDevOnlyAdvisory };
