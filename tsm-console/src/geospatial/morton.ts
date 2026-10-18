/** Morton Z-order (2D) for implicit quadtree tile indices — 3D Tiles 1.1 style. */

function part1by1(n: number): number {
  n &= 0x0000ffff;
  n = (n | (n << 8)) & 0x00ff00ff;
  n = (n | (n << 4)) & 0x0f0f0f0f;
  n = (n | (n << 2)) & 0x33333333;
  n = (n | (n << 1)) & 0x55555555;
  return n >>> 0;
}

function compact1by1(n: number): number {
  n &= 0x55555555;
  n = (n | (n >>> 1)) & 0x33333333;
  n = (n | (n >>> 2)) & 0x0f0f0f0f;
  n = (n | (n >>> 4)) & 0x00ff00ff;
  n = (n | (n >>> 8)) & 0x0000ffff;
  return n >>> 0;
}

export function mortonEncode2(x: number, y: number): number {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    throw new RangeError('x,y must be non-negative integers');
  }
  return (part1by1(x) | (part1by1(y) << 1)) >>> 0;
}

export function mortonDecode2(code: number): { x: number; y: number } {
  const c = code >>> 0;
  return { x: compact1by1(c), y: compact1by1(c >>> 1) };
}

export function tileCountAtLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) throw new RangeError('level >= 0 integer');
  return 1 << (2 * level);
}
