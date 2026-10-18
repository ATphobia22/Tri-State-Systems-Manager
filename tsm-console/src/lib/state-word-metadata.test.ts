import { describe, expect, it } from 'vitest';
import { encodeStateWord } from './state-word-codec';
import {
  decodeFeatureStateWord,
  type MeshFeaturesReader,
  type StructuralMetadataReader,
} from './state-word-metadata';

function fixture(
  row: unknown,
  propertyTable = 0,
): { metadata: StructuralMetadataReader; meshFeatures: MeshFeaturesReader } {
  return {
    metadata: {
      getPropertyTableInfo: () => [{ name: 'building', className: 'building' }],
      getPropertyTableData: (tables, ids) => {
        if (tables[0] !== propertyTable || ids[0] !== 42) return [];
        return [row];
      },
    },
    meshFeatures: {
      getFeatureInfo: () => [{ label: 'building', propertyTable, nullFeatureId: null }],
    },
  };
}

describe('decodeFeatureStateWord', () => {
  it('reads a valid stateWord from the linked feature property table', () => {
    const word = encodeStateWord({ B: 1, D: 2, C: 3, T: 2, S: 1 });
    const { metadata, meshFeatures } = fixture({ OBJECTID: 42, stateWord: word });
    expect(decodeFeatureStateWord(metadata, meshFeatures, 42)).toBe(word);
  });

  it('returns null for legacy OBJECTID-only metadata instead of inventing a state', () => {
    const { metadata, meshFeatures } = fixture({ OBJECTID: 42 });
    expect(decodeFeatureStateWord(metadata, meshFeatures, 42)).toBeNull();
  });

  it('returns null for feature IDs without a property-table row', () => {
    const { metadata, meshFeatures } = fixture({ OBJECTID: 42 });
    expect(decodeFeatureStateWord(metadata, meshFeatures, 7)).toBeNull();
  });

  it('rejects malformed stateWord values and reserved patterns', () => {
    const nonNumeric = fixture({ stateWord: '0x1234' });
    expect(() => decodeFeatureStateWord(nonNumeric.metadata, nonNumeric.meshFeatures, 42)).toThrow(TypeError);
    const invalidBits = fixture({ stateWord: 0xffff });
    expect(() => decodeFeatureStateWord(invalidBits.metadata, invalidBits.meshFeatures, 42)).toThrow(RangeError);
  });

  it('rejects an invalid feature ID before querying metadata', () => {
    const { metadata, meshFeatures } = fixture({ stateWord: 0 });
    expect(() => decodeFeatureStateWord(metadata, meshFeatures, -1)).toThrow(RangeError);
    expect(() => decodeFeatureStateWord(metadata, meshFeatures, Number.NaN)).toThrow(RangeError);
  });

  it('ignores feature sets that do not reference a property table', () => {
    const { metadata } = fixture({ stateWord: 0 });
    const meshFeatures = { getFeatureInfo: () => [{ propertyTable: null }] };
    expect(decodeFeatureStateWord(metadata, meshFeatures, 42)).toBeNull();
  });
});
