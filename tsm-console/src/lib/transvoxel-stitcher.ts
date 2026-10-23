
/**
 * Table-driven Transvoxel transition-cell mesher.
 * Table source: Eric Lengyel, https://github.com/EricLengyel/Transvoxel (MIT).
 *
 * The 9 fine-side samples determine the 9-bit case. Four coarse-side corner
 * vertices (slots 9..12) reuse the corner scalar values at fine slots [0,2,8,6].
 * Positions are caller supplied in world/local space, with 13 slots following
 * the official transitionVertexData edge encoding.
 */
import {
  TRANSITION_CELL_CLASS_TABLE,
  TRANSITION_CELL_DATA_TABLE,
  TRANSITION_VERTEX_DATA_TABLE,
} from './transvoxel-lengyel-tables';

export interface TransitionCellData {
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;
  readonly triangles: readonly number[];
}
export interface TransitionMesh {
  readonly caseIndex: number;
  readonly classId: number;
  readonly invertWinding: boolean;
  /** xyz triplets; vertices follow the official per-case transitionVertexData order. */
  readonly positions: Float32Array;
  /** Triangle-list indices into positions. */
  readonly indices: Uint32Array;
}

export const TRANSITION_CELL_CLASS: readonly number[] = TRANSITION_CELL_CLASS_TABLE;

/** Backwards-compatible, fully table-derived case map; no sparse hand-authored cases. */
export const TRANSVOXEL_TRANSITION_CASES: Readonly<Record<number, TransitionCellData>> = Object.freeze(
  Object.fromEntries(Array.from({ length: 512 }, (_, caseIndex) => {
    const { classId, invertWinding } = getTransitionClass(caseIndex);
    const row = TRANSITION_CELL_DATA_TABLE[classId]!;
    const vertexCount = row[0] >>> 4;
    const triangleCount = row[0] & 0x0f;
    const triangles = row[1].slice(0, triangleCount * 3);
    if (invertWinding) for (let i = 0; i < triangles.length; i += 3) [triangles[i + 1], triangles[i + 2]] = [triangles[i + 2]!, triangles[i + 1]!];
    return [caseIndex, Object.freeze({ vertexCount, indexCount: triangles.length, triangleCount, triangles: Object.freeze(triangles) })] as const;
  })),
);

export function getTransitionClass(caseIndex: number): { classId: number; invertWinding: boolean } {
  if (!Number.isInteger(caseIndex) || caseIndex < 0 || caseIndex > 511) {
    throw new RangeError('caseIndex must be an integer in 0..511');
  }
  const encoded = TRANSITION_CELL_CLASS_TABLE[caseIndex]!;
  return { classId: encoded & 0x7f, invertWinding: (encoded & 0x80) !== 0 };
}

export class TransvoxelStitcher {
  /** Case bits follow the official transitionCellClass table: negative = solid. */
  public static evaluateTransitionCase(cornerSdfs: Float32Array): number {
    if (cornerSdfs.length !== 9) throw new Error(`Expected 9 fine-side SDF values, got ${cornerSdfs.length}`);
    let caseIndex = 0;
    for (let i = 0; i < 9; i++) {
      const value = cornerSdfs[i]!;
      if (!Number.isFinite(value)) throw new Error(`Non-finite SDF at fine sample ${i}`);
      if (value < 0) caseIndex |= 1 << i;
    }
    return caseIndex;
  }

  /** Return canonical triangle-list indices for a case, without positions. */
  public static generateTransitionGeometry(caseIndex: number): number[] | null {
    if (!Number.isInteger(caseIndex) || caseIndex < 0 || caseIndex > 511) throw new RangeError('caseIndex must be 0..511');
    const { classId, invertWinding } = getTransitionClass(caseIndex);
    const row = TRANSITION_CELL_DATA_TABLE[classId];
    if (!row) throw new Error(`Missing Transvoxel transition class ${classId}`);
    const triangleCount = row[0] & 0x0f;
    const indices = row[1].slice(0, triangleCount * 3);
    if (invertWinding) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
    return indices;
  }

