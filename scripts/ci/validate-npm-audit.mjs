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

function validateAllowedDevOnlyAdvisory(report, auditStatus, lockfile) {
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
  const lockfile = JSON.parse(readFileSync(resolve('tsm-console/package-lock.json'), 'utf8'));
  const auditStatus = Number(statusArgument);
  const result = validateAllowedDevOnlyAdvisory(report, auditStatus, lockfile);
  console.log(JSON.stringify(result));
}

export { validateAllowedDevOnlyAdvisory };
