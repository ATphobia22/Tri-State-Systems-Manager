import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAllowedDevOnlyAdvisory } from './validate-npm-audit.mjs';

const allowedUrl = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';

function makeAllowedCase() {
  const report = {
    vulnerabilities: {
      '@gltf-transform/cli': {
        name: '@gltf-transform/cli',
        severity: 'high',
        via: ['micromatch'],
        nodes: ['node_modules/@gltf-transform/cli'],
      },
      braces: {
        name: 'braces',
        severity: 'high',
        via: [{ url: allowedUrl, title: 'unpatched braces advisory' }],
        nodes: ['node_modules/braces'],
      },
      micromatch: {
        name: 'micromatch',
        severity: 'high',
        via: ['braces'],
        nodes: ['node_modules/micromatch'],
      },
    },
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 3, critical: 0, total: 3 },
    },
  };
  const lockfile = {
    packages: {
      'node_modules/@gltf-transform/cli': { version: '4.5.1', dev: true },
      'node_modules/braces': { version: '3.0.3', dev: true },
      'node_modules/micromatch': { version: '4.0.8', dev: true },
    },
  };
  return { report, lockfile };
}

test('allows only the documented unpatched dev-only braces advisory chain', () => {
  const { report, lockfile } = makeAllowedCase();
  const result = validateAllowedDevOnlyAdvisory(report, 1, lockfile);
  assert.equal(result.ok, true);
  assert.equal(result.waiverApplied, true);
  assert.equal(result.acknowledgedAdvisory, 'GHSA-vfj7-8cjw-p6xm');
  assert.equal(result.blockingFindings, 3);
});

test('passes when npm audit reports no high or critical findings', () => {
  const result = validateAllowedDevOnlyAdvisory({
    vulnerabilities: {},
    metadata: { vulnerabilities: { high: 0, critical: 0, total: 0 } },
  }, 0, { packages: {} });
  assert.deepEqual(result, { ok: true, blockingFindings: 0, waiverApplied: false });
});

test('fails closed on any additional high-severity finding', () => {
  const { report, lockfile } = makeAllowedCase();
  report.vulnerabilities.eslint = {
    name: 'eslint',
    severity: 'high',
    via: [{ url: 'https://example.invalid/advisory' }],
    nodes: ['node_modules/eslint'],
  };
  report.metadata.vulnerabilities.high = 4;
  report.metadata.vulnerabilities.total = 4;
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile), /Unexpected high\/critical/);
});

test('fails closed if the advisory appears on a production dependency path', () => {
  const { report, lockfile } = makeAllowedCase();
  lockfile.packages['node_modules/braces'].dev = false;
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile), /must remain dev-only/);
});

test('fails closed when a waived dependency version changes', () => {
  const { report, lockfile } = makeAllowedCase();
  lockfile.packages['node_modules/braces'].version = '3.0.4';
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile), /Version drift for braces/);
});

test('fails closed if any dependency resolves to a different advisory', () => {
  const { report, lockfile } = makeAllowedCase();
  report.vulnerabilities.braces.via.push({
    url: 'https://example.invalid/second-advisory',
    title: 'unexpected second advisory',
  });
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile), /Unexpected advisory chain/);
});

test('fails closed if npm audit status disagrees with the report', () => {
  const { report, lockfile } = makeAllowedCase();
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 0, lockfile), /Expected npm audit exit status 1/);
});
