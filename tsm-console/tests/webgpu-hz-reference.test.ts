import { describe, expect, it } from 'vitest';

type Grid = number[][];

function buildMaxPyramid(base: Grid): Grid[] {
  const levels = [base];
  while (Math.max(levels[levels.length - 1]!.length, levels[levels.length - 1]![0]!.length) > 1) {
    const source = levels[levels.length - 1]!;
    const sourceHeight = source.length;
    const sourceWidth = source[0]!.length;
    const targetWidth = Math.max(1, Math.floor(sourceWidth / 2));
    const targetHeight = Math.max(1, Math.floor(sourceHeight / 2));
    const target: Grid = Array.from({ length: targetHeight }, () => Array<number>(targetWidth).fill(0));
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const startX = Math.floor(x * sourceWidth / targetWidth);
        const endX = Math.floor((x + 1) * sourceWidth / targetWidth);
        const startY = Math.floor(y * sourceHeight / targetHeight);
        const endY = Math.floor((y + 1) * sourceHeight / targetHeight);
        let maximum = 0;
        for (let sy = startY; sy < endY; sy++) {
          for (let sx = startX; sx < endX; sx++) maximum = Math.max(maximum, source[sy]![sx]!);
        }
        target[y]![x] = maximum;
      }
    }
    levels.push(target);
  }
  return levels;
}

/** Mirrors the conservative bounds-selection math in WEBGPU_HZ_CULL_WGSL. */
function sampledMax(levels: Grid[], minX: number, minY: number, maxX: number, maxY: number): number {
  const base = levels[0]!;
  const baseHeight = base.length;
  const baseWidth = base[0]!.length;
  let level = 0;
  let loX = minX, loY = minY, hiX = maxX, hiY = maxY;
  while (true) {
    const spanX = hiX - loX + 1;
    const spanY = hiY - loY + 1;
    if ((spanX <= 2 && spanY <= 2) || level + 1 >= levels.length) break;
    level++;
    const mip = levels[level]!;
    const mipHeight = mip.length;
    const mipWidth = mip[0]!.length;
    const scaledLoX = Math.floor(minX * mipWidth / baseWidth);
    const scaledLoY = Math.floor(minY * mipHeight / baseHeight);
    const scaledHiExclusiveX = Math.max(1, Math.ceil((maxX + 1) * mipWidth / baseWidth));
    const scaledHiExclusiveY = Math.max(1, Math.ceil((maxY + 1) * mipHeight / baseHeight));
    // Match WGSL select(condition=all(scaledLo > 0)): when either coordinate
    // maps to zero, both lower bounds become zero. This only adds samples.
    if (scaledLoX > 0 && scaledLoY > 0) {
      loX = scaledLoX - 1;
      loY = scaledLoY - 1;
    } else {
      loX = 0;
      loY = 0;
    }
    hiX = Math.min(scaledHiExclusiveX, mipWidth - 1);
    hiY = Math.min(scaledHiExclusiveY, mipHeight - 1);
    hiX = Math.max(hiX, loX);
    hiY = Math.max(hiY, loY);
  }
  const mip = levels[level]!;
  let maximum = 0;
  for (let y = loY; y <= hiY; y++) {
    for (let x = loX; x <= hiX; x++) maximum = Math.max(maximum, mip[y]![x]!);
  }
  return maximum;
}

describe('hierarchical-Z conservative mip coverage reference', () => {
  it('never loses a farther-depth sample for any rectangle across odd/even dimensions', () => {
    for (let height = 1; height <= 9; height++) {
      for (let width = 1; width <= 9; width++) {
        const base: Grid = Array.from({ length: height }, (_, y) =>
          Array.from({ length: width }, (_, x) => ((x * 17 + y * 31 + width * 7 + height * 11) % 101) / 100),
        );
        // Place a far-depth hole at a deterministic interior location whenever possible.
        base[Math.floor(height / 2)]![Math.floor(width / 2)] = 1;
        const levels = buildMaxPyramid(base);
        for (let minY = 0; minY < height; minY++) {
          for (let maxY = minY; maxY < height; maxY++) {
            for (let minX = 0; minX < width; minX++) {
              for (let maxX = minX; maxX < width; maxX++) {
                let oracleMax = 0;
                for (let y = minY; y <= maxY; y++) {
                  for (let x = minX; x <= maxX; x++) oracleMax = Math.max(oracleMax, base[y]![x]!);
                }
                expect(sampledMax(levels, minX, minY, maxX, maxY)).toBeGreaterThanOrEqual(oracleMax);
              }
            }
          }
        }
      }
    }
  });

  it('preserves a far-depth hole in the conservative max pyramid', () => {
    const base: Grid = [
      [0.1, 0.2, 0.3, 0.4, 0.5],
      [0.1, 0.2, 1.0, 0.4, 0.5],
      [0.1, 0.2, 0.3, 0.4, 0.5],
    ];
    const levels = buildMaxPyramid(base);
    expect(sampledMax(levels, 0, 0, 4, 2)).toBe(1);
    expect(sampledMax(levels, 2, 1, 2, 1)).toBe(1);
  });
});
