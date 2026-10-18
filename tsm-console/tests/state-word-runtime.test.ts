import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  decodeStateWord,
  encodeStateWord,
  readStateWordFromMesh,
  stateWordForFrameBudget,
  degradeStateWordOneStep,
} from '../src/lib/tiles-3d-renderer-layer';

const baseline = () => encodeStateWord({ B: 1, D: 1, C: 1, T: 1, S: 1 });

function makeFeatureMesh(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  return mesh;
}

describe('runtime StateWord metadata binding', () => {
  it('resolves StateWord via the associated structural-metadata property table', () => {
    const mesh = makeFeatureMesh();
    const word = encodeStateWord({ B: 3, D: 2, C: 1, T: 3, S: 0 });
    mesh.userData.meshFeatures = {
      getFeatureInfo: () => [{ propertyTable: null }, { propertyTable: 2 }],
      getFeatures: () => [17, 7],
    };
    mesh.userData.structuralMetadata = {
      getPropertyTableData: (tableIndices: number[], ids: number[]) => {
        expect(tableIndices).toEqual([2]);
        expect(ids).toEqual([7]);
        return [{ OBJECTID: 5001, StateWord: word }];
      },
    };

    expect(readStateWordFromMesh(mesh)).toBe(word);
    expect(decodeStateWord(readStateWordFromMesh(mesh) ?? 0, 'T')).toBe(3);
  });

  it('fails closed when feature metadata is missing or the state word is reserved', () => {
    const mesh = makeFeatureMesh();
    expect(readStateWordFromMesh(mesh)).toBeNull();

    mesh.userData.meshFeatures = {
      getFeatureInfo: () => [{ propertyTable: 0 }],
      getFeatures: () => [0],
    };
    mesh.userData.structuralMetadata = {
      getPropertyTableData: () => [{ StateWord: baseline() | 0x2 }],
    };
    expect(readStateWordFromMesh(mesh)).toBeNull();
  });

  it('reduces only the texture field under FPS pressure and restores it above the recovery threshold', () => {
    const base = baseline();
    const degraded = stateWordForFrameBudget(base, base, 20);
    expect(decodeStateWord(degraded, 'T')).toBe(0);
    expect(decodeStateWord(degraded, 'B')).toBe(decodeStateWord(base, 'B'));
    expect(decodeStateWord(degraded, 'D')).toBe(decodeStateWord(base, 'D'));
    expect(decodeStateWord(degraded, 'C')).toBe(decodeStateWord(base, 'C'));
    expect(decodeStateWord(degraded, 'S')).toBe(decodeStateWord(base, 'S'));

    expect(stateWordForFrameBudget(base, degraded, 32)).toBe(degraded);
    const restored = stateWordForFrameBudget(base, degraded, 40);
    expect(restored).toBe(base);
  });

  it('keeps the full degradation policy ordered T then C then S and never reduces B/D', () => {
    const base = encodeStateWord({ B: 3, D: 3, C: 2, T: 1, S: 1 });
    const afterTexture = degradeStateWordOneStep(base);
    expect(decodeStateWord(afterTexture, 'T')).toBe(0);
    const afterComponents = degradeStateWordOneStep(afterTexture);
    expect(decodeStateWord(afterComponents, 'C')).toBe(1);
    expect(decodeStateWord(afterComponents, 'B')).toBe(3);
    expect(decodeStateWord(afterComponents, 'D')).toBe(3);
  });

  it('rejects invalid frame telemetry and hysteresis thresholds', () => {
    const base = baseline();
    expect(() => stateWordForFrameBudget(base, base, Number.NaN)).toThrow(RangeError);
    expect(() => stateWordForFrameBudget(base, base, 20, 35, 30)).toThrow(RangeError);
  });
});