  /**
   * Polygonize one official transition cell. sdf has 9 fine-side samples and
   * positions has 13 xyz triplets. Position slots 9..12 represent the coarse corners.
   */
  public static polygonizeTransitionCell(sdf: Float32Array, positions: Float32Array): TransitionMesh {
    if (sdf.length !== 9) throw new Error(`Expected 9 fine-side scalar samples, got ${sdf.length}`);
    if (positions.length !== 39) throw new Error(`Expected 13 xyz positions (39 floats), got ${positions.length}`);
    for (let i = 0; i < 9; i++) if (!Number.isFinite(sdf[i]!)) throw new Error(`Non-finite SDF sample ${i}`);
    for (let i = 0; i < 13; i++) for (let axis = 0; axis < 3; axis++) if (!Number.isFinite(positions[i * 3 + axis]!)) throw new Error(`Non-finite position at sample ${i}`);
    const caseIndex = this.evaluateTransitionCase(sdf);
    const { classId, invertWinding } = getTransitionClass(caseIndex);
    const [geometryCounts, rawTriangleIndices] = TRANSITION_CELL_DATA_TABLE[classId]!;
    const vertexCount = geometryCounts >>> 4;
    const triangleCount = geometryCounts & 0x0f;
    const encodedVertices = TRANSITION_VERTEX_DATA_TABLE[caseIndex]!;
    const outputPositions = new Float32Array(vertexCount * 3);
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const edge = encodedVertices[vertex]! & 0xff;
      const endpointA = (edge >>> 4) & 0x0f;
      const endpointB = edge & 0x0f;
      if (endpointA > 12 || endpointB > 12) throw new Error(`Invalid transition edge endpoints ${endpointA},${endpointB} for case ${caseIndex}`);
      const scalarSample = (endpoint: number): number => endpoint < 9 ? endpoint : [0, 2, 8, 6][endpoint - 9]!;
      const a = sdf[scalarSample(endpointA)]!;
      const b = sdf[scalarSample(endpointB)]!;
      const denominator = a - b;
      const t = Math.abs(denominator) < 1e-20 ? 0.5 : Math.max(0, Math.min(1, a / denominator));
      for (let axis = 0; axis < 3; axis++) {
        const pa = positions[endpointA * 3 + axis]!;
        const pb = positions[endpointB * 3 + axis]!;
        outputPositions[vertex * 3 + axis] = pa + (pb - pa) * t;
      }
    }
    const indices = rawTriangleIndices.slice(0, triangleCount * 3);
    for (const index of indices) if (index < 0 || index >= vertexCount) throw new Error(`Invalid triangle vertex index ${index} in class ${classId}`);
    if (invertWinding) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
    return { caseIndex, classId, invertWinding, positions: outputPositions, indices: new Uint32Array(indices) };
  }


/** Compatibility validator used by release-gate tests and diagnostics. */
export function validateLengyelTables(): { ok: boolean; uniqueClasses: number } {
  const uniqueClasses = new Set(TRANSITION_CELL_CLASS_TABLE.map((encoded) => encoded & 0x7f)).size;
  return {
    ok: TransvoxelStitcher.validateTables() && uniqueClasses === 56,
    uniqueClasses,
  };
}

  public static validateTables(): boolean {
    if (TRANSITION_CELL_CLASS_TABLE.length !== 512 || TRANSITION_CELL_DATA_TABLE.length !== 56 || TRANSITION_VERTEX_DATA_TABLE.length !== 512) return false;
    for (let caseIndex = 0; caseIndex < 512; caseIndex++) {
      const { classId } = getTransitionClass(caseIndex);
      const row = TRANSITION_CELL_DATA_TABLE[classId];
      if (!row) return false;
      const vertexCount = row[0] >>> 4;
      const triangleCount = row[0] & 0x0f;
      if (vertexCount > 12 || row[1].length < triangleCount * 3) return false;
      if (row[1].slice(0, triangleCount * 3).some((index) => index >= vertexCount)) return false;
      if (TRANSITION_VERTEX_DATA_TABLE[caseIndex]!.length !== 12) return false;
    }
    return true;
  }
}

export { TRANSITION_CELL_CLASS_TABLE, TRANSITION_CELL_DATA_TABLE, TRANSITION_VERTEX_DATA_TABLE };
