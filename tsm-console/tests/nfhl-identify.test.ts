import { describe, expect, it, vi, afterEach } from 'vitest';
import { identifyNfhlAtPoint } from '../src/lib/nfhlIdentify';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('identifyNfhlAtPoint', () => {
  it('returns SOFT_FAIL when the fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await identifyNfhlAtPoint(-88.005075, 37.845887);
    expect(result.status).toBe('SOFT_FAIL');
    expect(result.results).toEqual([]);
    expect(result.reason).toContain('network down');
    expect(result.requestUrl).toContain('hazards.fema.gov');
  });

  it('returns SOFT_FAIL on non-OK HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const result = await identifyNfhlAtPoint(-88.005075, 37.845887);
    expect(result.status).toBe('SOFT_FAIL');
    expect(result.reason).toBe('HTTP 503');
  });

  it('returns OK with results on success', async () => {
    const payload = { results: [{ layerName: 'Flood Hazard Zones', value: 'AE' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
    );
    const result = await identifyNfhlAtPoint(-88.005075, 37.845887);
    expect(result.status).toBe('OK');
    expect(result.results).toEqual(payload.results);
  });

  it('never reports OK with an empty reason on failure paths', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')));
    const result = await identifyNfhlAtPoint(-88.005075, 37.845887);
    expect(result.status).not.toBe('OK');
    expect(result.reason).toBeTruthy();
  });
});
