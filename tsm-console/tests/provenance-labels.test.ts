import { describe, expect, it } from 'vitest';
import {
  describeProvenance,
  isAuthoritativeLabel,
  makeProvenance,
  PROVENANCE_LABELS,
  type ProvenanceLabel,
} from '../src/lib/provenance-labels';
import { fetchCommunityGauges, type RiverGaugeDefinition } from '../src/lib/river-gauges';
import {
  type NativeDataFabricBridge,
  type NativeFetchGaugesResult,
  type NativeGaugeObservation,
  type NativeGaugeStation,
} from '../src/lib/native-data-fabric';

describe('PROVENANCE_LABELS', () => {
  it('contains exactly the eight specified labels', () => {
    expect([...PROVENANCE_LABELS]).toEqual([
      'FEMA-EFFECTIVE',
      'STATE-BEST',
      'OBSERVED',
      'MODELED',
      'FORECAST',
      'OWNER-SUPPLIED',
      'DERIVED',
      'UNAVAILABLE',
    ]);
  });
});

describe('makeProvenance validation', () => {
  it('throws on an unknown label', () => {
    expect(() => makeProvenance(['BOGUS' as ProvenanceLabel])).toThrow(/Unknown provenance label/);
  });

  it('throws on an empty label list', () => {
    expect(() => makeProvenance([])).toThrow(/at least one/);
  });

  it('throws when a mixed list contains an unknown label', () => {
    expect(() => makeProvenance(['OBSERVED', 'NOPE' as ProvenanceLabel])).toThrow(/Unknown provenance label/);
  });
});

describe('makeProvenance dedup and defaults', () => {
  it('deduplicates labels, preserving first-seen order', () => {
    const p = makeProvenance(['MODELED', 'DERIVED', 'MODELED', 'DERIVED', 'FORECAST']);
    expect([...p.labels]).toEqual(['MODELED', 'DERIVED', 'FORECAST']);
  });

  it('defaults retrievedAt to a current ISO-8601 timestamp', () => {
    const before = Date.now();
    const p = makeProvenance(['OBSERVED']);
    const after = Date.now();
    const parsed = Date.parse(p.retrievedAt);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(parsed).toBeGreaterThanOrEqual(before - 1_000);
    expect(parsed).toBeLessThanOrEqual(after + 1_000);
    expect(p.retrievedAt).toBe(new Date(parsed).toISOString());
  });

  it('honors explicit retrievedAt, sourceUri, and modelVersion', () => {
    const p = makeProvenance(['MODELED'], {
      retrievedAt: '2026-09-25T12:00:00.000Z',
      sourceUri: 'https://example.test/model-run/1',
      modelVersion: 'scs-cn-v1',
    });
    expect(p.retrievedAt).toBe('2026-09-25T12:00:00.000Z');
    expect(p.sourceUri).toBe('https://example.test/model-run/1');
    expect(p.modelVersion).toBe('scs-cn-v1');
  });
});

describe('isAuthoritativeLabel', () => {
  it('follows the full truth table', () => {
    const expected: Record<ProvenanceLabel, boolean> = {
      'FEMA-EFFECTIVE': true,
      'STATE-BEST': false,
      OBSERVED: true,
      MODELED: false,
      FORECAST: false,
      'OWNER-SUPPLIED': false,
      DERIVED: false,
      UNAVAILABLE: false,
    };
    for (const label of PROVENANCE_LABELS) {
      expect(isAuthoritativeLabel(label), label).toBe(expected[label]);
    }
  });
});

describe('describeProvenance', () => {
  it('formats labels, retrieval time, model version, and source URI', () => {
    const text = describeProvenance(
      makeProvenance(['MODELED', 'DERIVED'], {
        retrievedAt: '2026-09-25T13:00:00.000Z',
        modelVersion: 'scs-cn-v1',
      }),
    );
    expect(text).toBe('MODELED + DERIVED · retrieved 2026-09-25T13:00:00.000Z · scs-cn-v1');
  });

  it('omits optional parts when absent', () => {
    const text = describeProvenance(
      makeProvenance(['UNAVAILABLE'], { retrievedAt: '2026-09-25T13:00:00.000Z' }),
    );
    expect(text).toBe('UNAVAILABLE · retrieved 2026-09-25T13:00:00.000Z');
  });
});

