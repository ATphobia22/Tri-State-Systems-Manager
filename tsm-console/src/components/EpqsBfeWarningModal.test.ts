import { describe, expect, it } from 'vitest';
import {
  EPQS_TERRAIN_OPTION_LABELS,
  EPQS_WARNING_COPY,
  buildEpqsWarningIntro,
  requestTerrainModeChange,
} from './EpqsBfeWarningModal';

const ALL_COPY = [
  EPQS_WARNING_COPY.title,
  EPQS_WARNING_COPY.scopeNote,
  EPQS_WARNING_COPY.acknowledgeLabel,
  EPQS_WARNING_COPY.cancelLabel,
  ...EPQS_WARNING_COPY.bullets,
  buildEpqsWarningIntro('auto'),
  buildEpqsWarningIntro('live'),
].join('\n');

describe('EpqsBfeWarningModal copy — grounded facts', () => {
  it('states the regulatory BFE as 369.1 ft NAVD88 from FIS 18129CV000A Table 9', () => {
    expect(ALL_COPY).toContain('369.1 ft NAVD88');
    expect(ALL_COPY).toContain('18129CV000A');
    expect(ALL_COPY).toContain('Table 9');
  });

  it('states the verified 3DEP accuracy figures (dynamic + 1/3 arc-second, RMSE and 95%)', () => {
    expect(ALL_COPY).toContain('0.53 m RMSE');
    expect(ALL_COPY).toContain('±1.04 m');
    expect(ALL_COPY).toContain('0.82 m RMSE');
    expect(ALL_COPY).toContain('±1.61 m');
    expect(ALL_COPY).toContain('95%');
  });

  it('says the value is interpolated and derived, never surveyed, and screening-only', () => {
    expect(ALL_COPY).toContain('interpolated');
    expect(ALL_COPY).toContain('not a surveyed ground elevation');
    expect(ALL_COPY).toContain('Screening only');
    expect(ALL_COPY).toContain('Do not use it to judge a lot corner');
    expect(ALL_COPY).toContain('lowest adjacent grade');
    expect(ALL_COPY).toContain('LOMA outcome');
  });

  it('states the LOMA case status: 26-05-2022A open, not issued', () => {
    expect(ALL_COPY).toContain('26-05-2022A');
    expect(ALL_COPY).toContain('FEMA asked for more information');
    expect(ALL_COPY).toContain('has not been issued');
  });

  it('scopes itself as an engineering warning, never a certification or determination', () => {
    expect(ALL_COPY).toContain('engineering screening warning');
    expect(ALL_COPY).toContain('not a FEMA determination');
    expect(ALL_COPY).toContain('not a survey certification');
  });

  it('never writes the stale 375.0 BFE or the unverified bilinear claim', () => {
    expect(ALL_COPY).not.toContain('375.0');
    expect(ALL_COPY.toLowerCase()).not.toContain('bilinear');
  });

  it('names the picked terrain option in the intro', () => {
    expect(buildEpqsWarningIntro('auto')).toContain(
      'Auto (3DEP-derived screening grid)',
    );
    expect(buildEpqsWarningIntro('live')).toContain(
      'Live tiles (→ bundled grid fallback)',
    );
    expect(buildEpqsWarningIntro('auto')).toContain('Elevation Point Query Service (EPQS)');
  });
});

describe('requestTerrainModeChange — trigger decision', () => {
  it('returns null for a no-op pick (same mode): no warning', () => {
    expect(requestTerrainModeChange('auto', 'auto')).toBeNull();
    expect(requestTerrainModeChange('live', 'live')).toBeNull();
  });

  it('returns the pending mode when the user picks a different source', () => {
    expect(requestTerrainModeChange('auto', 'live')).toBe('live');
    expect(requestTerrainModeChange('live', 'auto')).toBe('auto');
  });
});

describe('EPQS_TERRAIN_OPTION_LABELS — wiring sync', () => {
  it('matches the FloodSimulator Terrain option text exactly', () => {
    expect(EPQS_TERRAIN_OPTION_LABELS.auto).toBe('Auto (3DEP-derived screening grid)');
    expect(EPQS_TERRAIN_OPTION_LABELS.live).toBe('Live tiles (→ bundled grid fallback)');
  });
});
