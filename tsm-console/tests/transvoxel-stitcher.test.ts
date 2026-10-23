import { describe, expect, it } from 'vitest';
import { TransvoxelStitcher, TRANSITION_CASE_BITS, TRANSITION_CELL_CLASS } from '../src/lib/transvoxel-stitcher';
import { TRANSITION_CELL_DATA_TABLE, TRANSITION_VERTEX_DATA_TABLE } from '../src/lib/transvoxel-lengyel-tables';

function transitionCellInput(
  origin: readonly [number, number, number],
  axis: 0 | 1 | 2,
  extent: number,
  direction: -1 | 1,
  sdfAt: (x: number, y: number, z: number) => number,
): { sdf: Float32Array; positions: Float32Array } {
  const tangentA = (axis + 1) % 3;
  const tangentB = (axis + 2) % 3;
  const uv: Array<readonly [number, number]> = [
    [0, 0], [0.5, 0], [1, 0],
    [0, 0.5], [0.5, 0.5], [1, 0.5],
    [0, 1], [0.5, 1], [1, 1],
    [0, 0], [1, 0], [0, 1], [1, 1],
  ];
  const sdf = new Float32Array(9);
  const positions = new Float32Array(39);
  for (let i = 0; i < 13; i++) {
    const point = [...origin] as [number, number, number];
    point[tangentA] += uv[i]![0] * extent;
    point[tangentB] += uv[i]![1] * extent;
    if (i >= 9) point[axis] += direction * extent;
    positions.set(point, i * 3);
    if (i < 9) sdf[i] = sdfAt(point[0], point[1], point[2]);
  }
  return { sdf, positions };
}

function seamVertices(mesh: ReturnType<typeof TransvoxelStitcher.polygonizeTransitionCell>, axis: number, coordinate: number): string[] {
  const vertices: string[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const point = [mesh.positions[i]!, mesh.positions[i + 1]!, mesh.positions[i + 2]!];
    if (Math.abs(point[axis]! - coordinate) < 1e-5) {
      vertices.push(point.map((value) => Math.round(value * 1e5) / 1e5).join(','));
    }
  }
  return vertices.sort();
}