const DEFINITIONS: RiverGaugeDefinition[] = [
  { id: 'usgs-03378500', provider: 'USGS', name: 'Wabash River at New Harmony, IN', river: 'Wabash River', usgsId: '03378500', variables: ['00065'], status: 'active' },
  { id: 'usgs-03322000', provider: 'USGS', name: 'Ohio River at Evansville, IN', river: 'Ohio River', usgsId: '03322000', variables: ['00065'], status: 'active' },
];

const NOW_MS = 1_750_000_000_000;

function nativeStation(partial: Partial<NativeGaugeStation> & { id: string }): NativeGaugeStation {
  return {
    name: 'Test Station',
    latitude: 38.0,
    longitude: -87.0,
    stageFt: 12.34,
    gageZeroNavd88Ft: 370.0,
    navd88WseFt: 382.34,
    status: 'LIVE OBSERVATION',
    provenanceSignature: '0xtest',
    ...partial,
  };
}

function fakeBridge(result: NativeFetchGaugesResult): NativeDataFabricBridge {
  return {
    isAvailable: () => true,
    fetchGauges: async () => result,
  };
}

describe('native gauge provenance wiring', () => {
  it('labels live native observations OBSERVED', async () => {
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'native',
      nativeBridge: fakeBridge({
        stations: [
          nativeStation({ id: 'USGS-03378500', status: 'LIVE OBSERVATION', stageFt: 12.34 }),
          nativeStation({ id: 'USGS-03322000', status: 'STALE', stageFt: 11.0 }),
        ],
      }),
      fetcher: (() => {
        throw new Error('web path must not be called');
      }) as unknown as typeof fetch,
    });
    const byId = new Map(observations.map((o) => [o.gaugeId, o as NativeGaugeObservation]));
    const live = byId.get('03378500');
    expect(live?.status).toBe('current');
    expect([...(live?.provenance.labels ?? [])]).toEqual(['OBSERVED']);
    expect(isAuthoritativeLabel(live?.provenance.labels[0] as ProvenanceLabel)).toBe(true);
    // A stale reading is still a sensor observation.
    expect([...(byId.get('03322000')?.provenance.labels ?? [])]).toEqual(['OBSERVED']);
  });

  it('labels unavailable native observations UNAVAILABLE', async () => {
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'native',
      nativeBridge: fakeBridge({
        stations: [
          nativeStation({ id: 'USGS-03378500', status: 'SOURCE UNAVAILABLE', stageFt: Number.NaN }),
          // 03322000 is missing from the payload entirely.
        ],
      }),
      fetcher: (() => {
        throw new Error('web path must not be called');
      }) as unknown as typeof fetch,
    });
    const byId = new Map(observations.map((o) => [o.gaugeId, o as NativeGaugeObservation]));
    for (const gaugeId of ['03378500', '03322000']) {
      const observation = byId.get(gaugeId);
      expect(observation?.status).toBe('unavailable');
      expect([...(observation?.provenance.labels ?? [])]).toEqual(['UNAVAILABLE']);
      expect(observation?.provenance.retrievedAt).toBe(new Date(NOW_MS).toISOString());
    }
  });

  it('labels an unknown wire status as UNAVAILABLE via fail-closed mapping', async () => {
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'native',
      nativeBridge: fakeBridge({
        stations: [nativeStation({ id: 'USGS-03378500', status: 'SOMETHING NEW' })],
      }),
      fetcher: (() => {
        throw new Error('web path must not be called');
      }) as unknown as typeof fetch,
    });
    const observation = new Map(observations.map((o) => [o.gaugeId, o as NativeGaugeObservation])).get('03378500');
    expect(observation?.status).toBe('unavailable');
    expect([...(observation?.provenance.labels ?? [])]).toEqual(['UNAVAILABLE']);
  });
});
