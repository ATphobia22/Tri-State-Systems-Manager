import { describe, expect, it } from 'vitest';
import { AdaptiveSseBudget } from '../src/lib/adaptive-sse-budget';

describe('AdaptiveSseBudget', () => {
  const createBudget = () => new AdaptiveSseBudget({
    baseSse: 16,
    minFps: 30,
    recoveryFps: 38,
  });

  it('preserves baseline before a valid frame-rate sample', () => {
    const budget = createBudget();
    expect(budget.update(null)).toBe(16);
    expect(budget.update(Number.NaN)).toBe(16);
    expect(budget.value).toBe(16);
  });

  it('raises SSE under load to reduce refinement pressure', () => {
    const budget = createBudget();
    expect(budget.update(20)).toBeCloseTo(20);
    expect(budget.update(20)).toBeCloseTo(25);
  });

  it('recovers detail only above the recovery hysteresis threshold', () => {
    const budget = createBudget();
    budget.update(20);
    expect(budget.update(34)).toBeCloseTo(20);
    expect(budget.update(45)).toBeCloseTo(16);
  });

  it('clamps SSE to its configured bounds', () => {
    const budget = new AdaptiveSseBudget({
      baseSse: 16,
      minFps: 30,
      recoveryFps: 38,
      minSse: 8,
      maxSse: 20,
    });
    for (let i = 0; i < 20; i++) budget.update(10);
    expect(budget.value).toBe(20);
    for (let i = 0; i < 20; i++) budget.update(60);
    expect(budget.value).toBe(8);
  });

  it('rejects invalid configuration', () => {
    expect(() => new AdaptiveSseBudget({
      baseSse: 0,
      minFps: 30,
      recoveryFps: 38,
    })).toThrow(RangeError);
  });

  it('resets to the configured baseline during layer teardown', () => {
    const budget = createBudget();
    budget.update(15);
    budget.reset();
    expect(budget.value).toBe(16);
  });
});
