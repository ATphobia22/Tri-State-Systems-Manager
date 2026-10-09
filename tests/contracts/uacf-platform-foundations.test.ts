import assert from 'node:assert/strict';
import test from 'node:test';
import { validateResearchResult } from '../../packages/research/src/index.ts';
import { authorizeTenantCapability } from '../../packages/tenancy/src/index.ts';

test('research claims cannot silently cite missing sources', () => {
  const errors = validateResearchResult({ query: 'test', sources: [], claims: [{ id: 'c1', text: 'unsupported claim', sourceIds: [], confidence: 'high' }], limitations: [] });
  assert.ok(errors.some((error) => error.includes('not marked unverified')));
});

test('research validator accepts an explicitly unverified claim', () => {
  const errors = validateResearchResult({ query: 'test', sources: [], claims: [{ id: 'c1', text: 'unverified', sourceIds: [], confidence: 'unverified' }], limitations: ['No sources retrieved'] });
  assert.deepEqual(errors, []);
});

test('tenant capability authorization fails closed', () => {
  assert.equal(authorizeTenantCapability(null, null, 'geo.read'), false);
  assert.equal(authorizeTenantCapability({ tenantId: 'a', userId: 'u' }, { tenantId: 'b', allowedCapabilities: ['*'] }, 'geo.read'), false);
  assert.equal(authorizeTenantCapability({ tenantId: 'a', userId: 'u' }, { tenantId: 'a', allowedCapabilities: ['geo.*'] }, 'geo.read'), true);
});
