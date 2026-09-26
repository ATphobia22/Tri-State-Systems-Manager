import { describe, expect, it } from 'vitest';
import { mulberry32, seedFromString } from '../src/lib/flood-sim/prng';

describe('mulberry32 PRNG', () => {
  it('is deterministic: same seed yields identical streams', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 1000; i += 1) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('nextUint32 is deterministic and covers the uint32 range', () => {
    const a = mulberry32(99);
    const seen = new Set<number>();
    let max = 0;
    for (let i = 0; i < 5000; i += 1) {
      const v = a.nextUint32();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      seen.add(v);
      if (v > max) max = v;
    }
    expect(seen.size).toBe(5000); // no repeats in 5000 draws (period 2^32)
    expect(max).toBeGreaterThan(0xf0000000); // reaches high range
  });

  it('next() stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge immediately', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('range() and intRange() respect bounds', () => {
    const rng = mulberry32(4242);
    for (let i = 0; i < 1000; i += 1) {
      const r = rng.range(-3, 7.5);
      expect(r).toBeGreaterThanOrEqual(-3);
      expect(r).toBeLessThan(7.5);
      const iv = rng.intRange(0, 10);
      expect(Number.isInteger(iv)).toBe(true);
      expect(iv).toBeGreaterThanOrEqual(0);
      expect(iv).toBeLessThanOrEqual(10);
    }
  });

  it('getState/setState round-trips the stream', () => {
    const rng = mulberry32(555);
    for (let i = 0; i < 10; i += 1) rng.next();
    const saved = rng.getState();
    const tail1 = [rng.next(), rng.next(), rng.next()];
    rng.setState(saved);
    const tail2 = [rng.next(), rng.next(), rng.next()];
    expect(tail2).toEqual(tail1);
  });

  it('seedFromString is deterministic and distributes', () => {
    expect(seedFromString('1937-ohio-river-flood')).toBe(seedFromString('1937-ohio-river-flood'));
    expect(seedFromString('1937-ohio-river-flood')).not.toBe(seedFromString('q100-design-event'));
    const s = seedFromString('live-gauge-driven');
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it('pins the algorithm identity via a known-answer vector', () => {
    // Guards against silent algorithm swaps: mulberry32(0) first uint32.
    const rng = mulberry32(0);
    expect(rng.nextUint32()).toBe(0x5be036b8);
    expect(mulberry32(1234).nextUint32()).toBe(0x12c375ae);
  });
});
