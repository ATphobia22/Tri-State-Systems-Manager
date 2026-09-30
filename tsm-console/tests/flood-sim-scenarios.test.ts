import { describe, expect, it } from 'vitest';
import {
  listScenarios,
  getScenario,
  validateScenario,
  scenarioToEngineConfig,
  scenarioSeed,
} from '../src/lib/flood-sim/scenarios';
import { seedFromString } from '../src/lib/flood-sim/prng';

describe('flood-sim scenario registry', () => {
  it('ships exactly the two required flooding scenarios, all schema-valid', () => {
    // live-gauge-driven was retired 2026-09-29 (owner dropped live river data).
    const scenarios = listScenarios();
    expect(scenarios.map((s) => s.scenarioId).sort()).toEqual([
      '1937-ohio-river-flood',
      'q100-design-event',
    ]);
    for (const s of scenarios) {
      expect(validateScenario(s)).toEqual([]);
      expect(s.humanReviewRequired).toBe(true);
      expect(typeof s.source).toBe('string');
      expect(s.source.length).toBeGreaterThan(0);
    }
  });

  it('getScenario throws on unknown ids', () => {
    expect(() => getScenario('1937-historic')).toThrow(/unknown scenario/);
  });

  it('1937 scenario: only the sourced 54.0 ft value is factual; everything else provisional', () => {
    const s = getScenario('1937-ohio-river-flood');
    expect(s.provisional).toBe(true);
    expect(s.provisionalFields.length).toBeGreaterThan(0);
    // The ONLY sourced numeric value, with its citation.
    const peak = s.sourcedValues?.find((v) => v.field === 'evansvillePeakStageFt');
    expect(peak).toBeDefined();
    expect(peak?.value).toBe(54.0);
    expect(peak?.source).toMatch(/bric-fy2025-subapplication-narrative\.md/);
    expect(peak?.source).toMatch(/03322000/);
    // Hyetograph shape must be listed as provisional (no 1937 time series exists).
    expect(s.provisionalFields.some((f) => f.includes('hyetograph'))).toBe(true);
  });

  it('q100 scenario carries the repo constants and FIRM panel', () => {
    const s = getScenario('q100-design-event');
    const byField = Object.fromEntries((s.sourcedValues ?? []).map((v) => [v.field, v]));
    expect(byField['baseFloodElevationFtNavd88']?.value).toBe(375.0);
    expect(byField['lowestAdjacentGradeFtNavd88']?.value).toBe(377.2);
    expect(s.source).toMatch(/18129C0265C/);
    expect(s.provisional).toBe(true); // storm shape + terrain remain provisional
  });

  it('live-gauge-driven scenario is retired and unknown to the registry', () => {
    // Owner decision 2026-09-29: live river data dropped.
    expect(() => getScenario('live-gauge-driven')).toThrow(/unknown scenario/);
  });

  it('rejects scenarios that violate the honesty rules', () => {
    const base = getScenario('q100-design-event');
    const asJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

    // humanReviewRequired must be true
    const noReview = asJson({ ...base, humanReviewRequired: false });
    expect(validateScenario(noReview).some((e) => e.includes('humanReviewRequired'))).toBe(true);

    // provisional=true requires a non-empty provisionalFields list
    const noFields = asJson({ ...base, provisionalFields: [] });
    expect(validateScenario(noFields).some((e) => e.includes('provisionalFields'))).toBe(true);

    // missing required field fails schema validation
    const missingId = asJson(base);
    delete (missingId as Record<string, unknown>).scenarioId;
    expect(validateScenario(missingId).length).toBeGreaterThan(0);

    // bad enum value fails
    const badProv = asJson({ ...base, provenance: 'certified-fact' });
    expect(validateScenario(badProv).length).toBeGreaterThan(0);
  });
});

describe('scenarioToEngineConfig', () => {
  it('builds a deterministic engine config from each scenario', () => {
    for (const s of listScenarios()) {
      const cfg1 = scenarioToEngineConfig(s);
      const cfg2 = scenarioToEngineConfig(s);
      expect(cfg1.elevationFt).toEqual(cfg2.elevationFt);
      expect(cfg1.elevationFt.length).toBe(s.engine.ny);
      expect(cfg1.elevationFt[0].length).toBe(s.engine.nx);
      expect(cfg1.scenarioId).toBe(s.scenarioId);
      // String seeds hash deterministically.
      expect(cfg1.seed).toBe(seedFromString(s.scenarioId));
      expect(scenarioSeed(s)).toBe(seedFromString(s.scenarioId));
    }
  });

  it('maps structures onto the grid', () => {
    const cfg = scenarioToEngineConfig(getScenario('q100-design-event'));
    expect(cfg.structures?.length).toBeGreaterThan(0);
    for (const st of cfg.structures ?? []) {
      expect(st.cellRow).toBeLessThan(cfg.ny);
      expect(st.cellCol).toBeLessThan(cfg.nx);
    }
  });
});