describe('official Transvoxel transition mesher', () => {
  it('contains all 512 cases, 56 canonical classes, and 12 vertex slots per case', () => {
    expect(TRANSITION_CELL_CLASS).toHaveLength(512);
    expect(TRANSITION_CELL_DATA_TABLE).toHaveLength(56);
    expect(TRANSITION_VERTEX_DATA_TABLE).toHaveLength(512);
    expect(TransvoxelStitcher.validateTables()).toBe(true);
  });
  it('uses official case-bit order and every table edge crosses the scalar field', () => {
    expect(TRANSITION_CASE_BITS).toEqual([0x01, 0x02, 0x04, 0x80, 0x100, 0x08, 0x40, 0x20, 0x10]);
    const coarseCornerSamples = [0, 2, 6, 8];
    const seenCases = new Set<number>();
    for (let signMask = 0; signMask < 512; signMask++) {
      const sdf = new Float32Array(9);
      let expected = 0;
      for (let i = 0; i < 9; i++) {
        sdf[i] = (signMask & (1 << i)) !== 0 ? -1 : 1;
        if (sdf[i]! < 0) expected |= TRANSITION_CASE_BITS[i]!;
      }
      const caseIndex = TransvoxelStitcher.evaluateTransitionCase(sdf);
      expect(caseIndex).toBe(expected);
      if (caseIndex === 0 || caseIndex === 0x1ff) continue;
      seenCases.add(caseIndex);
      const classId = TRANSITION_CELL_CLASS[caseIndex]! & 0x7f;
      const [counts] = TRANSITION_CELL_DATA_TABLE[classId]!;
      const vertexCount = counts >>> 4;
      const vertices = TRANSITION_VERTEX_DATA_TABLE[caseIndex]!;
      for (let vertex = 0; vertex < vertexCount; vertex++) {
        const encodedEdge = vertices[vertex]! & 0xff;
        const endpointA = encodedEdge & 0x0f;
        const endpointB = (encodedEdge >>> 4) & 0x0f;
        const sampleA = sdf[endpointA < 9 ? endpointA : coarseCornerSamples[endpointA - 9]!]!;
        const sampleB = sdf[endpointB < 9 ? endpointB : coarseCornerSamples[endpointB - 9]!]!;
        expect(sampleA < 0, `case ${caseIndex} edge ${endpointA}-${endpointB}`).not.toBe(sampleB < 0);
      }
    }
    expect(seenCases.size).toBe(510);
  });

  it('maps all 512 cases to valid canonical triangle indices', () => {
    for (let mask = 0; mask < 512; mask++) {
      const indices = TransvoxelStitcher.generateTransitionGeometry(mask);
      expect(indices).not.toBeNull();
      expect(indices!.length % 3).toBe(0);
      const data = TRANSITION_CELL_DATA_TABLE[TRANSITION_CELL_CLASS[mask]! & 0x7f]!;
      expect(indices).toHaveLength((data[0] & 0x0f) * 3);
    }
  });
  it('polygonizes a nontrivial transition cell into finite indexed geometry', () => {
    const sdf = new Float32Array(9).fill(1);
    sdf[0] = -1;
    sdf[1] = -1; sdf[4] = -1;
    const p = new Float32Array(39);
    const coords = [[0,0,0],[0.5,0,0],[1,0,0],[0,0.5,0],[0.5,0.5,0],[1,0.5,0],[0,1,0],[0.5,1,0],[1,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    coords.forEach((v,i)=>v.forEach((n,a)=>p[i*3+a]=n));
    const mesh = TransvoxelStitcher.polygonizeTransitionCell(sdf,p);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.indices.every((v)=>v < mesh.positions.length / 3)).toBe(true);
  });
  it('reuses the correct fine-corner scalar for each coarse-side endpoint', () => {
    const sdf = new Float32Array(9).fill(1);
    sdf[0] = -1;
    const positions = new Float32Array(39);
    const coords = [[0,0,0],[0.5,0,0],[1,0,0],[0,0.5,0],[0.5,0.5,0],[1,0.5,0],[0,1,0],[0.5,1,0],[1,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    coords.forEach((v,i)=>v.forEach((n,a)=>positions[i*3+a]=n));
    const mesh = TransvoxelStitcher.polygonizeTransitionCell(sdf, positions);
    const changedCorner = sdf.slice();
    changedCorner[8] = -2;
    const changedMesh = TransvoxelStitcher.polygonizeTransitionCell(changedCorner, positions);
    expect(Array.from(mesh.positions)).not.toEqual(Array.from(changedMesh.positions));
    expect(() => TransvoxelStitcher.polygonizeTransitionCell(new Float32Array(13), positions)).toThrow(/9 fine-side scalar samples/);
  });
  it('matches intersection vertices across adjacent transition cells', () => {
    const sdfAt = (_x: number, y: number, _z: number) => 0.37 * y - 0.15;
    for (const direction of [-1, 1] as const) {
      const leftInput = transitionCellInput([0, 0, 0], 2, 1, direction, sdfAt);
      const rightInput = transitionCellInput([1, 0, 0], 2, 1, direction, sdfAt);
      const left = TransvoxelStitcher.polygonizeTransitionCell(leftInput.sdf, leftInput.positions);
      const right = TransvoxelStitcher.polygonizeTransitionCell(rightInput.sdf, rightInput.positions);
      const leftSeam = seamVertices(left, 0, 1);
      const rightSeam = seamVertices(right, 0, 1);
      expect(leftSeam.length).toBeGreaterThan(0);
      expect(rightSeam).toEqual(leftSeam);
    }
  });
  it('rejects incomplete and non-finite sample fields', () => {
    expect(() => TransvoxelStitcher.polygonizeTransitionCell(new Float32Array(8),new Float32Array(39))).toThrow(/9 fine-side scalar samples/);
    const sdf = new Float32Array(9); sdf[8] = Number.NaN;
    expect(() => TransvoxelStitcher.polygonizeTransitionCell(sdf,new Float32Array(39))).toThrow(/Non-finite/);
  });
});
