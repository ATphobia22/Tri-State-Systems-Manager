import { describe, expect, it } from 'vitest';
import { TransvoxelStitcher, TRANSITION_CELL_CLASS } from '../src/lib/transvoxel-stitcher';
import { TRANSITION_CELL_DATA_TABLE, TRANSITION_VERTEX_DATA_TABLE } from '../src/lib/transvoxel-lengyel-tables';

describe('official Transvoxel transition mesher', () => {
  it('contains all 512 cases, 56 canonical classes, and 12 vertex slots per case', () => {
    expect(TRANSITION_CELL_CLASS).toHaveLength(512);
    expect(TRANSITION_CELL_DATA_TABLE).toHaveLength(56);
    expect(TRANSITION_VERTEX_DATA_TABLE).toHaveLength(512);
    expect(TransvoxelStitcher.validateTables()).toBe(true);
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
    const sdf = new Float32Array(13).fill(1);
    sdf[0] = -1; sdf[1] = -1; sdf[4] = -1;
    const p = new Float32Array(39);
    const coords = [[0,0,0],[0.5,0,0],[1,0,0],[0,0.5,0],[0.5,0.5,0],[1,0.5,0],[0,1,0],[0.5,1,0],[1,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    coords.forEach((v,i)=>v.forEach((n,a)=>p[i*3+a]=n));
    const mesh = TransvoxelStitcher.polygonizeTransitionCell(sdf,p);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.indices.every((v)=>v < mesh.positions.length / 3)).toBe(true);
  });
  it('uses independent coarse-side scalar values for edge interpolation', () => {
    const sdf = new Float32Array(13).fill(1);
    sdf[0] = -1;
    const positions = new Float32Array(39);
    const coords = [[0,0,0],[0.5,0,0],[1,0,0],[0,0.5,0],[0.5,0.5,0],[1,0.5,0],[0,1,0],[0.5,1,0],[1,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    coords.forEach((v,i)=>v.forEach((n,a)=>positions[i*3+a]=n));
    const original = TransvoxelStitcher.polygonizeTransitionCell(sdf, positions);
    const changed = sdf.slice();
    changed[9] = -1;
    const updated = TransvoxelStitcher.polygonizeTransitionCell(changed, positions);
    expect(Array.from(updated.positions)).not.toEqual(Array.from(original.positions));
  });
  it('rejects incomplete and non-finite sample fields', () => {
    expect(() => TransvoxelStitcher.polygonizeTransitionCell(new Float32Array(12),new Float32Array(39))).toThrow(/13 transition-cell scalar/);
    const sdf = new Float32Array(13); sdf[9] = Number.NaN;
    expect(() => TransvoxelStitcher.polygonizeTransitionCell(sdf,new Float32Array(39))).toThrow(/Non-finite/);
  });
});
