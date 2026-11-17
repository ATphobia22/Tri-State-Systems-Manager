import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAllowedDevOnlyAdvisory } from './validate-npm-audit.mjs';

const PICOMATCH = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const REVIEWED_AT = new Date('2026-11-17T18:45:00Z');
const HIGH = [
  '@gltf-transform/cli', '@vitejs/plugin-react', 'anymatch', 'chokidar',
  'fdir', 'micromatch', 'picomatch', 'readdirp', 'tinyglobby',
  'vite', 'vite-plugin-static-copy', 'vitest',
];
const VIA = {
  '@gltf-transform/cli': ['@donmccurdy/caporal', 'micromatch'],
  '@vitejs/plugin-react': ['vite'],
  anymatch: ['picomatch'],
  chokidar: ['anymatch', 'readdirp'],
  fdir: ['picomatch'],
  micromatch: ['picomatch'],
  picomatch: [{ url: PICOMATCH, title: 'single-branch repeated extglobs' }],
  readdirp: ['picomatch'],
  tinyglobby: ['fdir', 'picomatch'],
  vite: ['picomatch', 'tinyglobby'],
  'vite-plugin-static-copy': ['chokidar', 'tinyglobby'],
  vitest: ['picomatch', 'tinyglobby', 'vite'],
};
const VERSIONS = {
  '@gltf-transform/cli': '4.5.1', '@vitejs/plugin-react': '6.2.1',
  anymatch: '3.1.3', chokidar: '3.6.0', fdir: '6.5.0',
  micromatch: '4.0.8', picomatch: '4.0.7', readdirp: '3.6.0',
  tinyglobby: '0.2.17', vite: '8.3.8',
  'vite-plugin-static-copy': '4.1.1', vitest: '5.1.0',
};

function makeObservedUnpatchedDevAdvisory() {
  const vulnerabilities = {};
  const packages = { '': { devDependencies: { vite: '8.3.8' } } };
  for (const name of HIGH) {
    const path = 'node_modules/' + name;
    vulnerabilities[name] = { name, severity: 'high', via: VIA[name].map((source) =>
      typeof source === 'string' ? source : { ...source }), nodes: [path] };
    packages[path] = { version: VERSIONS[name], dev: true };
  }
  vulnerabilities.picomatch.nodes = [
    'node_modules/anymatch/node_modules/picomatch',
    'node_modules/micromatch/node_modules/picomatch',
    'node_modules/picomatch',
    'node_modules/readdirp/node_modules/picomatch',
  ];
  for (const path of vulnerabilities.picomatch.nodes) {
    packages[path] = { version: path === 'node_modules/picomatch' ? '4.0.7' : '2.3.2', dev: true };
  }
  packages['node_modules/vite'].dependencies = { rolldown: '~1.2.18' };
  packages['node_modules/rolldown'] = { version: '1.2.19', dev: true };
  vulnerabilities['@donmccurdy/caporal'] = {
    name: '@donmccurdy/caporal', severity: 'moderate',
    via: [{ url: 'https://github.com/advisories/GHSA-3g3m-2fjr-6pw4' }],
    nodes: ['node_modules/@donmccurdy/caporal'],
  };
  return { report: {
    vulnerabilities,
    metadata: { vulnerabilities: { high: 12, critical: 0, moderate: 1, total: 13 } },
  }, lockfile: { packages } };
}

test('permits only reviewed unpatched dev-only picomatch chain with patched Vite', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  const result = validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT);
  assert.equal(result.ok, true);
  assert.equal(result.waiverApplied, true);
  assert.equal(result.blockingFindings, 12);
  assert.equal(result.acknowledgedAdvisory, 'GHSA-fc5q-39xc-vjpf');
});

test('rejects unreviewed additional high advisory', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  report.vulnerabilities.picomatch.via.push({ url: 'https://github.com/advisories/new-high-risk' });
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT), /Unexpected advisory|Unexpected high/);
});

test('rejects production exposure of any affected package', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  lockfile.packages['node_modules/readdirp'].dev = false;
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT), /dev-only/);
});

test('rejects extra vulnerable picomatch installation paths', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  report.vulnerabilities.picomatch.nodes.push('node_modules/custom/node_modules/picomatch');
  lockfile.packages['node_modules/custom/node_modules/picomatch'] = { version: '4.0.7', dev: true };
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT), /install path/);
});

test('rejects version drift in affected dependencies', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  lockfile.packages['node_modules/picomatch'].version = '4.0.8';
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT), /Version drift/);
});

test('requires patched Vite and Rolldown before allowing the dev-only exception', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  lockfile.packages['node_modules/vite'].version = '8.3.6';
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT), /Version drift|patched Vite/);
  lockfile.packages['node_modules/vite'].version = '8.3.8';
  lockfile.packages['node_modules/rolldown'].version = '1.2.16';
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT), /Rolldown|1\.2\.17/);
});

test('exception auto-expires rather than silently accepting stale risk forever', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  assert.throws(() => validateAllowedDevOnlyAdvisory(
    report, 1, lockfile, new Date('2026-12-15T00:00:00Z')), /expired|re-review/i);
});

test('does not accept critical findings or invalid audit exit codes', () => {
  const { report, lockfile } = makeObservedUnpatchedDevAdvisory();
  report.metadata.vulnerabilities.critical = 1;
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 1, lockfile, REVIEWED_AT), /critical|severity/i);
  report.metadata.vulnerabilities.critical = 0;
  assert.throws(() => validateAllowedDevOnlyAdvisory(report, 0, lockfile, REVIEWED_AT), /exit status|audit status/i);
});
