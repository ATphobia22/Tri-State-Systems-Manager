import { describe, it, expect } from 'vitest';
import {
  ERDC_TR224,
  DIKE_SCENARIOS,
  EHYDRO_SURVEYS,
  CONFLUENCE_LAYERS,
  getDikeScenario,
  listDikeScenarios,
  getEhydroSurvey,
  getConfluenceLayer,
} from './confluence-hydraulics';

describe('confluence-hydraulics registry', () => {
  it('pins the ERDC TR-22-4 report identity', () => {
    expect(ERDC_TR224.report).toBe('ERDC/CHL TR-22-4');
    expect(ERDC_TR224.doi).toBe('10.21079/11681/43441');
    expect(ERDC_TR224.model).toMatch(/AdH/);
    expect(ERDC_TR224.reportSha256).toHaveLength(64);
  });

  it('registers exactly the 5 report-documented dike scenarios, all validated', () => {
    expect(DIKE_SCENARIOS).toHaveLength(5);
    expect(DIKE_SCENARIOS.map((s) => s.id)).toEqual([
      'base',
      'it2-w3',
      'it2-md',
      'it2-pc330',
      'selected',
    ]);
    for (const s of DIKE_SCENARIOS) {
      expect(s.status).toBe('validated');
      expect(s.reportReference).toMatch(/ERDC\/CHL TR-22-4/);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it('selected alternative carries the 3+4 dike configuration and reported outcome', () => {
    const sel = getDikeScenario('selected');
    const total = sel.structures.reduce((n, st) => n + st.count, 0);
    expect(total).toBe(7);
    expect(sel.reportedOutcome).toMatch(/reduced/);
  });

  it('fail-closes on unknown scenario ids', () => {
    expect(() => getDikeScenario('it2-hp')).toThrow(/Unknown ERDC dike scenario/);
    expect(listDikeScenarios()).toHaveLength(5);
  });

  it('registers 20 eHydro surveys, all Ohio River Datum with unavailable NAVD88 offset', () => {
    expect(EHYDRO_SURVEYS).toHaveLength(20);
    for (const s of EHYDRO_SURVEYS) {
      expect(s.verticalDatum).toBe('Ohio River Datum');
      expect(s.navd88Offset).toBe('unavailable');
      expect(s.mileStart).toBeLessThanOrEqual(s.mileEnd);
      expect(s.soundingCount).toBeGreaterThan(0);
    }
    const miles = EHYDRO_SURVEYS.flatMap((s) => [s.mileStart, s.mileEnd]);
    expect(Math.min(...miles)).toBe(776);
    expect(Math.max(...miles)).toBe(976);
  });

  it('fail-closes on unknown survey ids', () => {
    expect(() => getEhydroSurvey('nope')).toThrow(/Unknown eHydro survey/);
  });

  it('defines confluence layers with honest data availability', () => {
    expect(CONFLUENCE_LAYERS).toHaveLength(2);
    const model = getConfluenceLayer('erdc-tr224-model');
    expect(model.dataAvailability).toBe('report-only');
    expect(model.datumNote).toMatch(/not publicly released/);
    const extents = getConfluenceLayer('ehydro-bathymetry-extents');
    expect(extents.dataAvailability).toBe('available');
    expect(extents.datumNote).toMatch(/never invented/);
    expect(() => getConfluenceLayer('nope')).toThrow(/Unknown confluence hydraulics layer/);
  });
});
