import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync(new URL('../../integrations/apple-shortcuts/tsm-shortcuts-api.json', import.meta.url), 'utf8'));

test('Apple Shortcuts integration is a user-configured read-only GET', () => {
  assert.equal(contract.status, 'documented-user-configured');
  assert.equal(contract.request.method, 'GET');
  assert.equal(contract.request.path, '/api/hydrologic/community');
  assert.equal(contract.request.body, null);
  assert.equal(contract.operatingConstraints.userTriggeredOnly, true);
  assert.equal(contract.operatingConstraints.automaticPollingAllowed, false);
});

test('shortcut contract prohibits mutation routes and embedded secrets', () => {
  assert.equal(contract.operatingConstraints.mutationsAllowed, false);
  assert.equal(contract.operatingConstraints.alertWritesAllowed, false);
  assert.equal(contract.operatingConstraints.ingestionWritesAllowed, false);
  assert.equal(contract.operatingConstraints.credentialsEmbeddedInShortcut, false);
  assert.equal(contract.operatingConstraints.failClosedOnHttpError, true);
});

test('Apple documentation and TSM operations references are included', () => {
  const urls = contract.sourceReferences.map((item) => item.url);
  assert.ok(urls.some((url) => url.includes('support.apple.com/guide/shortcuts')));
  assert.ok(urls.some((url) => url.includes('REAL-TIME-DATA-OPERATIONS.md')));
});
