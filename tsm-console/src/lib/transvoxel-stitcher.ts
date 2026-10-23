/**
 * TSM Transvoxel Transition Tables & Stitcher
 *
 * Lengyel transitionCellClass[512] (56 classes) via transvoxel-lengyel-classes.ts.
 * Full triangle vertex tables for all 56 classes still expand in the Python
 * mesher (scripts/geospatial); this module provides case classification for
 * runtime / PoC consumers.
 *
 * Reference: Lengyel, E. "Voxel-Based Terrain for Real-Time Virtual Simulations"
 */

import { getTransitionClass, TRANSITION_CELL_CLASS, validateLengyelTables } from './transvoxel-lengyel-classes.ts';

export interface TransitionCellData {
  vertexCount: number;
  indexCount: number;
  triangles: number[];
}

/** Sparse common-case geometry; full 56-class mesh tables remain in Python. */
export const TRANSVOXEL_TRANSITION_CASES: Record<number, TransitionCellData> = {
  0x000: { vertexCount: 0, indexCount: 0, triangles: [] },
  0x001: { vertexCount: 4, indexCount: 6, triangles: [0, 1, 2, 0, 2, 3] },
  0x002: { vertexCount: 4, indexCount: 6, triangles: [1, 2, 3, 1, 3, 0] },
  0x004: { vertexCount: 4, indexCount: 6, triangles: [0, 1, 4, 0, 4, 3] },
  0x1ff: { vertexCount: 0, indexCount: 0, triangles: [] },
};

export class TransvoxelStitcher {
  public static evaluateTransitionCase(cornerSdfs: Float32Array): number {
    if (cornerSdfs.length !== 9) {
      throw new Error(`Expected 9 SDF values, got ${cornerSdfs.length}`);
    }
    let caseIndex = 0;
    for (let i = 0; i < 9; i++) {
      const value = cornerSdfs[i]!;
      if (!Number.isFinite(value)) {
        throw new RangeError(`SDF sample at index ${i} must be finite`);
      }
      if (value < 0.0) {
        caseIndex |= 1 << i;
      }
    }
    if (caseIndex === 0x000 || caseIndex === 0x1ff) {
      return -1;
    }
    return caseIndex;
  }

  public static generateTransitionGeometry(caseIndex: number): number[] | null {
    // Only sparse common cases have runtime geometry in this module. Do not
    // coerce malformed indices or invent geometry for unsupported classes.
    if (!Number.isInteger(caseIndex) || caseIndex < 0 || caseIndex > 0x1ff) return null;
    const cellData = TRANSVOXEL_TRANSITION_CASES[caseIndex];
    if (!cellData || cellData.indexCount === 0) {
      return null;
    }
    return cellData.triangles;
  }

  /** Lengyel equivalence class 0..55 + invert winding flag. */
  public static getEquivalenceClass(caseIndex: number): { classId: number; invertWinding: boolean } {
    return getTransitionClass(caseIndex);
  }

  public static validateTables(): boolean {
    return validateLengyelTables().ok && TRANSITION_CELL_CLASS.length === 512;
  }
}

export { TRANSITION_CELL_CLASS, getTransitionClass, validateLengyelTables };
