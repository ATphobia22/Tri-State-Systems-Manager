import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCompensatoryStorage } from '../server/engineering/compensatory-storage.mjs';

test('passes when excavation meets configured required ratio', () => {
  const result = evaluateCompensatoryStorage({
    plan_id: 'PLAN-001',
    fill_volume_cuft: 50000,
    excavation_volume_cuft: 60000,
    required_ratio: 1.2,
  });

  assert.equal(result.is_compliant, true);
  assert.equal(result.required_excavation_cuft, 60000);
  assert.equal(result.measured_volume_deficit_cuft, 0);
  assert.match(result.evidence_artifact_hash, /^sha256:[a-f0-9]{64}$/);
});

test('fails when excavation is deficient', () => {
  const result = evaluateCompensatoryStorage({
    plan_id: 'PLAN-002',
    fill_volume_cuft: 50000,
    excavation_volume_cuft: 59000,
    required_ratio: 1.2,
  });

  assert.equal(result.is_compliant, false);
  assert.equal(result.measured_volume_deficit_cuft, 1000);
});

test('rejects invalid or non-finite request values', () => {
  assert.throws(() => evaluateCompensatoryStorage({
    plan_id: '',
    fill_volume_cuft: 50000,
    excavation_volume_cuft: 60000,
    required_ratio: 1.2,
  }), /plan_id/);
});
