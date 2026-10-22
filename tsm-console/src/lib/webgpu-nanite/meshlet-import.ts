/**
 * Meshlet import for TSM.
 *
 * Production offline bake should use ATphobia22/nanite-webgpu (meshoptimizer WASM +
 * METIS DAG). This module provides:
 * 1. JSON/binary pack loader
 * 2. Portable greedy triangle clustering (no WASM) for CI + small pilot meshes
 *
 * Label authority SIMULATION_DEMO until evidence is attached.
 */

import {
  MESHLET_MAX_TRIANGLES,
  MESHLET_MAX_VERTICES,
  type MeshletDescriptor,
  type MeshletGeometry,
  type MeshletImportResult,
  type MeshletPack,
} from './meshlet-types';

export interface RawMeshInput {
  positions: Float32Array; // xyz
  indices: Uint32Array; // triangles
  normals?: Float32Array;
  sourceId: string;
  horizontalCrs?: string;
  verticalDatum?: string;
}

function triangleBounds(
  positions: Float32Array,
  indices: Uint32Array,
  triStart: number,
  triCount: number,
): { center: [number, number, number]; radius: number } {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = indices[triStart * 3 + t * 3 + k]! * 3;
      const x = positions[vi]!;
      const y = positions[vi + 1]!;
      const z = positions[vi + 2]!;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  let r = 0;
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = indices[triStart * 3 + t * 3 + k]! * 3;
      const dx = positions[vi]! - cx;
      const dy = positions[vi + 1]! - cy;
      const dz = positions[vi + 2]! - cz;
      r = Math.max(r, Math.hypot(dx, dy, dz));
    }
  }
  return { center: [cx, cy, cz], radius: r };
}

/**
 * Greedy sequential clustering into meshlets (portable, not METIS quality).
 * Use nanite-webgpu offline for production DAG simplification.
 */
export function buildMeshletsGreedy(input: RawMeshInput): MeshletImportResult {
  const warnings: string[] = [];
  if (input.positions.length < 9 || input.positions.length % 3 !== 0) {
    throw new Error('mesh positions must contain at least three xyz vertices');
  }
  if (input.indices.length === 0 || input.indices.length % 3 !== 0) {
    throw new Error('mesh indices must contain complete triangles');
  }
  if (input.normals && input.normals.length !== input.positions.length) {
    throw new Error('normal array must match position array length');
  }
  for (const value of input.positions) {
    if (!Number.isFinite(value)) throw new Error('mesh positions must be finite');
  }
  const vertexCount = input.positions.length / 3;
  for (const index of input.indices) {
    if (!Number.isInteger(index) || index >= vertexCount) throw new Error('mesh index references an invalid vertex');
  }

  const triangleCount = input.indices.length / 3;
  const meshlets: MeshletDescriptor[] = [];
  const meshletVertexIndices: number[] = [];
  const meshletTriangles: number[] = [];
  let cursor = 0;

  while (cursor < triangleCount) {
    const vertexOffset = meshletVertexIndices.length;
    const triangleOffset = meshletTriangles.length / 3;
    const localVertexMap = new Map<number, number>();
    let acceptedTriangles = 0;

    while (cursor + acceptedTriangles < triangleCount && acceptedTriangles < MESHLET_MAX_TRIANGLES) {
      const triangleStart = (cursor + acceptedTriangles) * 3;
      const globalTriangle = [
        input.indices[triangleStart]!,
        input.indices[triangleStart + 1]!,
        input.indices[triangleStart + 2]!,
      ];
      const additionalVertices = new Set(globalTriangle.filter((index) => !localVertexMap.has(index)));
      if (localVertexMap.size + additionalVertices.size > MESHLET_MAX_VERTICES) break;

      for (const globalIndex of globalTriangle) {
        let localIndex = localVertexMap.get(globalIndex);
        if (localIndex == null) {
          localIndex = localVertexMap.size;
          localVertexMap.set(globalIndex, localIndex);
          meshletVertexIndices.push(globalIndex);
        }
        meshletTriangles.push(localIndex);
      }
      acceptedTriangles += 1;
    }

    if (acceptedTriangles === 0) {
      throw new Error('greedy meshlet builder cannot fit the next triangle within its vertex budget');
    }
    const bounds = triangleBounds(input.positions, input.indices, cursor, acceptedTriangles);
    meshlets.push({
      vertexOffset,
      vertexCount: localVertexMap.size,
      triangleOffset,
      triangleCount: acceptedTriangles,
      bounds,
      lodError: 0,
      parentIndex: -1,
    });
    cursor += acceptedTriangles;
  }

  if (meshlets.length > 1) {
    warnings.push('greedy source-order clusters only; run the meshoptimizer preprocessing pipeline for optimized culling and continuous LOD DAG');
  }

  const geometry: MeshletGeometry = {
    positions: input.positions,
    indices: input.indices,
    normals: input.normals,
    meshletVertexIndices: Uint32Array.from(meshletVertexIndices),
    meshletTriangles: Uint8Array.from(meshletTriangles),
  };
  const pack: MeshletPack = {
    version: 1,
    authority: 'SIMULATION_DEMO',
    sourceId: input.sourceId,
    horizontalCrs: input.horizontalCrs ?? 'LOCAL_3D_TILE_FRAME',
    verticalDatum: input.verticalDatum ?? 'LOCAL_3D_TILE_Z',
    meshlets,
    geometry,
    contentSha256: null,
  };
  return { pack, meshletCount: meshlets.length, triangleCount, warnings };
}

