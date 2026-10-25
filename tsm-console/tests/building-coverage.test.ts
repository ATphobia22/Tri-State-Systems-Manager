import { describe, expect, it } from 'vitest';
import { parsePublishedBuildingCoverage } from '../src/lib/building-coverage';

const good = {
  asset: {
    extras: {
      tsm: {
        authorityClass: 'DERIVED',
        engineeringUse: false,
        regulatoryUse: false,
        publishedFeatureCount: 22815,
        expectedAuthoritativeFeatureCount: 23082,
        sourceIdsReconciled: false,
        sourceInventoryVerified: false,
      },
    },
  },
};

describe('building 3D coverage disclosure', () => {
  it('reports partial counts without manufacturing missing OBJECTIDs', () => {
    expect(parsePublishedBuildingCoverage(good)).toEqual({
      published: 22815,
      expected: 23082,
      gap: 267,
      percent: 22815 / 23082 * 100,
      identityReconciled: false,
      sourceInventoryVerified: false,
    });
  });
  it('rejects missing count metadata and fake engineering-authority declarations', () => {
    expect(parsePublishedBuildingCoverage({})).toBeNull();
    expect(parsePublishedBuildingCoverage({
      asset: { extras: { tsm: { ...good.asset.extras.tsm, engineeringUse: true } } },
    })).toBeNull();
  });
  it('rejects invalid counts, including zero targets and fractional values', () => {
    for (const [publishedFeatureCount, expectedAuthoritativeFeatureCount] of [
      [1, 0], [-1, 4], [3.2, 4], [Number.NaN, 4], [3, Number.POSITIVE_INFINITY],
    ]) {
      expect(parsePublishedBuildingCoverage({
        asset: { extras: { tsm: { ...good.asset.extras.tsm, publishedFeatureCount, expectedAuthoritativeFeatureCount } } },
      })).toBeNull();
    }
  });
});
