import { createHash } from 'node:crypto';

function requireFiniteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  return value;
}

export function evaluateCompensatoryStorage(req) {
  if (typeof req?.plan_id !== 'string' || req.plan_id.trim() === '') {
    throw new TypeError('plan_id is required');
  }

  const fillVolume = requireFiniteNumber(req.fill_volume_cuft, 'fill_volume_cuft');
  const excavationVolume = requireFiniteNumber(req.excavation_volume_cuft, 'excavation_volume_cuft');
  const ratio = requireFiniteNumber(req.required_ratio, 'required_ratio');

  if (fillVolume < 0 || excavationVolume < 0 || ratio <= 0) {
    throw new RangeError('volumes must be non-negative and required_ratio must be greater than zero');
  }

  const requiredExcavation = fillVolume * ratio;
  const deficit = Math.max(0, requiredExcavation - excavationVolume);
  const isCompliant = deficit <= 0.0001;
  const canonical = JSON.stringify({
    plan_id: req.plan_id,
    fill_volume_cuft: fillVolume,
    excavation_volume_cuft: excavationVolume,
    required_ratio: ratio,
  });
  const computedHash = createHash('sha256').update(`TSM_ENGINE_LEAF:${canonical}`).digest('hex');

  return {
    plan_id: req.plan_id,
    required_excavation_cuft: requiredExcavation,
    measured_volume_deficit_cuft: deficit,
    is_compliant: isCompliant,
    model_compliance_pass: isCompliant,
    regulatory_determination: null,
    evidence_artifact_hash: `sha256:${computedHash}`,
    authority_disclaimer: 'MODEL_OUTPUT_ONLY. Professional Engineer and applicable authority review required.',
  };
}
