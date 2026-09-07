import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDependencyIntegrity } from '../scripts/dependency-integrity.mjs';
import { findUnsafeNpx } from '../scripts/npx-policy-check.mjs';

test('dependency integrity requires exact npm and Node floors', () => {
  const packageJson = { packageManager: 'npm@10.9.2', dependencies: { react: '^19.0.0' } };
  const lockJson = { lockfileVersion: 3, packages: { '': { dependencies: { react: '^19.0.0' } }, 'node_modules/react': { version: '19.0.0' } } };
  assert.equal(validateDependencyIntegrity({ packageJson, lockJson, nodeVersion: 'v22.20.0', npmVersion: '10.9.2' }).ok, true);
  assert.throws(() => validateDependencyIntegrity({ packageJson, lockJson, nodeVersion: 'v20.0.0', npmVersion: '10.9.2' }));
  assert.throws(() => validateDependencyIntegrity({ packageJson, lockJson, nodeVersion: 'v22.20.0', npmVersion: '11.0.0' }));
});

test('install scripts require explicit review', () => {
  const base = { packageManager: 'npm@10.9.2', dependencies: { react: '^19.0.0' } };
  const lockJson = { lockfileVersion: 3, packages: { '': { dependencies: { react: '^19.0.0' } }, 'node_modules/react': { version: '19.0.0', hasInstallScript: true } } };
  assert.throws(() => validateDependencyIntegrity({ packageJson: base, lockJson, allowlist: { root: true, dependencies: [] }, nodeVersion: 'v22.20.0', npmVersion: '10.9.2' }));
  assert.equal(validateDependencyIntegrity({ packageJson: base, lockJson, allowlist: { root: true, dependencies: ['react'] }, nodeVersion: 'v22.20.0', npmVersion: '10.9.2' }).ok, true);
});

test('npx policy flags unpinned remote execution', () => {
  assert.equal(findUnsafeNpx('run: npx eslint@9.1.0 .').length, 0);
  assert.equal(findUnsafeNpx('run: npx eslint .').length, 1);
});
