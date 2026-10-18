import { describe, expect, it } from 'vitest';
import { nextOcclusionVisibility } from './webgl2-depth-occlusion';

describe('WebGL2 occlusion visibility hysteresis', () => {
  it('keeps a target visible after one zero-sample result', () => {
    expect(nextOcclusionVisibility(0, false)).toEqual({
      occluded: false,
      occludedFrames: 1,
    });
  });

  it('suppresses visibility only after consecutive zero-sample results', () => {
    const first = nextOcclusionVisibility(0, false);
    const second = nextOcclusionVisibility(first.occludedFrames, false);
    expect(second).toEqual({ occluded: true, occludedFrames: 2 });
  });

  it('restores visibility immediately after a passing result', () => {
    expect(nextOcclusionVisibility(5, true)).toEqual({
      occluded: false,
      occludedFrames: 0,
    });
  });

  it('supports explicit stricter hysteresis without changing the default', () => {
    const first = nextOcclusionVisibility(0, false, 3);
    const second = nextOcclusionVisibility(first.occludedFrames, false, 3);
    const third = nextOcclusionVisibility(second.occludedFrames, false, 3);
    expect(first.occluded).toBe(false);
    expect(second.occluded).toBe(false);
    expect(third).toEqual({ occluded: true, occludedFrames: 3 });
  });

  it('rejects malformed hysteresis state', () => {
    expect(() => nextOcclusionVisibility(-1, false)).toThrow(RangeError);
    expect(() => nextOcclusionVisibility(0, false, 0)).toThrow(RangeError);
    expect(() => nextOcclusionVisibility(1.5, false)).toThrow(RangeError);
  });
});
