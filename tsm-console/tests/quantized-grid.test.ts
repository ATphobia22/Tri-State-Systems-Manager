import { describe, expect, it } from 'vitest';
import { decodeQuantizedGrid, encodeQuantizedGrid } from '../src/lib/quantized-grid';
import quantizedDem from '../src/lib/flood-sim/world/data/source-derived-dem-posey.q16.json';

describe('quantized-grid (turbo quant / turbovec)', () => {
  it('round-trips synthetic data within half a quantum', () => {
    const values = new Float64Array(1024);
    for (let i = 0; i < values.length; i += 1) values[i] = 340 + Math.sin(i * 0.11) * 17.3;
    const { quants, min, scale, maxError } = encodeQuantizedGrid(values);
    expect(quants.length).toBe(values.length);
    expect(maxError).toBeLessThanOrEqual(scale / 2 + 1e-12);
    // decode path
    const bytes = Buffer.from(quants.buffer);
    const decoded = decodeQuantizedGrid({
      n: 32,
      quant: { encoding: 'uint16-le', min, scale, count: 1024 },
      data: bytes.toString('base64'),
    });
    expect(decoded.n).toBe(32);
    let worst = 0;
    for (let i = 0; i < values.length; i += 1) {
      const err = Math.abs(decoded.values[i] - values[i]);
      if (err > worst) worst = err;
    }
    expect(worst).toBeLessThanOrEqual(scale / 2 + 1e-12);
  });

  it('decodes the bundled Posey screening grid with negligible error', () => {
    const decoded = decodeQuantizedGrid(quantizedDem as never);
    expect(decoded.n).toBe(192);
    expect(decoded.values.length).toBe(192 * 192);
    const quantum = (quantizedDem as { quant: { scale: number } }).quant.scale;
    // Quantum must be far below the 62.5 ft cell size (screening-level precision).
    expect(quantum).toBeLessThan(0.01);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < decoded.values.length; i += 1) {
      const v = decoded.values[i];
      expect(Number.isFinite(v)).toBe(true);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    // Matches the manifest stats envelope (337.7–372.5 ft).
    expect(min).toBeGreaterThan(330);
    expect(max).toBeLessThan(380);
  });

  it('fail-closes on malformed bundles', () => {
    expect(() => decodeQuantizedGrid({} as never)).toThrow();
    expect(() => decodeQuantizedGrid({ n: 4, quant: { encoding: 'float32-le', min: 0, scale: 1, count: 16 }, data: 'AAAA' } as never)).toThrow();
    expect(() => decodeQuantizedGrid({ n: 4, quant: { encoding: 'uint16-le', min: 0, scale: 1, count: 16 }, data: 'AAAA' } as never)).toThrow();
  });
});
