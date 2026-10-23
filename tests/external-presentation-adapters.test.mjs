import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXTERNAL_ADAPTERS,
  invokeExternalAdapter,
} from '../integrations/adapters/external-presentation-adapters.mjs';

test('all planned external adapters are boundary-ready and fail closed', () => {
  for (const id of Object.keys(EXTERNAL_ADAPTERS)) {
    const result = invokeExternalAdapter(id);
    assert.equal(result.ok, false);
    assert.ok(result.reason);
  }
});

test('unknown adapter fails closed', () => {
  const result = invokeExternalAdapter('not-a-real-adapter');
  assert.equal(result.ok, false);
});
