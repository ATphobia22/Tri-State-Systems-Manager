/**
 * terrain-rgb-pipeline.test.ts — Mapbox Terrain-RGB decoding and the
 * fail-closed HTTPS template validation for the production tile pyramid.
 */
import { describe, expect, it } from 'vitest';
import { decodeTerrainRgb } from '../src/lib/flood-sim/world/live-data';
import { resolveTerrainTemplate } from '../src/lib/twin-map-style';

describe('decodeTerrainRgb', () => {
  it('decodes the Mapbox Terrain-RGB encoding to feet', () => {
    // (0 m + 10000) * 10 = 100000 -> R=1, G=134, B=160
    const zero = decodeTerrainRgb(new Uint8ClampedArray([1, 134, 160, 255]), 1);
    expect(zero[0]).toBeCloseTo(0, 6);
    // ~360 ft ≈ 109.728 m -> enc 101097 -> 359.9 ft (0.1 m quantization)
    const enc = 101097;
    const rgb = new Uint8ClampedArray([(enc >> 16) & 255, (enc >> 8) & 255, enc & 255, 255]);
    expect(decodeTerrainRgb(rgb, 1)[0]).toBeCloseTo(360, 0);
  });

  it('throws on short buffers', () => {
    expect(() => decodeTerrainRgb(new Uint8ClampedArray(3), 1)).toThrow();
  });
});

describe('resolveTerrainTemplate (fail-closed)', () => {
  const good = 'https://tiles.river-valley.org/terrain_3dep/{z}/{x}/{y}.png';

  it('accepts a real https template', () => {
    expect(resolveTerrainTemplate(good)).toBe(good);
  });

  it('rejects empty, non-https, and incomplete templates', () => {
    expect(resolveTerrainTemplate('')).toBeNull();
    expect(resolveTerrainTemplate('   ')).toBeNull();
    expect(resolveTerrainTemplate('http://tiles.river-valley.org/terrain_3dep/{z}/{x}/{y}.png')).toBeNull();
    expect(resolveTerrainTemplate('https://tiles.river-valley.org/terrain_3dep/tile.png')).toBeNull();
    // Extension is not policed — only placeholders and insecure schemes fail closed.
    expect(resolveTerrainTemplate('https://tiles.river-valley.org/terrain_3dep/{z}/{x}/{y}.jpg')).toBe(
      'https://tiles.river-valley.org/terrain_3dep/{z}/{x}/{y}.jpg',
    );
  });

  it('rejects placeholders and loopback hosts', () => {
    expect(resolveTerrainTemplate('https://YOUR-HOST/terrain_3dep/{z}/{x}/{y}.png')).toBeNull();
    expect(resolveTerrainTemplate('https://example.com/terrain_3dep/{z}/{x}/{y}.png')).toBeNull();
    expect(resolveTerrainTemplate('https://tiles.example.com/terrain_3dep/{z}/{x}/{y}.png')).toBeNull();
    expect(resolveTerrainTemplate('https://localhost:3443/terrain_3dep/{z}/{x}/{y}.png')).toBeNull();
    expect(resolveTerrainTemplate('https://127.0.0.1:3443/terrain_3dep/{z}/{x}/{y}.png')).toBeNull();
  });
});
