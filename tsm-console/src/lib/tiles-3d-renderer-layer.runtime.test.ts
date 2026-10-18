import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { encodeStateWord } from './state-word-codec';
import {
  degradeStateWordOneStep,
  readStateWordFromMesh,
  stateWordForFrameBudget,
} from './tiles-3d-renderer-layer';

function featureMesh(featureIds: number[], word: unknown): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Array(featureIds.length * 3).fill(0), 3),
  );
  geometry.setAttribute('_FEATURE_ID_0', new THREE.Uint16BufferAttribute(featureIds, 1));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.userData.meshFeatures = {
    getFeatureInfo: () => [{ propertyTable: 0, label: 'building', nullFeatureId: null }],
  };
  mesh.userData.structuralMetadata = {
    getPropertyTableInfo: () => [{ name: 'building', className: 'building' }],
    getPropertyTableData: (tables: number[], ids: number[]) => {
      if (tables[0] !== 0 || ids[0] !== featureIds[0]) return [];
      return [{ stateWord: word }];
    },
  };
  return mesh;
}

describe('state-word-driven 3D renderer', () => {
  it('decodes a valid state word from a uniform EXT_mesh_features ID and structural metadata', () => {
    const word = encodeStateWord({ B: 1, D: 3, C: 2, T: 3, S: 1 });
    const mesh = featureMesh([42, 42, 42], word);
    expect(readStateWordFromMesh(mesh)).toBe(word);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('fails closed for primitives containing multiple feature IDs', () => {
    const mesh = featureMesh([42, 43, 42], 1);
    expect(readStateWordFromMesh(mesh)).toBeNull();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('does not invent a state word when legacy metadata has no stateWord property', () => {
    const mesh = featureMesh([42, 42, 42], undefined);
    expect(readStateWordFromMesh(mesh)).toBeNull();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('degrades textures, then tagged optional components and semantics, preserving B and D', () => {
    const original = encodeStateWord({ B: 2, D: 3, C: 2, T: 2, S: 1 });
    const tStep = degradeStateWordOneStep(original);
    expect(tStep).toBe(encodeStateWord({ B: 2, D: 3, C: 2, T: 1, S: 1 }));
    const cStep = degradeStateWordOneStep(tStep);
    expect(cStep).toBe(encodeStateWord({ B: 2, D: 3, C: 1, T: 1, S: 1 }));
    expect(() => degradeStateWordOneStep(0xffff)).toThrow(RangeError);
  });

  it('uses FPS hysteresis for one-step degradation and recovery', () => {
    const base = encodeStateWord({ B: 1, D: 3, C: 2, T: 2, S: 2 });
    const degraded = stateWordForFrameBudget(base, base, 22, 30, 38);
    expect(degraded).toBe(encodeStateWord({ B: 1, D: 3, C: 2, T: 1, S: 2 }));
    expect(stateWordForFrameBudget(base, degraded, 34, 30, 38)).toBe(degraded);
    expect(stateWordForFrameBudget(base, degraded, 42, 30, 38)).toBe(base);
    expect(() => stateWordForFrameBudget(base, base, Number.NaN)).toThrow(RangeError);
  });
});
