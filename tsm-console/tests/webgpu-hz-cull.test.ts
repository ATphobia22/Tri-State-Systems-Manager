import { describe, expect, it } from 'vitest';
import { WEBGPU_HZ_CULL_WGSL } from '../src/lib/webgpu-hierarchical-z-cull';

describe('hierarchical-Z conservative mip bounds', () => {
  it('uses ceil-style upper bounds and expands by a safety texel', () => {
    // For a 5->2 reduction, source pixels 2, 3, and 4 can contribute to
    // mip texel 1. The former floor((max+1)*2/5)-1 formula incorrectly
    // stopped at texel 0 when maxPixel was 2 or 3.
    expect(WEBGPU_HZ_CULL_WGSL).toContain('scaledHiExclusive');
    expect(WEBGPU_HZ_CULL_WGSL).toContain('baseDims - vec2<u32>(1u)');
    expect(WEBGPU_HZ_CULL_WGSL).toContain('lo = select(vec2<u32>(0u), scaledLo - vec2<u32>(1u)');
    expect(WEBGPU_HZ_CULL_WGSL).not.toContain('let endExclusive = max(vec2<u32>(1u), ((maxPixel + vec2<u32>(1u)) * levelDims) / baseDims)');
  });

  it('keeps invalid and offscreen candidates fail-open', () => {
    expect(WEBGPU_HZ_CULL_WGSL).toContain('visibility[index] = 1u;');
    expect(WEBGPU_HZ_CULL_WGSL).toContain('rect.z < 0.0 || rect.w < 0.0');
    expect(WEBGPU_HZ_CULL_WGSL).toContain('isNan(c.nearestDepth) || isInf(c.nearestDepth)');
  });
});
