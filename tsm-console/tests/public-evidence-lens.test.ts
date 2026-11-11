import { describe, expect, it } from 'vitest';
import type { MapTwinLoaderData } from '../src/types/loaders';
import type { GovernmentSceneDetail } from '../src/lib/government-pmtiles-overlay';
import { deriveSceneEvidenceLens, summarizeSceneEvidence } from '../src/lib/public-evidence-lens';

const stage: MapTwinLoaderData['stage'] = {
  source: 'USGS',
  gaugeId: '03378500',
  value_ft: 12,
  timestamp: '2026-11-10T08:00:00Z',
  retrievedAt: '2026-11-10T08:01:00Z',
  status: 'current',
  qualifier: null,
  discharge_cfs: 2000,
  discharge_observedAt: '2026-11-10T08:00:00Z',
  discharge_status: 'current',
  floodCategory: 'unknown',
  vertical_reference: 'GAGE_DATUM',
  wse_navd88_ft: null,
  gage_zero_navd88_ft: null,
  conversion_applied: false,
};

const gov: GovernmentSceneDetail = {
  status: 'CHECKING_GOVERNMENT_SNAPSHOT',
  source: null,
  capturedAt: null,
  agency: null,
  sourceVersion: null,
  datasetId: null,
  validation: null,
  tilesSha256: null,
  sourceSha256: null,
  merkleRootSha256: null,
  archiveBytesVerified: false,
  sourceBytesIndependentlyVerified: false,
  authoritativeEngineeringUse: false,
  regulatoryApproval: false,
  reason: 'Checking.',
};

describe('public evidence lens is informational and fail-honest', () => {
  it('does not infer a WSE from gage stage', () => {
    const result = deriveSceneEvidenceLens(stage, gov, { enabled: false, status: 'disabled' });
    expect(result[0].state).toBe('VALUE_UNREVIEWED');
    expect(result[1].state).toBe('UNRESOLVED_DATUM');
    expect(result[2].state).toBe('SOURCE_UNAVAILABLE');
    expect(result[3].state).toBe('SOURCE_UNAVAILABLE');
    expect(summarizeSceneEvidence(result).independentlyCertified).toBe(0);
  });

  it('preserves unavailable and stale observation states', () => {
    const missing = deriveSceneEvidenceLens({
      ...stage, source: 'UNAVAILABLE', value_ft: null, status: 'unavailable',
    }, gov, { enabled: true, status: 'error' });
    expect(missing[0].state).toBe('SOURCE_UNAVAILABLE');
    const stale = deriveSceneEvidenceLens({
      ...stage, status: 'stale',
    }, gov, { enabled: false, status: 'disabled' });
    expect(stale[0].state).toBe('STALE_OBSERVATION');
    const undated = deriveSceneEvidenceLens({
      ...stage, timestamp: null,
    }, gov, { enabled: false, status: 'disabled' });
    expect(undated[0].state).toBe('OBSERVATION_TIME_UNKNOWN');
  });

  it('separates dated archive integrity from independently validated source and authority', () => {
    const archived = deriveSceneEvidenceLens(stage, {
      ...gov, status: 'CURRENT_GOVERNMENT_SNAPSHOT', archiveBytesVerified: true,
    }, { enabled: false, status: 'disabled' });
    expect(archived[2].state).toBe('VALUE_UNREVIEWED');
    expect(archived[2].detail).toMatch(/not established/);
    const historical = deriveSceneEvidenceLens(stage, {
      ...gov, status: 'HISTORICAL_GOVERNMENT_FALLBACK', archiveBytesVerified: true,
    }, { enabled: false, status: 'disabled' });
    expect(historical[2].state).toBe('HISTORICAL_SNAPSHOT');
  });

  it('labels rendered 3D content visualization-only', () => {
    const rendered = deriveSceneEvidenceLens(stage, gov, { enabled: true, status: 'ready' });
    expect(rendered[3].state).toBe('DERIVED_VISUAL_ONLY');
    expect(rendered[3].detail).toMatch(/not establish.*accuracy/);
    expect(summarizeSceneEvidence(rendered).independentlyCertified).toBe(0);
  });

  it('does not elevate a reported gage conversion to certified datum evidence', () => {
    const checked = deriveSceneEvidenceLens({
      ...stage, wse_navd88_ft: 382.5, gage_zero_navd88_ft: 370.5, conversion_applied: true,
    }, gov, { enabled: false, status: 'disabled' });
    expect(checked[1].state).toBe('VALUE_UNREVIEWED');
    expect(checked[1].detail).toMatch(/independent review/);
  });
});
