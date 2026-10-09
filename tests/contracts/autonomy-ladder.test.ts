import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAutonomy, DEFAULT_AUTONOMY } from '../../packages/agent-runtime/src/AutonomyLadder.ts';

test('default autonomy is S1', () => {
  assert.equal(DEFAULT_AUTONOMY, 'S1');
});

test('S1 allows describe/read and denies write-like ids', () => {
  assert.equal(evaluateAutonomy('evidence.validate').allowed, true);
  assert.equal(evaluateAutonomy('gates.evaluate').allowed, true);
  assert.equal(evaluateAutonomy('ledger.append').allowed, false);
});

test('S2 requires human gate', () => {
  assert.equal(evaluateAutonomy('ledger.append', 'S2', false).allowed, false);
  assert.equal(evaluateAutonomy('ledger.append', 'S2', true).allowed, true);
});

test('S3 always denied', () => {
  assert.equal(evaluateAutonomy('anything', 'S3', true).allowed, false);
});