/** Load a JSON-serialized meshlet pack (arrays as number[]). */
export function importMeshletPackJson(json: unknown): MeshletImportResult {
  if (!json || typeof json !== 'object') throw new Error('invalid pack');
  const o = json as Record<string, unknown>;
  if (o.version !== 1) throw new Error('unsupported meshlet pack version');
  const geom = o.geometry as Record<string, unknown>;
  const positions = Float32Array.from(geom.positions as number[]);
  const indices = Uint32Array.from(geom.indices as number[]);
  const normals = geom.normals ? Float32Array.from(geom.normals as number[]) : undefined;
  const meshletVertexIndices = Array.isArray(geom.meshletVertexIndices) ? Uint32Array.from(geom.meshletVertexIndices as number[]) : undefined;
  const meshletTriangles = Array.isArray(geom.meshletTriangles) ? Uint8Array.from(geom.meshletTriangles as number[]) : undefined;
  const meshlets = (o.meshlets as MeshletDescriptor[]).map((m) => ({
    ...m,
    bounds: {
      center: m.bounds.center as [number, number, number],
      radius: m.bounds.radius,
    },
  }));

  const pack: MeshletPack = {
    version: 1,
    authority: (o.authority as MeshletPack['authority']) ?? 'SIMULATION_DEMO',
    sourceId: String(o.sourceId ?? 'unknown'),
    horizontalCrs: String(o.horizontalCrs ?? 'EPSG:4326'),
    verticalDatum: String(o.verticalDatum ?? 'NAVD88'),
    meshlets,
    geometry: { positions, indices, normals, meshletVertexIndices, meshletTriangles },
    contentSha256: (o.contentSha256 as string | null) ?? null,
  };

  const triangleCount = Math.floor(indices.length / 3);
  return { pack, meshletCount: meshlets.length, triangleCount, warnings: [] };
}

/** Serialize pack for offline transfer (JSON-friendly). */
export function exportMeshletPackJson(pack: MeshletPack): Record<string, unknown> {
  return {
    version: pack.version,
    authority: pack.authority,
    sourceId: pack.sourceId,
    horizontalCrs: pack.horizontalCrs,
    verticalDatum: pack.verticalDatum,
    contentSha256: pack.contentSha256 ?? null,
    meshlets: pack.meshlets,
    geometry: {
      positions: Array.from(pack.geometry.positions),
      indices: Array.from(pack.geometry.indices),
      normals: pack.geometry.normals ? Array.from(pack.geometry.normals) : null,
      ...(pack.geometry.meshletVertexIndices ? { meshletVertexIndices: Array.from(pack.geometry.meshletVertexIndices) } : {}),
      ...(pack.geometry.meshletTriangles ? { meshletTriangles: Array.from(pack.geometry.meshletTriangles) } : {}),
    },
  };
}

/** Unit cube pilot mesh for smoke tests (Posey local meters arbitrary). */
export function createUnitCubeMesh(sourceId = 'tsm-unit-cube-pilot'): RawMeshInput {
  // 8 corners, 12 triangles
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  ]);
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4,
    3, 4, 0,
  ]);
  return {
    positions,
    indices,
    sourceId,
    horizontalCrs: 'EPSG:2966',
    verticalDatum: 'NAVD88',
  };
}
