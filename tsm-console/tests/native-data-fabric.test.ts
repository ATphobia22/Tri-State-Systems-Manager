import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCommunityGauges,
  getPreferredGaugeDataSource,
  type RiverGaugeDefinition,
} from '../src/lib/river-gauges';
import {
  mapNativeGaugeStatus,
  type NativeDataFabricBridge,
  type NativeFetchGaugesResult,
  type NativeGaugeStation,
} from '../src/lib/native-data-fabric';

const DEFINITIONS: RiverGaugeDefinition[] = [
  { id: 'usgs-03378500', provider: 'USGS', name: 'Wabash River at New Harmony, IN', river: 'Wabash River', usgsId: '03378500', variables: ['00065'], status: 'active' },
  { id: 'usgs-03322000', provider: 'USGS', name: 'Ohio River at Evansville, IN', river: 'Ohio River', usgsId: '03322000', variables: ['00065'], status: 'active' },
  { id: 'usgs-03322420', provider: 'USGS', name: 'Ohio River at J.T. Myers Dam Pool', river: 'Ohio River', usgsId: '03322420', variables: ['00065'], status: 'candidate_realtime_station' },
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

function fakeBridge(available: boolean, result: NativeFetchGaugesResult | Error = { stations: [] }): NativeDataFabricBridge {
  return {
    isAvailable: () => available,
    fetchGauges: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

function webFetcher(observations: Array<Record<string, unknown>>): { fetcher: typeof fetch; calls: () => number } {
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ observations }),
    };
  }) as unknown as typeof fetch;
  return { fetcher, calls: () => calls };
}

/**
 * Stubs the global fetch used by the merged resilient web path
 * (resilientFetchJson + USGS direct fallback). The community endpoint
 * returns the given observations; every other URL fails fast so tests
 * stay hermetic (no live network).
 */
