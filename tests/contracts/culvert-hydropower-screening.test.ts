import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateHydraulicPower } from '../../packages/hydraulics/src/culvert-hydropower';

test('hydraulic power uses rho*g*Q*H and applies total efficiency', () => {
  const result = estimateHydraulicPower({
    turbineFlowM3PerSecond: 0.5,
    netHeadMetres: 2,
    totalEfficiency: 0.6,
  });
  assert.equal(result.classification, 'SCREENING_ONLY');
  assert.ok(Math.abs(result.hydraulicPowerWatts - (1000 * 9.80665 * 0.5 * 2)) < 1e-9);
  assert.ok(Math.abs(result.estimatedElectricalPowerWatts - (1000 * 9.80665 * 0.5 * 2 * 0.6)) < 1e-9);
  assert.equal(result.estimatedElectricalPowerKilowatts, result.estimatedElectricalPowerWatts / 1000);
  assert.ok(result.requiredEvidence.length >= 5);
  assert.ok(result.limitations.some(value => value.includes('not a design')));
});

test('zero turbine-available flow or zero net head yields zero screening power', () => {
  assert.equal(estimateHydraulicPower({ turbineFlowM3PerSecond: 0, netHeadMetres: 2, totalEfficiency: 0.5 }).estimatedElectricalPowerWatts, 0);
  assert.equal(estimateHydraulicPower({ turbineFlowM3PerSecond: 1, netHeadMetres: 0, totalEfficiency: 0.5 }).estimatedElectricalPowerWatts, 0);
});

test('invalid physical inputs fail closed', () => {
  for (const input of [
    { turbineFlowM3PerSecond: -1, netHeadMetres: 2, totalEfficiency: 0.5 },
    { turbineFlowM3PerSecond: 1, netHeadMetres: -2, totalEfficiency: 0.5 },
    { turbineFlowM3PerSecond: 1, netHeadMetres: 2, totalEfficiency: 0 },
    { turbineFlowM3PerSecond: 1, netHeadMetres: 2, totalEfficiency: 1.1 },
    { turbineFlowM3PerSecond: Number.NaN, netHeadMetres: 2, totalEfficiency: 0.5 },
  ]) assert.throws(() => estimateHydraulicPower(input), RangeError);
});

test('custom water density and gravity are captured in the output assumptions', () => {
  const result = estimateHydraulicPower({
    turbineFlowM3PerSecond: 1,
    netHeadMetres: 1,
    totalEfficiency: 1,
    waterDensityKgPerM3: 998,
    gravityMetresPerSecondSquared: 9.81,
  });
  assert.equal(result.hydraulicPowerWatts, 998 * 9.81);
  assert.equal(result.assumptions.waterDensityKgPerM3, 998);
  assert.equal(result.assumptions.gravityMetresPerSecondSquared, 9.81);
});
