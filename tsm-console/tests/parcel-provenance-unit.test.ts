import { describe, expect, it } from 'vitest';
import type { Map, MapMouseEvent } from 'maplibre-gl';
import { readParcelProvenance } from '../src/lib/parcel-provenance';

function setup(properties: Record<string, unknown> | null) {
  const map = {
    queryRenderedFeatures: () => properties === null ? [] : [{ properties }],
  } as unknown as Map;
  const event = { point: { x: 0, y: 0 } } as MapMouseEvent;
  return { map, event };
}

describe('parcel inspector preserves missing evidence', () => {
  it('never interprets absent or blank elevation as zero', () => {
    for (const props of [{}, { ground_elevation_navd88_ft: null },
                         { ground_elevation_navd88_ft: '' },
                         { ground_elevation_navd88_ft: '  ' }]) {
      const { map, event } = setup(props);
      expect(readParcelProvenance(map, event)?.elevationNavd88Ft).toBeNull();
    }
  });

  it('accepts actual finite values including a genuine numeric zero', () => {
    for (const raw of [0, '0', 382.25, '382.25']) {
      const { map, event } = setup({ ground_elevation_navd88_ft: raw });
      expect(readParcelProvenance(map, event)?.elevationNavd88Ft).toBe(Number(raw));
    }
  });

  it('rejects invalid scientific numbers and bogus evidence digests', () => {
    const { map, event } = setup({
      ground_elevation_navd88_ft: 'Infinity', evidence_sha256: 'NOT_A_SHA',
    });
    expect(readParcelProvenance(map, event)?.elevationNavd88Ft).toBeNull();
    expect(readParcelProvenance(map, event)?.evidenceSha256).toBeNull();
  });

  it('normalizes a real-format evidence hash without declaring verification', () => {
    const { map, event } = setup({
      evidence_sha256: 'A'.repeat(64), apn: 'synthetic-tract',
    });
    const result = readParcelProvenance(map, event);
    expect(result?.apn).toBe('synthetic-tract');
    expect(result?.evidenceSha256).toBe('a'.repeat(64));
    expect(result?.elevationNavd88Ft).toBeNull();
  });

  it('returns null when no feature is present', () => {
    const { map, event } = setup(null);
    expect(readParcelProvenance(map, event)).toBeNull();
  });
});