function stubWebFetch(observations: Array<Record<string, unknown>>): {
  communityCalls: () => number;
  restore: () => void;
} {
  let communityCalls = 0;
  const mockFetch = (async (url: unknown) => {
    const urlString = String(url);
    if (urlString.includes('/api/hydrologic/community')) {
      communityCalls += 1;
      return { ok: true, status: 200, json: async () => ({ observations }) };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', mockFetch);
  return { communityCalls: () => communityCalls, restore: () => vi.unstubAllGlobals() };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mapNativeGaugeStatus', () => {
  it('maps every documented wire status', () => {
    expect(mapNativeGaugeStatus('LIVE OBSERVATION')).toBe('current');
    expect(mapNativeGaugeStatus('STALE')).toBe('stale');
    expect(mapNativeGaugeStatus('CANDIDATE')).toBe('candidate');
    expect(mapNativeGaugeStatus('SOURCE UNAVAILABLE')).toBe('unavailable');
  });

  it('fails closed on unknown or malformed wire values', () => {
    expect(mapNativeGaugeStatus('BOGUS')).toBe('unavailable');
    expect(mapNativeGaugeStatus('')).toBe('unavailable');
    expect(mapNativeGaugeStatus(null)).toBe('unavailable');
    expect(mapNativeGaugeStatus(undefined)).toBe('unavailable');
    expect(mapNativeGaugeStatus(42)).toBe('unavailable');
  });
});

describe('gauge data source selection', () => {
  const nativeResult: NativeFetchGaugesResult = {
    stations: [
      nativeStation({ id: 'USGS-03378500', status: 'LIVE OBSERVATION', stageFt: 12.34 }),
      nativeStation({ id: 'USGS-03322000', status: 'SOURCE UNAVAILABLE' }),
    ],
  };

  it('prefers the native plugin when available in auto mode', async () => {
    const web = webFetcher([]);
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'auto',
      nativeBridge: fakeBridge(true, nativeResult),
      fetcher: web.fetcher,
    });
    expect(web.calls()).toBe(0);
    const byId = new Map(observations.map((o) => [o.gaugeId, o]));
    expect(byId.get('03378500')?.status).toBe('current');
    expect(byId.get('03378500')?.value).toBe(12.34);
    expect(byId.get('03378500')?.provider).toBe('USGS');
    expect(byId.get('03322000')?.status).toBe('unavailable');
    // Candidate definitions keep their candidate status on the native path.
    expect(byId.get('03322420')?.status).toBe('candidate');
  });

  it('uses the web path in auto mode when the native plugin is unavailable', async () => {
    const observedAt = new Date(NOW_MS - 60_000).toISOString();
    const stub = stubWebFetch([{ stationId: '03378500', value: 10.5, observedAt, provider: 'USGS' }]);
    try {
      const observations = await fetchCommunityGauges(DEFINITIONS, {
        nowMs: NOW_MS,
        maxAgeMs: 30 * 60 * 1000,
        source: 'auto',
        nativeBridge: fakeBridge(false),
      });
      expect(stub.communityCalls()).toBeGreaterThan(0);
      const byId = new Map(observations.map((o) => [o.gaugeId, o]));
      expect(byId.get('03378500')?.status).toBe('current');
      expect(byId.get('03378500')?.value).toBe(10.5);
      expect(byId.get('03378500')?.provenancePath).toBe('tsm-community');
    } finally {
      stub.restore();
    }
  });

  it('falls back to web in auto mode when the native call throws', async () => {
    const observedAt = new Date(NOW_MS - 60_000).toISOString();
    const stub = stubWebFetch([{ stationId: '03378500', value: 9.5, observedAt, provider: 'USGS' }]);
    try {
      const observations = await fetchCommunityGauges(DEFINITIONS, {
        nowMs: NOW_MS,
        maxAgeMs: 30 * 60 * 1000,
        source: 'auto',
        nativeBridge: fakeBridge(true, new Error('native boom')),
      });
      expect(stub.communityCalls()).toBeGreaterThan(0);
      const byId = new Map(observations.map((o) => [o.gaugeId, o]));
      expect(byId.get('03378500')?.status).toBe('current');
      expect(byId.get('03378500')?.value).toBe(9.5);
    } finally {
      stub.restore();
    }
  });

  it('fails closed without silent web fallback when source is explicitly native', async () => {
    const web = webFetcher([]);
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'native',
      nativeBridge: fakeBridge(true, new Error('native boom')),
      fetcher: web.fetcher,
    });
    expect(web.calls()).toBe(0);
    const byId = new Map(observations.map((o) => [o.gaugeId, o]));
    expect(byId.get('03378500')?.status).toBe('unavailable');
    expect(byId.get('03322000')?.status).toBe('unavailable');
    expect(byId.get('03378500')?.error).toMatch(/native boom/);
    // Nothing may present as live after a native failure.
    expect(observations.some((o) => o.status === 'current')).toBe(false);
    expect(byId.get('03322420')?.status).toBe('candidate');
  });

  it('uses the web path when source is explicitly web, even with native available', async () => {
    let nativeCalls = 0;
    const bridge = fakeBridge(true, nativeResult);
    const countingBridge: NativeDataFabricBridge = {
      isAvailable: () => bridge.isAvailable(),
      fetchGauges: async () => {
        nativeCalls += 1;
        return bridge.fetchGauges();
      },
    };
    const stub = stubWebFetch([]);
    try {
      await fetchCommunityGauges(DEFINITIONS, {
        nowMs: NOW_MS,
        source: 'web',
        nativeBridge: countingBridge,
      });
      expect(nativeCalls).toBe(0);
      expect(stub.communityCalls()).toBeGreaterThan(0);
    } finally {
      stub.restore();
    }
  });

  it('marks stations with unknown native statuses as unavailable', async () => {
    const web = webFetcher([]);
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'native',
      nativeBridge: fakeBridge(true, {
        stations: [nativeStation({ id: 'USGS-03378500', status: 'SOMETHING NEW' })],
      }),
      fetcher: web.fetcher,
    });
    expect(new Map(observations.map((o) => [o.gaugeId, o])).get('03378500')?.status).toBe('unavailable');
  });

  it('never reports live for a native live claim without a numeric stage', async () => {
    const web = webFetcher([]);
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'native',
      nativeBridge: fakeBridge(true, {
        stations: [nativeStation({ id: 'USGS-03378500', status: 'LIVE OBSERVATION', stageFt: Number.NaN })],
      }),
      fetcher: web.fetcher,
    });
    const observation = new Map(observations.map((o) => [o.gaugeId, o])).get('03378500');
    expect(observation?.status).toBe('unavailable');
    expect(observation?.error).toMatch(/without a numeric stage value/);
  });

  it('marks native stations missing from the payload as unavailable, never guessed', async () => {
    const web = webFetcher([]);
    const observations = await fetchCommunityGauges(DEFINITIONS, {
      nowMs: NOW_MS,
      source: 'native',
      nativeBridge: fakeBridge(true, { stations: [] }),
      fetcher: web.fetcher,
    });
    const byId = new Map(observations.map((o) => [o.gaugeId, o]));
    expect(byId.get('03378500')?.status).toBe('unavailable');
    expect(byId.get('03378500')?.value).toBeNull();
  });
});

describe('getPreferredGaugeDataSource', () => {
  it('reports native when the bridge is available', () => {
    expect(getPreferredGaugeDataSource(fakeBridge(true))).toBe('native');
  });

  it('reports web when the bridge is unavailable or throws', () => {
    expect(getPreferredGaugeDataSource(fakeBridge(false))).toBe('web');
    expect(
      getPreferredGaugeDataSource({
        isAvailable: () => {
          throw new Error('nope');
        },
        fetchGauges: async () => ({ stations: [] }),
      }),
    ).toBe('web');
  });
});
