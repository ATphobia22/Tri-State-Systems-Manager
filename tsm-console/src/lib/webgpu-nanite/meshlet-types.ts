/**
 * Meshlet data contract for TSM Nanite plane B.
 * Aligned with meshoptimizer + ATphobia22/nanite-webgpu createMeshlets.types.
 *
 * Defaults: maxVertices=64, maxTriangles=124 (NVIDIA / zeux guidance).
 */

export const MESHLET_MAX_VERTICES = 64;
export const MESHLET_MAX_TRIANGLES = 124;

export interface MeshletBounds {
  /** Sphere center in mesh local space */
  center: [number, number, number];
  radius: number;
}

export interface MeshletDescriptor {
  /** Index into packed vertex-index region */
  vertexOffset: number;
  vertexCount: number;
  /** Index into triangle index region (triangle units or flattened — see pack) */
  triangleOffset: number;
  triangleCount: number;
  bounds: MeshletBounds;
  /** Parent LOD error (0 = finest); used for continuous LOD selection */
  lodError: number;
  /** Parent meshlet indices in the pack (-1 = root) */
  parentIndex: number;
}

export interface MeshletGeometry {
  /** Interleaved or separate positions: xyz float32 */
  positions: Float32Array;
  /** Optional normals xyz */
  normals?: Float32Array;
  /** Triangle indices into positions (global after rewrite) */
  indices: Uint32Array;
}

export interface MeshletPack {
  version: 1;
  /** SIMULATION_DEMO until survey-grade evidence attached */
  authority: 'SIMULATION_DEMO' | 'DERIVED' | 'OBSERVATION';
  sourceId: string;
  /** CRS / vertical metadata for twin alignment */
  horizontalCrs: string;
  verticalDatum: string;
  meshlets: MeshletDescriptor[];
  geometry: MeshletGeometry;
  /** Optional content hash for evidence ledger */
  contentSha256?: string | null;
}

export interface MeshletImportResult {
  pack: MeshletPack;
  meshletCount: number;
  triangleCount: number;
  warnings: string[];
}
