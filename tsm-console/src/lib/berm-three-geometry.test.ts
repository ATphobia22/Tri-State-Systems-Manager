/**
 * berm-three-geometry.test.ts — vitest suite for the berm prism geometry
 * builder. Uses the real three.js BufferGeometry (no WebGL needed) to
 * verify cross-section math, winding/normals, unit conversion, and
 * fail-closed behavior on invalid input.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  BERM_MATERIAL_PARAMS,
  FT_TO_M,
  bermSceneContent,
  buildBermPrismGeometry,
  createBermMesh,
} from './berm-three-geometry';
import type {
  AlignmentStation,
  TypicalSection,
} from './engineering/berm-road-placement';

const section: TypicalSection = {
  kind: 'flood-berm',
  crestWidthFt: 12,
  crestElevFt: 380,
  sideSlopeHV: 3,
  dredgeFillFraction: 0.8,
};

const stations: AlignmentStation[] = [
  { stationFt: 0, groundElevFt: 376 },
  { stationFt: 500, groundElevFt: 375 },
  { stationFt: 1000, groundElevFt: 377 },
];

function positionsOf(geometry: THREE.BufferGeometry): number[] {
  return Array.from(geometry.getAttribute('position').array as Float32Array);
}

describe('buildBermPrismGeometry', () => {
  it('emits the expected triangle count (3 quads/segment + 2 end caps)', () => {
    const g = buildBermPrismGeometry(stations, section);
    expect(g).not.toBeNull();
    // 2 segments × 3 quads × 2 tris + 2 caps × 2 tris = 16 tris = 48 verts
    expect(positionsOf(g!).length / 3).toBe(48);
  });

  it('converts feet to meters and places the crest at the design elevation', () => {
    const g = buildBermPrismGeometry(stations, section)!;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    // Crest top at 380 ft → meters; X spans the 1000 ft alignment.
    expect(bb.max.y).toBeCloseTo(380 * FT_TO_M, 4);
    expect(bb.max.x).toBeCloseTo(1000 * FT_TO_M, 4);
    expect(bb.min.x).toBeCloseTo(0, 9);
  });

  it('sizes the toe from crest width + side slope × fill height', () => {
    // Station 0: fillH = 380 − 376 = 4 ft → toeHalf = 6 + 3×4 = 18 ft.
    const g = buildBermPrismGeometry(
      [
        { stationFt: 0, groundElevFt: 376 },
        { stationFt: 100, groundElevFt: 376 },
      ],
      section,
    )!;
    g.computeBoundingBox();
    expect(g.boundingBox!.max.z).toBeCloseTo(18 * FT_TO_M, 4);
    expect(g.boundingBox!.min.z).toBeCloseTo(-18 * FT_TO_M, 4);
  });

  it('renders cut reaches flat (no fill prism above ground)', () => {
    const g = buildBermPrismGeometry(
      [
        { stationFt: 0, groundElevFt: 382 },
        { stationFt: 100, groundElevFt: 383 },
      ],
      section,
    )!;
    g.computeBoundingBox();
    // Top of the prism follows the ground, never the below-grade crest.
    expect(g.boundingBox!.max.y).toBeCloseTo(383 * FT_TO_M, 4);
  });

  it('produces outward-facing normals on the crest', () => {
    const g = buildBermPrismGeometry(
      [
        { stationFt: 0, groundElevFt: 376 },
        { stationFt: 100, groundElevFt: 376 },
      ],
      section,
    )!;
    const nor = Array.from(g.getAttribute('normal').array as Float32Array);
    // Vertex 6 is the first vertex of the first crest-top triangle; its
    // face normal must point straight up (+Y) for a flat crest.
    expect(nor[6 * 3]).toBeCloseTo(0, 4);
    expect(nor[6 * 3 + 1]).toBeCloseTo(1, 4);
    expect(nor[6 * 3 + 2]).toBeCloseTo(0, 4);
  });

  it('is fail-closed on invalid input', () => {
    expect(buildBermPrismGeometry([], section)).toBeNull();
    expect(
      buildBermPrismGeometry([{ stationFt: 0, groundElevFt: 376 }], section),
    ).toBeNull();
    expect(
      buildBermPrismGeometry(
        [
          { stationFt: 100, groundElevFt: 376 },
          { stationFt: 100, groundElevFt: 376 },
        ],
        section,
      ),
    ).toBeNull(); // non-increasing
    expect(
      buildBermPrismGeometry(
        [
          { stationFt: 0, groundElevFt: NaN },
          { stationFt: 100, groundElevFt: 376 },
        ],
        section,
      ),
    ).toBeNull();
    expect(
      buildBermPrismGeometry(stations, { ...section, crestWidthFt: 0 }),
    ).toBeNull();
    expect(
      buildBermPrismGeometry(stations, { ...section, sideSlopeHV: -1 }),
    ).toBeNull();
  });
});

describe('createBermMesh', () => {
  it('returns an earthwork PBR mesh for valid input', () => {
    const mesh = createBermMesh(stations, section);
    expect(mesh).not.toBeNull();
    const mat = mesh!.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.color.getHex()).toBe(BERM_MATERIAL_PARAMS.color);
    expect(mat.roughness).toBe(BERM_MATERIAL_PARAMS.roughness);
    expect(mat.metalness).toBe(BERM_MATERIAL_PARAMS.metalness);
    expect(mesh!.castShadow).toBe(true);
    expect(mesh!.receiveShadow).toBe(true);
  });

  it('returns null for invalid input', () => {
    expect(createBermMesh([], section)).toBeNull();
  });
});

describe('bermSceneContent', () => {
  it('adds the mesh to the scene for valid parameters', () => {
    const added: unknown[] = [];
    const scene = { add: (o: unknown) => void added.push(o) } as unknown as THREE.Scene;
    bermSceneContent(stations, section)(scene);
    expect(added).toHaveLength(1);
    expect(added[0]).toBeInstanceOf(THREE.Mesh);
  });

  it('adds nothing for invalid parameters and never throws', () => {
    const added: unknown[] = [];
    const scene = { add: (o: unknown) => void added.push(o) } as unknown as THREE.Scene;
    expect(() => bermSceneContent([], section)(scene)).not.toThrow();
    expect(added).toHaveLength(0);
  });

  it('survives a throwing scene.add', () => {
    const scene = {
      add: () => {
        throw new Error('boom');
      },
    } as unknown as THREE.Scene;
    expect(() => bermSceneContent(stations, section)(scene)).not.toThrow();
  });
});
