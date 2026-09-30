import assert from 'node:assert/strict';
import test from 'node:test';

test('gateway package loads under Node 22 TypeScript stripping', async () => {
  const module = await import('./server.ts');
  assert.ok(module);
});
